import json
import logging
import re

from google import genai
from google.genai import types

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_MAX_INPUT_CHARS = 12_000
_client: genai.Client | None = None
_client_api_key: str | None = None


def _get_client(settings: Settings) -> genai.Client:
    global _client, _client_api_key
    if _client is None or _client_api_key != settings.gemini_api_key:
        _client = genai.Client(api_key=settings.gemini_api_key)
        _client_api_key = settings.gemini_api_key
    return _client


def _require_settings(settings: Settings | None = None) -> Settings:
    settings = settings or get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return settings


def _clip(text: str | None, limit: int = _MAX_INPUT_CHARS) -> str:
    value = (text or "").strip()
    if len(value) <= limit:
        return value
    return value[:limit] + "…"


def _generate_content(
    settings: Settings,
    prompt: str,
    *,
    json_mode: bool = False,
    max_output_tokens: int = 512,
) -> str:
    config_kwargs: dict = {
        "temperature": 0.0 if json_mode else 0.2,
        "max_output_tokens": max_output_tokens,
    }
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"

    response = _get_client(settings).models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text


def summarize_message(
    *,
    subject: str | None,
    from_email: str,
    body_text: str | None,
    settings: Settings | None = None,
) -> str:
    settings = _require_settings(settings)
    prompt = f"""Summarize this email in 2-3 concise sentences. Focus on action items, deadlines, and key facts.

Subject: {subject or "(No subject)"}
From: {from_email}

Body:
{_clip(body_text)}
"""
    return _generate_content(settings, prompt)


def summarize_thread(
    *,
    subject: str | None,
    message_summaries: list[str],
    settings: Settings | None = None,
) -> str:
    settings = _require_settings(settings)
    joined = "\n".join(f"- {summary}" for summary in message_summaries if summary)
    prompt = f"""Create a concise thread summary (3-5 sentences) for this email conversation.
Capture the overall topic, outcome, and any open actions.

Subject: {subject or "(No subject)"}

Message summaries:
{joined or "- (No message summaries available)"}
"""
    return _generate_content(settings, prompt)


def _parse_categorization(raw: str, valid_slugs: set[str]) -> tuple[str, float]:
    """Parse slug/confidence from Gemini JSON, including truncated or prose responses."""
    text = raw.strip()
    brace = text.find("{")
    if brace > 0:
        text = text[brace:]

    data: dict | None = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                data = None

    if data:
        slug = str(data.get("slug", "")).strip()
        try:
            confidence = float(data.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
    else:
        slug_match = re.search(r'"slug"\s*:\s*"([^"]+)"', text)
        conf_match = re.search(r'"confidence"\s*:\s*([0-9.]+)', text)
        slug = slug_match.group(1).strip() if slug_match else ""
        confidence = float(conf_match.group(1)) if conf_match else 0.5

        if not slug:
            lowered = raw.lower()
            for candidate in valid_slugs:
                if candidate in lowered:
                    slug = candidate
                    break

        if not slug:
            slug = "notifications"
            confidence = 0.4
            logger.warning("Could not parse categorization response: %s", raw[:120])
        elif slug not in valid_slugs:
            logger.warning("Partial categorization parse for response: %s", raw[:120])

    if slug not in valid_slugs:
        slug = "notifications"
        confidence = min(confidence, 0.4)

    return slug, max(0.0, min(confidence, 1.0))


def categorize_message(
    *,
    subject: str | None,
    from_email: str,
    body_text: str | None,
    categories: list[dict],
    settings: Settings | None = None,
) -> tuple[str, float]:
    settings = _require_settings(settings)
    category_lines = "\n".join(
        f'- slug: "{cat["slug"]}", name: "{cat["name"]}"' for cat in categories
    )
    prompt = f"""Classify this email into exactly one category slug from the list below.

Categories:
{category_lines}

Reply with JSON only (no markdown):
{{"slug":"<category-slug>","confidence":0.85}}

Subject: {subject or "(No subject)"}
From: {from_email}
Body excerpt:
{_clip(body_text, 1500)}
"""
    raw = _generate_content(settings, prompt, json_mode=True, max_output_tokens=128)
    valid_slugs = {cat["slug"] for cat in categories}
    return _parse_categorization(raw, valid_slugs)
