import json
import re

from app.config import Settings
from app.services.ai.gemini import _clip, _generate_content, _require_settings

TONE_GUIDANCE = {
    "professional": "Use a polite, professional business tone.",
    "friendly": "Use a warm, friendly but still professional tone.",
    "concise": "Be brief and direct. Prefer short paragraphs or bullet points.",
}


def _parse_draft_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise RuntimeError(f"Could not parse compose response: {raw}") from None
        return json.loads(match.group())


def generate_email_draft(
    *,
    mode: str,
    user_email: str,
    to: list[str],
    cc: list[str] | None,
    subject: str | None,
    tone: str,
    instructions: str | None,
    thread_subject: str | None = None,
    thread_summary: str | None = None,
    reply_to_from: str | None = None,
    reply_to_body: str | None = None,
    reply_to_summary: str | None = None,
    conversation_context: list[str] | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = _require_settings(settings)
    tone_text = TONE_GUIDANCE.get(tone, TONE_GUIDANCE["professional"])
    context_lines = "\n".join(conversation_context or []) or "- (No prior context)"

    if mode == "reply":
        prompt = f"""Draft a reply email for the signed-in user.

User email: {user_email}
Reply to: {reply_to_from or "(unknown sender)"}
Thread subject: {thread_subject or subject or "(No subject)"}
Thread summary: {thread_summary or "(none)"}

Email being replied to:
{_clip(reply_to_body, 6000)}

AI summary of that email:
{reply_to_summary or "(none)"}

Recent conversation context:
{context_lines}

Tone: {tone_text}
Extra instructions: {instructions or "(none)"}

Return JSON only:
{{
  "subject": "Re: ...",
  "body": "full plain-text email body with greeting and sign-off",
  "to": ["recipient@example.com"],
  "cc": []
}}

Rules:
- Do not invent facts not supported by the thread.
- Keep the body ready to send with a natural sign-off from the user.
- "to" should contain the primary recipient email(s).
"""
    else:
        prompt = f"""Draft a new outbound email for the signed-in user.

User email: {user_email}
Recipients (to): {", ".join(to) if to else "(user will fill in)"}
CC: {", ".join(cc or []) or "(none)"}
Subject: {subject or "(suggest an appropriate subject)"}

Tone: {tone_text}
Extra instructions: {instructions or "(none)"}

Return JSON only:
{{
  "subject": "...",
  "body": "full plain-text email body with greeting and sign-off",
  "to": {json.dumps(to)},
  "cc": {json.dumps(cc or [])}
}}
"""

    raw = _generate_content(settings, prompt, json_mode=True, max_output_tokens=1024)
    data = _parse_draft_json(raw)

    draft_to = [str(email).strip() for email in data.get("to", to) if str(email).strip()]
    draft_cc = [str(email).strip() for email in data.get("cc", cc or []) if str(email).strip()]
    draft_subject = str(data.get("subject") or subject or "").strip()
    draft_body = str(data.get("body") or "").strip()

    if not draft_body:
        raise RuntimeError("Gemini returned an empty email draft")

    if mode == "reply" and not draft_to and to:
        draft_to = to

    return {
        "subject": draft_subject,
        "body": draft_body,
        "to": draft_to,
        "cc": draft_cc,
    }
