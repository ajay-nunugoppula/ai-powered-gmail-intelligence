import base64
from email.mime.text import MIMEText
from typing import Any

from googleapiclient.discovery import Resource


def fetch_message_headers(
    service: Resource,
    gmail_message_id: str,
    header_names: list[str],
) -> dict[str, str]:
    result = (
        service.users()
        .messages()
        .get(
            userId="me",
            id=gmail_message_id,
            format="metadata",
            metadataHeaders=header_names,
        )
        .execute()
    )
    headers: dict[str, str] = {}
    for header in result.get("payload", {}).get("headers", []):
        name = header.get("name", "")
        if name in header_names:
            headers[name] = header.get("value", "")
    return headers


def build_references_header(
    existing_references: str | None,
    message_id: str | None,
) -> str | None:
    parts: list[str] = []
    if existing_references:
        parts.extend(existing_references.split())
    if message_id and message_id not in parts:
        parts.append(message_id)
    return " ".join(parts) if parts else message_id


def build_raw_message(
    *,
    from_email: str,
    to: list[str],
    cc: list[str] | None,
    subject: str,
    body_text: str,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> str:
    message = MIMEText(body_text, "plain", "utf-8")
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    message["From"] = from_email
    message["Subject"] = subject
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
    if references:
        message["References"] = references
    return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")


def send_gmail_message(
    service: Resource,
    *,
    raw_message: str,
    gmail_thread_id: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"raw": raw_message}
    if gmail_thread_id:
        body["threadId"] = gmail_thread_id
    return service.users().messages().send(userId="me", body=body).execute()
