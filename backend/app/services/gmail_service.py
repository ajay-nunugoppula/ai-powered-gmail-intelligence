import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import get_settings
from app.utils.rate_limiter import with_exponential_backoff
from app.utils.text_utils import html_to_text, parse_email_address

logger = logging.getLogger(__name__)

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


class GmailService:
    def __init__(self, access_token: str, refresh_token: Optional[str] = None, token_expiry: Optional[datetime] = None):
        settings = get_settings()
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=GMAIL_SCOPES,
        )
        if token_expiry:
            self.credentials.expiry = token_expiry
        self.service = build("gmail", "v1", credentials=self.credentials, cache_discovery=False)

    @with_exponential_backoff(max_retries=5)
    async def list_messages(self, page_token: Optional[str] = None, max_results: int = 50, query: str = "") -> dict:
        params = {"userId": "me", "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token
        if query:
            params["q"] = query
        return self.service.users().messages().list(**params).execute()

    @with_exponential_backoff(max_retries=5)
    async def get_message(self, message_id: str, format: str = "full") -> dict:
        return self.service.users().messages().get(userId="me", id=message_id, format=format).execute()

    @with_exponential_backoff(max_retries=5)
    async def get_thread(self, thread_id: str, format: str = "full") -> dict:
        return self.service.users().threads().get(userId="me", id=thread_id, format=format).execute()

    @with_exponential_backoff(max_retries=5)
    async def get_history(self, start_history_id: str) -> dict:
        return self.service.users().history().list(
            userId="me", startHistoryId=start_history_id, historyTypes=["messageAdded", "messageDeleted", "labelAdded"]
        ).execute()

    @with_exponential_backoff(max_retries=5)
    async def get_profile(self) -> dict:
        return self.service.users().getProfile(userId="me").execute()

    @with_exponential_backoff(max_retries=5)
    async def send_message(self, to: str, subject: str, body: str, thread_id: Optional[str] = None,
                           in_reply_to: Optional[str] = None, references: Optional[str] = None) -> dict:
        message = MIMEText(body)
        message["to"] = to
        message["subject"] = subject
        if in_reply_to:
            message["In-Reply-To"] = in_reply_to
        if references:
            message["References"] = references

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        body_data = {"raw": raw}
        if thread_id:
            body_data["threadId"] = thread_id

        return self.service.users().messages().send(userId="me", body=body_data).execute()

    def parse_message(self, msg: dict) -> dict:
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        body_text, body_html = self._extract_body(msg.get("payload", {}))

        sender_name, sender_email = parse_email_address(headers.get("from", ""))
        to_list = [parse_email_address(r)[1] for r in headers.get("to", "").split(",") if r.strip()]
        cc_list = [parse_email_address(r)[1] for r in headers.get("cc", "").split(",") if r.strip()]

        received_at = None
        if "date" in headers:
            try:
                from email.utils import parsedate_to_datetime
                received_at = parsedate_to_datetime(headers["date"]).isoformat()
            except Exception:
                pass

        return {
            "gmail_message_id": msg["id"],
            "gmail_thread_id": msg["threadId"],
            "subject": headers.get("subject", "(No Subject)"),
            "sender": sender_name or sender_email,
            "sender_email": sender_email,
            "recipients": to_list,
            "cc": cc_list,
            "body_text": body_text,
            "body_html": body_html,
            "snippet": msg.get("snippet", ""),
            "labels": msg.get("labelIds", []),
            "is_read": "UNREAD" not in msg.get("labelIds", []),
            "has_attachments": self._has_attachments(msg.get("payload", {})),
            "in_reply_to": headers.get("in-reply-to"),
            "references_header": headers.get("references"),
            "received_at": received_at,
        }

    def _extract_body(self, payload: dict) -> tuple[str, str]:
        body_text = ""
        body_html = ""

        if payload.get("body", {}).get("data"):
            data = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
            if payload.get("mimeType") == "text/html":
                body_html = data
                body_text = html_to_text(data)
            else:
                body_text = data

        for part in payload.get("parts", []):
            mime = part.get("mimeType", "")
            if part.get("body", {}).get("data"):
                data = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                if mime == "text/plain" and not body_text:
                    body_text = data
                elif mime == "text/html" and not body_html:
                    body_html = data
                    if not body_text:
                        body_text = html_to_text(data)
            elif part.get("parts"):
                sub_text, sub_html = self._extract_body(part)
                if not body_text:
                    body_text = sub_text
                if not body_html:
                    body_html = sub_html

        return body_text, body_html

    def _has_attachments(self, payload: dict) -> bool:
        if payload.get("filename"):
            return True
        for part in payload.get("parts", []):
            if part.get("filename") or self._has_attachments(part):
                return True
        return False

    async def fetch_all_messages_paginated(self, query: str = "", max_pages: int = 100) -> list[dict]:
        """Fetch all messages with pagination for large inboxes."""
        all_messages = []
        page_token = None
        pages = 0
        settings = get_settings()

        while pages < max_pages:
            result = await self.list_messages(
                page_token=page_token,
                max_results=settings.gmail_sync_batch_size,
                query=query,
            )
            messages = result.get("messages", [])
            all_messages.extend(messages)

            page_token = result.get("nextPageToken")
            pages += 1
            if not page_token:
                break

            logger.info(f"Fetched page {pages}, total messages so far: {len(all_messages)}")

        return all_messages
