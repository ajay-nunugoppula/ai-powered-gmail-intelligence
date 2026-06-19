import logging
import time

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3


def embed_texts(
    texts: list[str],
    settings: Settings | None = None,
    *,
    input_type: str = "passage",
) -> list[list[float]]:
    """Generate embeddings via NVIDIA NIM (OpenAI-compatible /v1/embeddings).

    Use input_type='passage' when indexing documents, 'query' when searching.
    """
    settings = settings or get_settings()
    if not settings.nvidia_api_key:
        raise RuntimeError("NVIDIA_API_KEY is not configured")

    if not texts:
        return []

    # Index one text at a time — more reliable on free tier and long email chunks.
    return [
        _embed_single(text, settings, input_type=input_type)
        for text in texts
    ]


def _embed_single(
    text: str,
    settings: Settings,
    *,
    input_type: str,
) -> list[float]:
    url = f"{settings.nvidia_nim_base_url.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.nvidia_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "input": [text],
        "model": settings.nvidia_embed_model,
        "input_type": input_type,
        "modality": "text",
        "encoding_format": "float",
        "truncate": "END",
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, headers=headers, json=payload)

            if response.status_code >= 400:
                detail = response.text[:500]
                logger.error(
                    "NVIDIA embeddings failed (%s, model=%s): %s",
                    response.status_code,
                    settings.nvidia_embed_model,
                    detail,
                )
                if response.status_code == 404:
                    raise RuntimeError(
                        f"NVIDIA embedding model not found: {settings.nvidia_embed_model}. "
                        "Set NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5 in backend/.env "
                        "and restart the server."
                    ) from None
                response.raise_for_status()

            data = response.json()
            rows = data.get("data") or []
            if not rows or not rows[0].get("embedding"):
                raise RuntimeError("NVIDIA embeddings response missing vector data")
            return rows[0]["embedding"]
        except (httpx.HTTPError, RuntimeError) as exc:
            last_error = exc
            if attempt < _MAX_RETRIES - 1:
                time.sleep(2**attempt)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("NVIDIA embedding request failed")
