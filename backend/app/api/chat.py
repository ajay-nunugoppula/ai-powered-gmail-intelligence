import logging
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import (
    ChatMessageRequest, ChatMessageResponse, ChatSessionResponse, SourceReference,
)
from app.services.ai_service import AIService
from app.services.rag_service import RAGService
from app.services.nim_service import NIMService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(request: ChatMessageRequest, user: dict = Depends(get_current_user)):
    db = get_supabase()
    ai = AIService()
    rag = RAGService()
    nim = NIMService()

    session_id = request.session_id
    if not session_id:
        session = db.table("chat_sessions").insert({
            "user_id": user["id"],
            "title": request.message[:80],
        }).execute()
        session_id = session.data[0]["id"]
    else:
        session = db.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", user["id"]).execute()
        if not session.data:
            raise HTTPException(status_code=404, detail="Chat session not found")

    db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "user",
        "content": request.message,
    }).execute()

    history_result = db.table("chat_messages").select("*").eq(
        "session_id", session_id
    ).order("created_at").execute()
    chat_history = history_result.data or []

    email_context = await _retrieve_context(request.message, user["id"], rag, nim)

    response = await ai.chat_with_context(request.message, email_context, chat_history)

    sources = [
        SourceReference(
            email_id=s.get("email_id", ""),
            subject=s.get("subject"),
            sender=s.get("sender"),
            snippet=s.get("snippet"),
            received_at=s.get("received_at"),
        )
        for s in response.get("sources", [])
    ]

    msg_result = db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "assistant",
        "content": response["content"],
        "sources": [s.model_dump() for s in sources],
    }).execute()

    msg = msg_result.data[0]
    return ChatMessageResponse(
        id=msg["id"],
        session_id=session_id,
        role="assistant",
        content=msg["content"],
        sources=sources,
        created_at=msg["created_at"],
    )


async def _retrieve_context(message: str, user_id: str, rag: RAGService, nim: NIMService) -> list[dict]:
    msg_lower = message.lower()
    context = []

    sender_match = re.search(r"(?:from|by|emails from)\s+([A-Za-z0-9\s&.]+?)(?:\s+this|\s+last|\s+in|\?|$)", message, re.I)
    if sender_match:
        sender = sender_match.group(1).strip()
        days = None
        if "this month" in msg_lower:
            days = 30
        elif "this week" in msg_lower:
            days = 7
        elif "today" in msg_lower:
            days = 1
        context.extend(await rag.search_by_sender(sender, user_id, days))

    if any(kw in msg_lower for kw in ["reject", "rejection", "job application", "interview"]):
        context.extend(await rag.search_by_category("job_recruitment", user_id))

    if any(kw in msg_lower for kw in ["newsletter", "news", "tech news", "updates"]):
        newsletter_emails = await rag.search_by_category("newsletters", user_id)
        context.extend(newsletter_emails)

        if "news" in msg_lower or "digest" in msg_lower:
            ai = AIService()
            all_news = []
            for email in newsletter_emails[:10]:
                items = await ai.extract_news_items(
                    email.get("subject", ""),
                    email.get("body_text", email.get("snippet", "")),
                    email.get("sender", "Unknown"),
                )
                all_news.extend(items)

            if all_news:
                deduped = await nim.deduplicate_news_items(all_news)
                news_context = [{
                    "email_id": "news_digest",
                    "subject": "News Digest",
                    "sender": "Multiple Sources",
                    "chunk_text": "\n".join(
                        f"- {item['title']} (Sources: {', '.join(item.get('sources', [item.get('source_name', '')]))})"
                        for item in deduped
                    ),
                    "snippet": f"{len(deduped)} unique news items",
                }]
                context.extend(news_context)

    if not context:
        context = await rag.search(message, user_id, top_k=15)

    seen_ids = set()
    unique = []
    for item in context:
        eid = item.get("email_id", item.get("id", ""))
        if eid not in seen_ids:
            seen_ids.add(eid)
            unique.append(item)

    return unique[:20]


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("chat_sessions").select("*").eq(
        "user_id", user["id"]
    ).order("updated_at", desc=True).limit(20).execute()

    return [
        ChatSessionResponse(
            id=s["id"],
            title=s.get("title"),
            created_at=s["created_at"],
        )
        for s in (result.data or [])
    ]


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()

    session = db.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").execute()

    return ChatSessionResponse(
        id=session.data["id"],
        title=session.data.get("title"),
        created_at=session.data["created_at"],
        messages=[
            ChatMessageResponse(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                sources=[SourceReference(**s) for s in (m.get("sources") or [])],
                created_at=m["created_at"],
            )
            for m in (messages.data or [])
        ],
    )
