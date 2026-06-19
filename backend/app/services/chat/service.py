from __future__ import annotations

import re

from google.genai.errors import ClientError

from app.config import Settings, get_settings
from app.services.ai import chat as chat_ai
from app.services.ai import rag
from app.services import supabase_client


def _format_ai_error(exc: Exception) -> str:
    if isinstance(exc, ClientError) and "429" in str(exc):
        return (
            "Gemini API quota exhausted. Add credits in Google AI Studio or try again later."
        )
    return str(exc)


def _session_item(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row.get("title") or "New conversation",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _message_item(row: dict) -> dict:
    citations = row.get("citations") or []
    if isinstance(citations, list):
        normalized = []
        for citation in citations:
            if isinstance(citation, dict):
                normalized.append(citation)
        citations = normalized
    else:
        citations = []

    return {
        "id": row["id"],
        "role": row["role"],
        "content": row["content"],
        "citations": citations,
        "created_at": row["created_at"],
    }


def _chunks_to_citations(chunks: list[dict]) -> list[dict]:
    citations: list[dict] = []
    for chunk in chunks:
        snippet = (chunk.get("chunk_text") or "").strip()
        if len(snippet) > 180:
            snippet = snippet[:180] + "…"
        citations.append(
            {
                "index": chunk["index"],
                "message_id": chunk["message_id"],
                "thread_id": chunk.get("thread_id"),
                "subject": chunk.get("subject"),
                "from_email": chunk.get("from_email"),
                "snippet": snippet or None,
                "similarity": chunk.get("similarity"),
            }
        )
    return citations


def _parse_cited_indices(response: str) -> set[int]:
    indices: set[int] = set()
    for match in re.finditer(r"\[([^\]]+)\]", response):
        for part in re.split(r"[,;\s]+", match.group(1)):
            part = part.strip()
            if part.isdigit():
                indices.add(int(part))
    return indices


def _citations_for_response(chunks: list[dict], response: str) -> list[dict]:
    all_citations = _chunks_to_citations(chunks)
    cited_indices = _parse_cited_indices(response)
    if cited_indices:
        return [citation for citation in all_citations if citation["index"] in cited_indices]
    if all_citations:
        return all_citations[: min(3, len(all_citations))]
    return []


def _auto_title(content: str) -> str:
    cleaned = " ".join(content.strip().split())
    if len(cleaned) <= 60:
        return cleaned or "New conversation"
    return cleaned[:57] + "…"


def list_sessions(user_id: str) -> list[dict]:
    return [_session_item(row) for row in supabase_client.list_chat_sessions(user_id)]


def create_session(user_id: str, title: str | None = None) -> dict:
    row = supabase_client.create_chat_session(
        user_id,
        title=title or "New conversation",
    )
    return _session_item(row)


def get_session_detail(user_id: str, session_id: str) -> dict | None:
    session = supabase_client.get_chat_session(user_id, session_id)
    if not session:
        return None
    messages = supabase_client.list_chat_messages(session_id)
    return {
        "session": _session_item(session),
        "messages": [_message_item(row) for row in messages],
    }


def delete_session(user_id: str, session_id: str) -> bool:
    return supabase_client.delete_chat_session(user_id, session_id)


def send_message(
    user_id: str,
    session_id: str,
    content: str,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    session = supabase_client.get_chat_session(user_id, session_id)
    if not session:
        raise ValueError("Chat session not found")

    question = content.strip()
    if not question:
        raise ValueError("Message cannot be empty")

    prior_messages = supabase_client.list_chat_messages(
        session_id,
        limit=settings.chat_history_limit,
    )
    history = [
        {"role": row["role"], "content": row["content"]}
        for row in prior_messages
        if row.get("role") in {"user", "assistant"}
    ]

    user_row = supabase_client.insert_chat_message(
        session_id=session_id,
        role="user",
        content=question,
    )

    if len(prior_messages) == 0:
        supabase_client.update_chat_session_title(
            user_id,
            session_id,
            _auto_title(question),
        )

    embedding_count = supabase_client.count_message_embeddings(user_id)
    if embedding_count == 0:
        assistant_text = (
            "Your inbox is not indexed for search yet. Sync Gmail, then click "
            '"Analyze inbox" in the thread list to generate embeddings before chatting.'
        )
        citations: list[dict] = []
    else:
        try:
            chunks = rag.retrieve_email_context(user_id, question, settings=settings)
            assistant_text = chat_ai.generate_chat_reply(
                user_question=question,
                context_chunks=chunks,
                history=history,
                inbox_indexed=True,
                settings=settings,
            )
            citations = _citations_for_response(chunks, assistant_text)
        except Exception as exc:
            raise RuntimeError(_format_ai_error(exc)) from exc

    assistant_row = supabase_client.insert_chat_message(
        session_id=session_id,
        role="assistant",
        content=assistant_text,
        citations=citations,
    )

    return {
        "user_message": _message_item(user_row),
        "assistant_message": _message_item(assistant_row),
    }
