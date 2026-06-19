import logging
from datetime import UTC, datetime

from googleapiclient.errors import HttpError
from google.genai.errors import ClientError

from app.config import Settings, get_settings
from app.services.ai.compose import generate_email_draft
from app.services.email.repository import save_parsed_message
from app.services.gmail.client import build_gmail_service
from app.services.gmail.parser import parse_gmail_message
from app.services.gmail.sender import (
    build_raw_message,
    build_references_header,
    fetch_message_headers,
    send_gmail_message,
)
from app.services import supabase_client

logger = logging.getLogger(__name__)


def _format_ai_error(exc: Exception) -> str:
    if isinstance(exc, ClientError) and "429" in str(exc):
        return (
            "Gemini API quota exhausted. Add credits in Google AI Studio or try again later."
        )
    if isinstance(exc, HttpError) and exc.resp and exc.resp.status == 403:
        return "Gmail send permission denied. Reconnect Gmail and grant send access."
    return str(exc)


def _reply_recipients(message: dict, user_email: str) -> list[str]:
    from_email = (message.get("from_email") or "").strip().lower()
    user = user_email.strip().lower()
    if from_email and from_email != user:
        return [message["from_email"]]
    return [email for email in message.get("to_emails") or [] if email.lower() != user]


def _reply_subject(subject: str | None) -> str:
    value = (subject or "").strip()
    if not value:
        return "Re: (No subject)"
    if value.lower().startswith("re:"):
        return value
    return f"Re: {value}"


def _conversation_lines(messages: list[dict]) -> list[str]:
    lines: list[str] = []
    for message in messages[-5:]:
        summary = message.get("summary")
        body = message.get("body_text") or ""
        preview = summary or (body[:240] + "…" if len(body) > 240 else body)
        lines.append(
            f"- {message.get('from_email')}: {preview or '(empty message)'}"
        )
    return lines


def generate_draft(
    user_id: str,
    *,
    mode: str,
    thread_id: str | None = None,
    message_id: str | None = None,
    to: list[str] | None = None,
    cc: list[str] | None = None,
    subject: str | None = None,
    tone: str = "professional",
    instructions: str | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    profile = supabase_client.get_profile(user_id)
    if not profile:
        raise ValueError("Profile not found")

    user_email = profile["email"]
    draft_to = list(to or [])
    draft_cc = list(cc or [])
    draft_subject = subject
    thread_subject = None
    thread_summary = None
    reply_message = None
    conversation_context: list[str] = []

    if mode == "reply":
        if not message_id:
            raise ValueError("message_id is required for reply mode")
        reply_message = supabase_client.get_message_by_id(user_id, message_id)
        if not reply_message:
            raise ValueError("Message not found")

        thread_id = thread_id or reply_message["thread_id"]
        thread = supabase_client.get_thread_row(user_id, thread_id)
        if not thread:
            raise ValueError("Thread not found")

        thread_subject = thread.get("subject")
        thread_summary = thread.get("thread_summary")
        draft_to = _reply_recipients(reply_message, user_email)
        draft_subject = _reply_subject(reply_message.get("subject") or thread_subject)

        detail = supabase_client.get_thread_detail_with_enrichment(user_id, thread_id)
        if detail:
            conversation_context = _conversation_lines(detail["messages"])

        summary_row = supabase_client.get_message_summary(message_id)

        draft = generate_email_draft(
            mode="reply",
            user_email=user_email,
            to=draft_to,
            cc=draft_cc,
            subject=draft_subject,
            tone=tone,
            instructions=instructions,
            thread_subject=thread_subject,
            thread_summary=thread_summary,
            reply_to_from=reply_message.get("from_email"),
            reply_to_body=reply_message.get("body_text"),
            reply_to_summary=summary_row.get("summary") if summary_row else None,
            conversation_context=conversation_context,
            settings=settings,
        )
    else:
        draft = generate_email_draft(
            mode="compose",
            user_email=user_email,
            to=draft_to,
            cc=draft_cc,
            subject=draft_subject,
            tone=tone,
            instructions=instructions,
            settings=settings,
        )

    return {
        "mode": mode,
        "thread_id": thread_id,
        "message_id": message_id,
        "subject": draft["subject"],
        "body": draft["body"],
        "to": draft["to"],
        "cc": draft["cc"],
    }


def _persist_sent_message(
    user_id: str,
    service: object,
    *,
    gmail_message_id: str,
    profile: dict,
    to: list[str],
    cc: list[str] | None,
    subject: str,
    body: str,
    local_thread_id: str | None,
    gmail_thread_id: str | None,
    in_reply_to: str | None,
    references: str | None,
) -> tuple[str | None, str | None]:
    """Save a sent message to the local inbox so it appears in the thread view."""
    try:
        full_message = (
            service.users()
            .messages()
            .get(userId="me", id=gmail_message_id, format="full")
            .execute()
        )
        parsed = parse_gmail_message(full_message)
        save_parsed_message(user_id, parsed)
    except Exception:
        logger.exception(
            "Failed to fetch sent Gmail message %s; saving locally from send payload",
            gmail_message_id,
        )
        if not local_thread_id:
            return None, None

        participants = [profile["email"], *to, *(cc or [])]
        received_at = datetime.now(UTC).isoformat()
        is_new = supabase_client.upsert_message(
            user_id=user_id,
            thread_id=local_thread_id,
            gmail_message_id=gmail_message_id,
            gmail_thread_id=gmail_thread_id or "",
            from_email=profile["email"],
            to_emails=to,
            cc_emails=cc or [],
            subject=subject.strip(),
            body_text=body.strip(),
            body_html=None,
            received_at=received_at,
            labels=["SENT"],
            in_reply_to=in_reply_to,
            references_header=references,
            is_read=True,
        )
        if is_new:
            supabase_client.bump_thread_stats(
                user_id,
                local_thread_id,
                received_at=received_at,
                participant_emails=participants,
            )

    saved = supabase_client.get_message_by_gmail_id(user_id, gmail_message_id)
    if saved:
        return saved.get("thread_id"), saved.get("id")
    return local_thread_id, None


def send_email(
    user_id: str,
    *,
    to: list[str],
    cc: list[str] | None,
    subject: str,
    body: str,
    thread_id: str | None = None,
    reply_to_message_id: str | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    profile = supabase_client.get_profile(user_id)
    if not profile:
        raise ValueError("Profile not found")
    if not profile.get("gmail_connected"):
        raise ValueError("Gmail is not connected")

    if not to:
        raise ValueError("At least one recipient is required")
    if not subject.strip():
        raise ValueError("Subject is required")
    if not body.strip():
        raise ValueError("Body is required")

    service = build_gmail_service(user_id, settings)
    gmail_thread_id = None
    local_thread_id = thread_id
    in_reply_to = None
    references = None
    thread = None

    if reply_to_message_id:
        reply_message = supabase_client.get_message_by_id(user_id, reply_to_message_id)
        if not reply_message:
            raise ValueError("Reply message not found")

        resolved_thread_id = thread_id or reply_message["thread_id"]
        thread = supabase_client.get_thread_row(user_id, resolved_thread_id)
        if not thread:
            raise ValueError("Thread not found")

        local_thread_id = resolved_thread_id
        gmail_thread_id = thread["gmail_thread_id"]
        headers = fetch_message_headers(
            service,
            reply_message["gmail_message_id"],
            ["Message-ID", "References"],
        )
        in_reply_to = headers.get("Message-ID")
        references = build_references_header(
            reply_message.get("references_header"),
            in_reply_to,
        )
    elif thread_id:
        thread = supabase_client.get_thread_row(user_id, thread_id)
        if thread:
            gmail_thread_id = thread["gmail_thread_id"]

    raw = build_raw_message(
        from_email=profile["email"],
        to=to,
        cc=cc,
        subject=subject.strip(),
        body_text=body.strip(),
        in_reply_to=in_reply_to,
        references=references,
    )

    try:
        result = send_gmail_message(
            service,
            raw_message=raw,
            gmail_thread_id=gmail_thread_id,
        )
    except HttpError as exc:
        raise ValueError(_format_ai_error(exc)) from exc

    gmail_message_id = result.get("id")
    saved_thread_id = local_thread_id
    saved_message_id = None

    if gmail_message_id:
        saved_thread_id, saved_message_id = _persist_sent_message(
            user_id,
            service,
            gmail_message_id=gmail_message_id,
            profile=profile,
            to=to,
            cc=cc,
            subject=subject,
            body=body,
            local_thread_id=local_thread_id,
            gmail_thread_id=result.get("threadId") or gmail_thread_id,
            in_reply_to=in_reply_to,
            references=references,
        )

    return {
        "gmail_message_id": gmail_message_id,
        "gmail_thread_id": result.get("threadId"),
        "thread_id": saved_thread_id,
        "message_id": saved_message_id,
        "message": "Email sent successfully",
    }
