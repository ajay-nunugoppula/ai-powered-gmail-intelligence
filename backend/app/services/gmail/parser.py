import base64
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime


@dataclass
class ParsedMessage:
    gmail_message_id: str
    gmail_thread_id: str
    from_email: str
    to_emails: list[str]
    cc_emails: list[str]
    subject: str | None
    body_text: str | None
    body_html: str | None
    received_at: datetime
    labels: list[str]
    in_reply_to: str | None
    references_header: str | None
    is_read: bool
    snippet: str | None


def _get_header(headers: list[dict], name: str) -> str | None:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value")
    return None


def _decode_body(data: str | None) -> str | None:
    if not data:
        return None
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    except Exception:
        return None


def _strip_html(html: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _extract_bodies(payload: dict) -> tuple[str | None, str | None]:
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data")
    text_body: str | None = None
    html_body: str | None = None

    if mime_type == "text/plain":
        text_body = _decode_body(body_data)
    elif mime_type == "text/html":
        html_body = _decode_body(body_data)

    for part in payload.get("parts", []) or []:
        part_text, part_html = _extract_bodies(part)
        if part_text and not text_body:
            text_body = part_text
        if part_html and not html_body:
            html_body = part_html

    if not text_body and html_body:
        text_body = _strip_html(html_body)

    return text_body, html_body


def _parse_addresses(value: str | None) -> list[str]:
    if not value:
        return []
    emails = re.findall(r"[\w.+-]+@[\w.-]+\.\w+", value)
    return list(dict.fromkeys(emails))


def _parse_from(value: str | None) -> str:
    if not value:
        return "unknown@unknown.local"
    emails = _parse_addresses(value)
    return emails[0] if emails else value.strip()


def _parse_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except Exception:
        return datetime.now(UTC)


def parse_gmail_message(message: dict) -> ParsedMessage:
    payload = message.get("payload", {})
    headers = payload.get("headers", [])
    body_text, body_html = _extract_bodies(payload)
    labels = message.get("labelIds", []) or []

    return ParsedMessage(
        gmail_message_id=message["id"],
        gmail_thread_id=message["threadId"],
        from_email=_parse_from(_get_header(headers, "From")),
        to_emails=_parse_addresses(_get_header(headers, "To")),
        cc_emails=_parse_addresses(_get_header(headers, "Cc")),
        subject=_get_header(headers, "Subject"),
        body_text=body_text,
        body_html=body_html,
        received_at=_parse_date(_get_header(headers, "Date")),
        labels=labels,
        in_reply_to=_get_header(headers, "In-Reply-To"),
        references_header=_get_header(headers, "References"),
        is_read="UNREAD" not in labels,
        snippet=message.get("snippet"),
    )
