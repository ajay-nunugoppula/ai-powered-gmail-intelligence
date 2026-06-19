from __future__ import annotations

import logging
import re

from app.config import Settings, get_settings
from app.services import supabase_client
from app.services.ai import nvidia

logger = logging.getLogger(__name__)

_QUERY_STOPWORDS = {
    "a",
    "an",
    "any",
    "are",
    "about",
    "did",
    "do",
    "email",
    "emails",
    "for",
    "from",
    "got",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "mail",
    "mails",
    "me",
    "my",
    "of",
    "on",
    "or",
    "regarding",
    "related",
    "show",
    "tell",
    "the",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
    "you",
    "your",
}

_CATEGORY_QUERY_HINTS: dict[str, list[str]] = {
    "work-professional": [
        "work",
        "professional",
        "office",
        "project",
        "colleague",
        "client",
        "meeting",
        "meetings",
    ],
    "job-recruitment": [
        "job",
        "recruitment",
        "interview",
        "hiring",
        "career",
        "recruiter",
        "application",
    ],
    "finance": ["finance", "financial", "bank", "payment", "invoice", "billing"],
    "newsletters": ["newsletter", "newsletters", "digest"],
    "personal": ["personal", "family", "friend"],
    "notifications": ["notification", "notifications", "alert", "alerts"],
}


def _extract_query_keywords(query: str) -> list[str]:
    words = re.findall(r"[a-zA-Z]{3,}", query.lower())
    return [word for word in words if word not in _QUERY_STOPWORDS]


def _keyword_variants(keyword: str) -> set[str]:
    variants = {keyword}
    if keyword.endswith("ies") and len(keyword) > 4:
        variants.add(keyword[:-3] + "y")
    if keyword.endswith("s") and len(keyword) > 3:
        variants.add(keyword[:-1])
    return variants


def _detect_category_slugs(query: str) -> list[str]:
    lowered = query.lower()
    found: list[str] = []
    for slug, hints in _CATEGORY_QUERY_HINTS.items():
        if any(re.search(rf"\b{re.escape(hint)}\b", lowered) for hint in hints):
            found.append(slug)
    return list(dict.fromkeys(found))


def _extract_search_terms(query: str) -> list[str]:
    keywords = _extract_query_keywords(query)
    terms: list[str] = []
    for keyword in keywords:
        terms.extend(_keyword_variants(keyword))
    return list(dict.fromkeys(terms))


def _chunk_search_text(chunk: dict) -> str:
    return " ".join(
        [
            chunk.get("subject") or "",
            chunk.get("from_email") or "",
            chunk.get("category_name") or "",
            chunk.get("chunk_text") or "",
        ]
    ).lower()


def _keyword_matches_chunk(chunk: dict, keyword: str) -> bool:
    haystack = _chunk_search_text(chunk)
    return any(
        re.search(rf"\b{re.escape(variant)}", haystack)
        for variant in _keyword_variants(keyword)
    )


def _filter_by_keywords(chunks: list[dict], keywords: list[str]) -> list[dict]:
    if not keywords:
        return chunks
    matched = [
        chunk
        for chunk in chunks
        if any(_keyword_matches_chunk(chunk, keyword) for keyword in keywords)
    ]
    return matched


def _message_to_chunk(message: dict, *, similarity: float) -> dict:
    body = (message.get("body_text") or message.get("subject") or "").strip()
    return {
        "message_id": message.get("id"),
        "thread_id": message.get("thread_id"),
        "subject": message.get("subject"),
        "from_email": message.get("from_email"),
        "received_at": message.get("received_at"),
        "chunk_text": body[:2000],
        "similarity": similarity,
    }


def _dedupe_by_message(chunks: list[dict]) -> list[dict]:
    best_by_message: dict[str, dict] = {}
    for chunk in chunks:
        message_id = chunk.get("message_id")
        if not message_id:
            continue
        existing = best_by_message.get(message_id)
        if not existing or (chunk.get("similarity") or 0) > (existing.get("similarity") or 0):
            best_by_message[message_id] = chunk
    deduped = list(best_by_message.values())
    deduped.sort(key=lambda row: row.get("similarity") or 0, reverse=True)
    return deduped


def _apply_similarity_cutoff(chunks: list[dict], *, max_chunks: int) -> list[dict]:
    if not chunks:
        return []
    top_score = chunks[0].get("similarity") or 0
    min_score = top_score - 0.12
    filtered = [chunk for chunk in chunks if (chunk.get("similarity") or 0) >= min_score]
    if not filtered:
        filtered = chunks[: min(5, len(chunks))]
    return filtered[:max_chunks]


def _reindex_chunks(chunks: list[dict]) -> list[dict]:
    reindexed: list[dict] = []
    for index, chunk in enumerate(chunks, start=1):
        reindexed.append({**chunk, "index": index})
    return reindexed


def _build_chunks_from_matches(
    matches: list[dict],
    message_lookup: dict[str, dict],
) -> list[dict]:
    chunks: list[dict] = []
    for row in matches:
        message_id = row.get("message_id")
        message = message_lookup.get(message_id or "", {})
        metadata = row.get("metadata") or {}
        chunk_text = (row.get("chunk_text") or "").strip()
        if not chunk_text:
            chunk_text = (message.get("body_text") or message.get("subject") or "").strip()
        chunks.append(
            {
                "embedding_id": row.get("id"),
                "message_id": message_id,
                "thread_id": message.get("thread_id"),
                "subject": message.get("subject") or metadata.get("subject"),
                "from_email": message.get("from_email") or metadata.get("from_email"),
                "received_at": message.get("received_at"),
                "chunk_text": chunk_text,
                "similarity": row.get("similarity"),
            }
        )
    chunks.sort(key=lambda row: row.get("similarity") or 0, reverse=True)
    return chunks


def _merge_chunk_lists(*chunk_lists: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for chunk_list in chunk_lists:
        merged.extend(chunk_list)
    return _dedupe_by_message(merged)


def _refine_chunks(
    chunks: list[dict],
    query: str,
    settings: Settings,
    *,
    apply_keyword_filter: bool,
) -> list[dict]:
    if not chunks:
        return []

    working = list(chunks)
    if apply_keyword_filter:
        keywords = _extract_query_keywords(query)
        if keywords:
            keyword_matches = _filter_by_keywords(working, keywords)
            if keyword_matches:
                working = keyword_matches

    working = _apply_similarity_cutoff(working, max_chunks=settings.rag_max_context_chunks)
    return _reindex_chunks(working)


def _retrieve_category_chunks(
    user_id: str,
    query: str,
    settings: Settings,
) -> list[dict]:
    chunks: list[dict] = []
    for slug in _detect_category_slugs(query):
        messages = supabase_client.list_messages_by_category_slug(
            user_id,
            slug,
            limit=settings.rag_max_context_chunks,
        )
        for message in messages:
            chunks.append(_message_to_chunk(message, similarity=0.92))
    return chunks


def _retrieve_text_search_chunks(user_id: str, query: str, settings: Settings) -> list[dict]:
    terms = _extract_search_terms(query)
    if not terms:
        return []
    messages = supabase_client.search_messages_by_terms(
        user_id,
        terms,
        limit=settings.rag_max_context_chunks,
    )
    return [_message_to_chunk(message, similarity=0.9) for message in messages]


def retrieve_email_context(
    user_id: str,
    query: str,
    settings: Settings | None = None,
) -> list[dict]:
    """Hybrid retrieval: vector similarity + category metadata + text search."""
    settings = settings or get_settings()
    if not settings.nvidia_api_key:
        raise RuntimeError("NVIDIA_API_KEY is not configured")

    vector_chunks: list[dict] = []
    vectors = nvidia.embed_texts([query], settings=settings, input_type="query")
    if vectors:
        matches = supabase_client.match_message_embeddings(
            user_id=user_id,
            query_embedding=vectors[0],
            match_count=settings.rag_match_count,
            match_threshold=settings.rag_match_threshold,
        )
        if matches:
            message_ids = list({row["message_id"] for row in matches if row.get("message_id")})
            message_lookup = supabase_client.get_messages_brief(user_id, message_ids)
            vector_chunks = _build_chunks_from_matches(matches, message_lookup)

    category_chunks = _retrieve_category_chunks(user_id, query, settings)
    text_chunks = _retrieve_text_search_chunks(user_id, query, settings)
    merged = _merge_chunk_lists(vector_chunks, category_chunks, text_chunks)

    use_keyword_filter = not category_chunks and not text_chunks
    chunks = _refine_chunks(merged, query, settings, apply_keyword_filter=use_keyword_filter)
    if not chunks and merged:
        chunks = _reindex_chunks(merged[: settings.rag_max_context_chunks])

    logger.info(
        "RAG retrieved %s chunks for user %s (vector=%s, category=%s, text=%s)",
        len(chunks),
        user_id,
        len(vector_chunks),
        len(category_chunks),
        len(text_chunks),
    )
    return chunks
