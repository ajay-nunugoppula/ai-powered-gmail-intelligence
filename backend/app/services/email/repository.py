from app.services.gmail.parser import ParsedMessage
from app.services import supabase_client


def save_parsed_message(
    user_id: str,
    parsed: ParsedMessage,
    *,
    thread_cache: dict[str, str] | None = None,
) -> tuple[str, bool]:
    participants = _participants(parsed)
    received_at = parsed.received_at.isoformat()

    cache = thread_cache if thread_cache is not None else {}
    thread_id = cache.get(parsed.gmail_thread_id)
    new_thread = False
    if not thread_id:
        thread_id, new_thread = supabase_client.upsert_thread(
            user_id=user_id,
            gmail_thread_id=parsed.gmail_thread_id,
            subject=parsed.subject,
            snippet=parsed.snippet,
            last_message_at=received_at,
            participant_emails=participants,
        )
        cache[parsed.gmail_thread_id] = thread_id

    is_new = supabase_client.upsert_message(
        user_id=user_id,
        thread_id=thread_id,
        gmail_message_id=parsed.gmail_message_id,
        gmail_thread_id=parsed.gmail_thread_id,
        from_email=parsed.from_email,
        to_emails=parsed.to_emails,
        cc_emails=parsed.cc_emails,
        subject=parsed.subject,
        body_text=parsed.body_text,
        body_html=parsed.body_html,
        received_at=received_at,
        labels=parsed.labels,
        in_reply_to=parsed.in_reply_to,
        references_header=parsed.references_header,
        is_read=parsed.is_read,
    )

    if is_new:
        supabase_client.bump_thread_stats(
            user_id,
            thread_id,
            received_at=received_at,
            participant_emails=participants,
        )

    return thread_id, new_thread


def _participants(parsed: ParsedMessage) -> list[str]:
    participants = [parsed.from_email, *parsed.to_emails, *parsed.cc_emails]
    return list(dict.fromkeys(email for email in participants if email))
