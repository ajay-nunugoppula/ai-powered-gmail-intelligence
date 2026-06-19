from __future__ import annotations

from app.config import Settings
from app.services.ai.gemini import _clip, _generate_content, _require_settings


def _format_context_block(chunk: dict) -> str:
    subject = chunk.get("subject") or "(No subject)"
    sender = chunk.get("from_email") or "(unknown sender)"
    received = chunk.get("received_at") or "(unknown date)"
    body = _clip(chunk.get("chunk_text"), 1200)
    return (
        f"[{chunk['index']}] Subject: {subject}\n"
        f"From: {sender}\n"
        f"Date: {received}\n"
        f"Excerpt:\n{body}"
    )


def _format_history(history: list[dict]) -> str:
    if not history:
        return "(No prior messages in this conversation)"
    lines: list[str] = []
    for message in history:
        role = message.get("role", "user").capitalize()
        content = _clip(message.get("content"), 1500)
        lines.append(f"{role}: {content}")
    return "\n\n".join(lines)


def generate_chat_reply(
    *,
    user_question: str,
    context_chunks: list[dict],
    history: list[dict],
    inbox_indexed: bool = True,
    settings: Settings | None = None,
) -> str:
    settings = _require_settings(settings)
    if context_chunks:
        context_text = "\n\n".join(_format_context_block(chunk) for chunk in context_chunks)
        context_section = f"""Relevant email excerpts from the user's inbox:
{context_text}

Rules:
- Answer using only the excerpts and conversation history above.
- Cite sources inline with [1], [2], etc. matching excerpt numbers.
- Only cite excerpts you actually used in your answer.
- If the excerpts do not contain enough information, say so clearly.
- Do not invent senders, dates, or email content."""
    elif inbox_indexed:
        context_section = """No closely matching email excerpts were retrieved for this question.
The user's inbox IS already synced and indexed.
Do NOT say the inbox is unindexed, unsynced, or that the user needs to run Analyze inbox.
Instead, explain that you could not find relevant emails for this query and suggest rephrasing with a sender, company, subject, or date."""
    else:
        context_section = """The user's inbox is not indexed for search yet.
Tell them to sync Gmail, then run "Analyze inbox" before chatting."""

    prompt = f"""You are an AI assistant helping the user understand their Gmail inbox.
Be concise, accurate, and helpful.

{context_section}

Conversation history:
{_format_history(history)}

User question:
{user_question.strip()}
"""
    return _generate_content(settings, prompt, max_output_tokens=1024)
