import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.services.gmail_service import GmailService
from app.services.ai_service import AIService
from app.services.nim_service import NIMService
from app.services.rag_service import RAGService
from app.models.database import get_supabase
from app.utils.text_utils import clean_email_body

logger = logging.getLogger(__name__)


class SyncService:
    def __init__(self):
        self.db = get_supabase()
        self.ai = AIService()
        self.nim = NIMService()
        self.rag = RAGService()

    async def get_gmail_service(self, user_id: str) -> Optional[GmailService]:
        result = self.db.table("oauth_tokens").select("*").eq("user_id", user_id).single().execute()
        if not result.data:
            return None
        token = result.data
        expiry = None
        if token.get("token_expiry"):
            expiry = datetime.fromisoformat(token["token_expiry"].replace("Z", "+00:00"))
        return GmailService(token["access_token"], token.get("refresh_token"), expiry)

    async def update_sync_status(self, user_id: str, status: str, message: str = ""):
        self.db.table("sync_state").upsert({
            "user_id": user_id,
            "sync_status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id").execute()

    async def sync_user_emails(self, user_id: str, full_sync: bool = False) -> dict:
        gmail = await self.get_gmail_service(user_id)
        if not gmail:
            return {"status": "error", "message": "Gmail not connected"}

        await self.update_sync_status(user_id, "syncing")

        try:
            sync_state = self.db.table("sync_state").select("*").eq("user_id", user_id).execute()
            state = sync_state.data[0] if sync_state.data else {}

            if not full_sync and state.get("last_history_id"):
                return await self._incremental_sync(user_id, gmail, state["last_history_id"])

            return await self._full_sync(user_id, gmail)
        except Exception as e:
            logger.error(f"Sync failed for user {user_id}: {e}")
            await self.update_sync_status(user_id, "error", str(e))
            return {"status": "error", "message": str(e)}

    async def _full_sync(self, user_id: str, gmail: GmailService) -> dict:
        profile = await gmail.get_profile()
        history_id = profile.get("historyId")

        message_refs = await gmail.fetch_all_messages_paginated(max_pages=50)
        total_synced = 0
        batch_size = 10

        for i in range(0, len(message_refs), batch_size):
            batch = message_refs[i:i + batch_size]
            tasks = [self._process_message(user_id, gmail, ref["id"]) for ref in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total_synced += sum(1 for r in results if r and not isinstance(r, Exception))

            if i % 50 == 0:
                logger.info(f"Synced {total_synced}/{len(message_refs)} messages")

        self.db.table("sync_state").upsert({
            "user_id": user_id,
            "last_history_id": history_id,
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "idle",
            "total_emails_synced": total_synced,
        }, on_conflict="user_id").execute()

        return {"status": "completed", "total_synced": total_synced, "sync_type": "full"}

    async def _incremental_sync(self, user_id: str, gmail: GmailService, last_history_id: str) -> dict:
        try:
            history = await gmail.get_history(last_history_id)
        except Exception:
            return await self._full_sync(user_id, gmail)

        new_count = 0
        for record in history.get("history", []):
            for msg_added in record.get("messagesAdded", []):
                msg_id = msg_added["message"]["id"]
                result = await self._process_message(user_id, gmail, msg_id)
                if result:
                    new_count += 1

        profile = await gmail.get_profile()
        self.db.table("sync_state").upsert({
            "user_id": user_id,
            "last_history_id": profile.get("historyId", last_history_id),
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "idle",
        }, on_conflict="user_id").execute()

        return {"status": "completed", "total_synced": new_count, "sync_type": "incremental"}

    async def _process_message(self, user_id: str, gmail: GmailService, message_id: str) -> bool:
        try:
            msg = await gmail.get_message(message_id)
            parsed = gmail.parse_message(msg)

            existing = self.db.table("emails").select("id").eq(
                "user_id", user_id
            ).eq("gmail_message_id", message_id).execute()

            if existing.data:
                return False

            thread_id = await self._ensure_thread(user_id, parsed)
            body_text = clean_email_body(parsed["body_text"] or parsed["snippet"])

            email_data = {
                "user_id": user_id,
                "thread_id": thread_id,
                "gmail_message_id": parsed["gmail_message_id"],
                "gmail_thread_id": parsed["gmail_thread_id"],
                "subject": parsed["subject"],
                "sender": parsed["sender"],
                "sender_email": parsed["sender_email"],
                "recipients": parsed["recipients"],
                "cc": parsed["cc"],
                "body_text": body_text,
                "body_html": parsed.get("body_html", ""),
                "snippet": parsed["snippet"],
                "labels": parsed["labels"],
                "is_read": parsed["is_read"],
                "has_attachments": parsed["has_attachments"],
                "in_reply_to": parsed["in_reply_to"],
                "references_header": parsed["references_header"],
                "received_at": parsed["received_at"],
            }

            result = self.db.table("emails").insert(email_data).execute()
            if not result.data:
                return False

            email_record = result.data[0]
            email_id = email_record["id"]

            summary = await self.ai.summarize_email(
                parsed["subject"], parsed["sender"], body_text
            )
            self.db.table("emails").update({"summary": summary}).eq("id", email_id).execute()

            cat_result = await self.nim.classify_email(
                parsed["subject"], parsed["sender"], parsed["snippet"]
            )
            self.db.table("email_categories").upsert({
                "email_id": email_id,
                "category": cat_result.get("category", "uncategorized"),
                "confidence": cat_result.get("confidence", 0.0),
            }, on_conflict="email_id").execute()

            index_text = f"Subject: {parsed['subject']}\nFrom: {parsed['sender']}\n{body_text}"
            await self.rag.index_email(email_id, user_id, index_text, parsed)

            self.db.table("threads").update({
                "message_count": self.db.table("emails").select("id", count="exact").eq(
                    "thread_id", thread_id
                ).execute().count or 1,
                "last_message_at": parsed["received_at"],
                "snippet": parsed["snippet"],
            }).eq("id", thread_id).execute()

            return True
        except Exception as e:
            logger.error(f"Failed to process message {message_id}: {e}")
            return False

    async def _ensure_thread(self, user_id: str, parsed: dict) -> str:
        existing = self.db.table("threads").select("id").eq(
            "user_id", user_id
        ).eq("gmail_thread_id", parsed["gmail_thread_id"]).execute()

        if existing.data:
            return existing.data[0]["id"]

        result = self.db.table("threads").insert({
            "user_id": user_id,
            "gmail_thread_id": parsed["gmail_thread_id"],
            "subject": parsed["subject"],
            "snippet": parsed["snippet"],
            "last_message_at": parsed["received_at"],
            "message_count": 0,
        }).execute()

        return result.data[0]["id"]

    async def summarize_threads(self, user_id: str):
        """Background task to generate thread-level summaries."""
        threads = self.db.table("threads").select("id, subject").eq(
            "user_id", user_id
        ).is_("thread_summary", "null").limit(20).execute()

        for thread in (threads.data or []):
            emails = self.db.table("emails").select("*").eq(
                "thread_id", thread["id"]
            ).order("received_at").execute()

            if emails.data:
                summary = await self.ai.summarize_thread(thread["subject"], emails.data)
                self.db.table("threads").update({"thread_summary": summary}).eq("id", thread["id"]).execute()
