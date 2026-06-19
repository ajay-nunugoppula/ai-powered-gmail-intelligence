from datetime import UTC, datetime

from supabase import Client, create_client

from app.config import get_settings


def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError("Supabase is not configured")
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _maybe_single_data(result: object | None) -> dict | None:
    """Supabase maybe_single() returns None when no row exists (newer client versions)."""
    if result is None:
        return None
    return getattr(result, "data", None)


def get_profile(user_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("profiles")
        .select("id, email, display_name, avatar_url, gmail_connected, created_at")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)


def set_gmail_connected(user_id: str, connected: bool) -> None:
    client = get_supabase_client()
    client.table("profiles").update(
        {
            "gmail_connected": connected,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", user_id).execute()


def get_gmail_credentials(user_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("gmail_credentials")
        .select("user_id, refresh_token_enc, scopes, token_updated_at")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)


def upsert_gmail_credentials(
    user_id: str,
    refresh_token_enc: str,
    scopes: list[str],
) -> None:
    client = get_supabase_client()
    client.table("gmail_credentials").upsert(
        {
            "user_id": user_id,
            "refresh_token_enc": refresh_token_enc,
            "scopes": scopes,
            "token_updated_at": datetime.now(UTC).isoformat(),
        }
    ).execute()


def delete_gmail_credentials(user_id: str) -> None:
    client = get_supabase_client()
    client.table("gmail_credentials").delete().eq("user_id", user_id).execute()


def get_sync_state(user_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("sync_state")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)


def update_sync_state(
    user_id: str,
    *,
    status: str,
    progress_json: dict,
    history_id: str | None = None,
    last_sync_at: str | None = None,
) -> None:
    client = get_supabase_client()
    payload: dict = {
        "status": status,
        "progress_json": progress_json,
    }
    if history_id is not None:
        payload["history_id"] = history_id
    if last_sync_at is not None:
        payload["last_sync_at"] = last_sync_at

    if status == "syncing":
        progress_json = {
            **progress_json,
            "last_progress_at": datetime.now(UTC).isoformat(),
        }
    payload["progress_json"] = progress_json

    client.table("sync_state").update(payload).eq("user_id", user_id).execute()


def create_sync_job(user_id: str, job_type: str, payload: dict) -> str:
    client = get_supabase_client()
    result = (
        client.table("sync_jobs")
        .insert(
            {
                "user_id": user_id,
                "job_type": job_type,
                "status": "running",
                "payload": payload,
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def update_sync_job(job_id: str, status: str, error: str | None = None) -> None:
    client = get_supabase_client()
    payload: dict = {
        "status": status,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    if error:
        payload["error"] = error
    client.table("sync_jobs").update(payload).eq("id", job_id).execute()


def get_latest_running_sync_job(user_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("sync_jobs")
        .select("id, status, created_at, updated_at, job_type")
        .eq("user_id", user_id)
        .eq("status", "running")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def fail_running_sync_jobs(user_id: str, error: str) -> None:
    client = get_supabase_client()
    client.table("sync_jobs").update(
        {
            "status": "failed",
            "error": error,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("user_id", user_id).eq("status", "running").execute()


def get_category_id_by_slug(user_id: str, slug: str) -> str | None:
    client = get_supabase_client()
    result = (
        client.table("categories")
        .select("id")
        .eq("user_id", user_id)
        .eq("slug", slug)
        .maybe_single()
        .execute()
    )
    row = _maybe_single_data(result)
    if not row:
        return None
    return row["id"]


def upsert_thread(
    user_id: str,
    *,
    gmail_thread_id: str,
    subject: str | None,
    snippet: str | None,
    last_message_at: str,
    participant_emails: list[str],
) -> tuple[str, bool]:
    client = get_supabase_client()
    existing = (
        client.table("threads")
        .select("id, last_message_at")
        .eq("user_id", user_id)
        .eq("gmail_thread_id", gmail_thread_id)
        .maybe_single()
        .execute()
    )

    existing_row = _maybe_single_data(existing)
    if existing_row:
        thread_id = existing_row["id"]
        current_last = existing_row.get("last_message_at")
        if not current_last or last_message_at >= current_last:
            client.table("threads").update(
                {
                    "subject": subject,
                    "snippet": snippet,
                    "last_message_at": last_message_at,
                    "participant_emails": participant_emails,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", thread_id).execute()
        return thread_id, False

    result = (
        client.table("threads")
        .insert(
            {
                "user_id": user_id,
                "gmail_thread_id": gmail_thread_id,
                "subject": subject,
                "snippet": snippet,
                "last_message_at": last_message_at,
                "participant_emails": participant_emails,
                "message_count": 0,
            }
        )
        .execute()
    )
    return result.data[0]["id"], True


def upsert_message(
    user_id: str,
    *,
    thread_id: str,
    gmail_message_id: str,
    gmail_thread_id: str,
    from_email: str,
    to_emails: list[str],
    cc_emails: list[str],
    subject: str | None,
    body_text: str | None,
    body_html: str | None,
    received_at: str,
    labels: list[str],
    in_reply_to: str | None,
    references_header: str | None,
    is_read: bool,
) -> bool:
    client = get_supabase_client()
    payload = {
        "user_id": user_id,
        "thread_id": thread_id,
        "gmail_message_id": gmail_message_id,
        "gmail_thread_id": gmail_thread_id,
        "from_email": from_email,
        "to_emails": to_emails,
        "cc_emails": cc_emails,
        "subject": subject,
        "body_text": body_text,
        "body_html": body_html,
        "received_at": received_at,
        "labels": labels,
        "in_reply_to": in_reply_to,
        "references_header": references_header,
        "is_read": is_read,
    }

    existing = (
        client.table("messages")
        .select("id")
        .eq("user_id", user_id)
        .eq("gmail_message_id", gmail_message_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        client.table("messages").update(payload).eq("id", existing.data[0]["id"]).execute()
        return False

    client.table("messages").insert(payload).execute()
    return True


def bump_thread_stats(
    user_id: str,
    thread_id: str,
    *,
    received_at: str,
    participant_emails: list[str],
) -> None:
    """Incrementally update thread stats after a new message (avoids re-fetching all messages)."""
    client = get_supabase_client()
    thread_result = (
        client.table("threads")
        .select("message_count, participant_emails, last_message_at")
        .eq("id", thread_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    row = _maybe_single_data(thread_result)
    if not row:
        return

    current_count = row.get("message_count") or 0
    merged_participants = list(
        dict.fromkeys([*(row.get("participant_emails") or []), *participant_emails])
    )
    current_last = row.get("last_message_at")
    last_message_at = (
        received_at if not current_last or received_at >= current_last else current_last
    )

    client.table("threads").update(
        {
            "message_count": current_count + 1,
            "participant_emails": merged_participants,
            "last_message_at": last_message_at,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", thread_id).execute()


def refresh_thread_stats(user_id: str, thread_id: str) -> None:
    """Full recompute — use bump_thread_stats during sync for better performance."""
    client = get_supabase_client()
    messages = (
        client.table("messages")
        .select("id, received_at, from_email, to_emails, cc_emails")
        .eq("thread_id", thread_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = messages.data or []
    participants: list[str] = []
    last_message_at: str | None = None

    for row in rows:
        participants.extend([row["from_email"], *row.get("to_emails", []), *row.get("cc_emails", [])])
        received_at = row["received_at"]
        if not last_message_at or received_at > last_message_at:
            last_message_at = received_at

    client.table("threads").update(
        {
            "message_count": len(rows),
            "participant_emails": list(dict.fromkeys(p for p in participants if p)),
            "last_message_at": last_message_at,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", thread_id).execute()


def get_synced_gmail_message_ids(user_id: str) -> set[str]:
    client = get_supabase_client()
    ids: set[str] = set()
    offset = 0
    page_size = 1000

    while True:
        result = (
            client.table("messages")
            .select("gmail_message_id")
            .eq("user_id", user_id)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        ids.update(row["gmail_message_id"] for row in rows)
        if len(rows) < page_size:
            break
        offset += page_size

    return ids


def message_exists(user_id: str, gmail_message_id: str) -> bool:
    client = get_supabase_client()
    result = (
        client.table("messages")
        .select("id")
        .eq("user_id", user_id)
        .eq("gmail_message_id", gmail_message_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def count_threads(user_id: str) -> int:
    client = get_supabase_client()
    result = (
        client.table("threads")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return result.count or 0


def count_messages(user_id: str) -> int:
    client = get_supabase_client()
    result = (
        client.table("messages")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return result.count or 0


def list_threads(
    user_id: str,
    *,
    category_slug: str | None = None,
    search: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[dict], int]:
    client = get_supabase_client()
    offset = (page - 1) * limit

    query = (
        client.table("threads")
        .select("*, categories(name, slug, color)", count="exact")
        .eq("user_id", user_id)
        .order("last_message_at", desc=True)
    )

    if category_slug and category_slug != "all":
        category_id = get_category_id_by_slug(user_id, category_slug)
        if category_id:
            query = query.eq("category_id", category_id)
        else:
            return [], 0

    if search:
        query = query.or_(f"subject.ilike.%{search}%,snippet.ilike.%{search}%")

    result = query.range(offset, offset + limit - 1).execute()
    return result.data or [], result.count or 0


def get_thread_detail(user_id: str, thread_id: str) -> dict | None:
    client = get_supabase_client()
    thread_result = (
        client.table("threads")
        .select("*, categories(name, slug, color)")
        .eq("user_id", user_id)
        .eq("id", thread_id)
        .maybe_single()
        .execute()
    )
    thread_row = _maybe_single_data(thread_result)
    if not thread_row:
        return None

    messages_result = (
        client.table("messages")
        .select("*")
        .eq("user_id", user_id)
        .eq("thread_id", thread_id)
        .order("received_at", desc=False)
        .execute()
    )

    return {
        "thread": thread_row,
        "messages": messages_result.data or [],
    }


def list_categories(user_id: str) -> list[dict]:
    client = get_supabase_client()
    result = (
        client.table("categories")
        .select("id, name, slug, color, is_system")
        .eq("user_id", user_id)
        .order("name")
        .execute()
    )
    return result.data or []


def get_enrichment_progress(user_id: str) -> dict:
    state = get_sync_state(user_id) or {}
    progress = state.get("progress_json") or {}
    enrichment = progress.get("enrichment") or {}
    return {
        "status": enrichment.get("status", "idle"),
        "phase": enrichment.get("phase", "idle"),
        "total": enrichment.get("total", 0),
        "processed": enrichment.get("processed", 0),
        "error": enrichment.get("error"),
        "last_progress_at": enrichment.get("last_progress_at"),
    }


def update_enrichment_progress(user_id: str, enrichment: dict) -> None:
    state = get_sync_state(user_id) or {}
    progress = dict(state.get("progress_json") or {})
    enrichment = {
        **enrichment,
        "last_progress_at": datetime.now(UTC).isoformat(),
    }
    progress["enrichment"] = enrichment
    client = get_supabase_client()
    client.table("sync_state").update({"progress_json": progress}).eq("user_id", user_id).execute()


def list_messages_for_enrichment(user_id: str, *, limit: int = 50) -> list[dict]:
    client = get_supabase_client()
    result = (
        client.table("messages")
        .select(
            "id, thread_id, subject, from_email, body_text, received_at, "
            "message_summaries(summary), message_categories(category_id, confidence), "
            "message_embeddings(id)"
        )
        .eq("user_id", user_id)
        .order("received_at", desc=True)
        .limit(limit * 4)
        .execute()
    )

    pending: list[dict] = []
    for row in result.data or []:
        has_summary = bool(row.get("message_summaries"))
        has_category = bool(row.get("message_categories"))
        embeddings = row.get("message_embeddings")
        has_embedding = bool(embeddings) if not isinstance(embeddings, list) else len(embeddings) > 0
        if has_summary and has_category and has_embedding:
            continue
        pending.append(row)
        if len(pending) >= limit:
            break
    return pending


def count_messages_needing_enrichment(user_id: str) -> int:
    client = get_supabase_client()
    offset = 0
    page_size = 500
    count = 0

    while True:
        result = (
            client.table("messages")
            .select(
                "id, message_summaries(summary), message_categories(category_id), message_embeddings(id)"
            )
            .eq("user_id", user_id)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            has_summary = bool(row.get("message_summaries"))
            has_category = bool(row.get("message_categories"))
            embeddings = row.get("message_embeddings")
            has_embedding = (
                bool(embeddings) if not isinstance(embeddings, list) else len(embeddings) > 0
            )
            if not (has_summary and has_category and has_embedding):
                count += 1

        if len(rows) < page_size:
            break
        offset += page_size

    return count


def upsert_message_summary(message_id: str, summary: str, model: str) -> None:
    client = get_supabase_client()
    client.table("message_summaries").upsert(
        {
            "message_id": message_id,
            "summary": summary,
            "model": model,
        }
    ).execute()


def upsert_thread_summary(thread_id: str, summary: str, model: str) -> None:
    client = get_supabase_client()
    client.table("thread_summaries").upsert(
        {
            "thread_id": thread_id,
            "summary": summary,
            "model": model,
        }
    ).execute()
    client.table("threads").update(
        {
            "thread_summary": summary,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", thread_id).execute()


def upsert_message_category(
    message_id: str,
    category_id: str,
    confidence: float,
    model: str,
) -> None:
    client = get_supabase_client()
    client.table("message_categories").upsert(
        {
            "message_id": message_id,
            "category_id": category_id,
            "confidence": confidence,
            "model": model,
        }
    ).execute()


def assign_thread_category(thread_id: str, category_id: str) -> None:
    client = get_supabase_client()
    client.table("threads").update(
        {
            "category_id": category_id,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", thread_id).execute()


def upsert_message_embedding(
    *,
    message_id: str,
    user_id: str,
    chunk_index: int,
    chunk_text: str,
    embedding: list[float],
    metadata: dict | None = None,
) -> None:
    client = get_supabase_client()
    client.table("message_embeddings").upsert(
        {
            "message_id": message_id,
            "user_id": user_id,
            "chunk_index": chunk_index,
            "chunk_text": chunk_text,
            "embedding": embedding,
            "metadata": metadata or {},
        }
    ).execute()


def get_thread_messages_with_summaries(user_id: str, thread_id: str) -> list[dict]:
    client = get_supabase_client()
    result = (
        client.table("messages")
        .select("id, subject, received_at, message_summaries(summary)")
        .eq("user_id", user_id)
        .eq("thread_id", thread_id)
        .order("received_at", desc=False)
        .execute()
    )
    return result.data or []


def get_thread_subject(user_id: str, thread_id: str) -> str | None:
    client = get_supabase_client()
    result = (
        client.table("threads")
        .select("subject")
        .eq("user_id", user_id)
        .eq("id", thread_id)
        .maybe_single()
        .execute()
    )
    row = _maybe_single_data(result)
    return row.get("subject") if row else None


def get_message_summaries_for_thread(user_id: str, thread_id: str) -> list[str]:
    rows = get_thread_messages_with_summaries(user_id, thread_id)
    summaries: list[str] = []
    for row in rows:
        summary_row = row.get("message_summaries")
        if isinstance(summary_row, dict) and summary_row.get("summary"):
            summaries.append(summary_row["summary"])
    return summaries


def get_thread_detail_with_enrichment(user_id: str, thread_id: str) -> dict | None:
    detail = get_thread_detail(user_id, thread_id)
    if not detail:
        return None

    client = get_supabase_client()
    message_ids = [message["id"] for message in detail["messages"]]
    if not message_ids:
        return detail

    summaries_result = (
        client.table("message_summaries")
        .select("message_id, summary")
        .in_("message_id", message_ids)
        .execute()
    )
    categories_result = (
        client.table("message_categories")
        .select("message_id, confidence, categories(name, slug, color)")
        .in_("message_id", message_ids)
        .execute()
    )

    summary_map = {
        row["message_id"]: row["summary"] for row in summaries_result.data or []
    }
    category_map = {
        row["message_id"]: row for row in categories_result.data or []
    }

    enriched_messages = []
    for message in detail["messages"]:
        enriched = dict(message)
        enriched["summary"] = summary_map.get(message["id"])
        category_row = category_map.get(message["id"])
        if category_row:
            enriched["category"] = category_row.get("categories")
            enriched["category_confidence"] = category_row.get("confidence")
        enriched_messages.append(enriched)

    return {
        "thread": detail["thread"],
        "messages": enriched_messages,
    }


def get_message_by_id(user_id: str, message_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("messages")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", message_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)


def get_thread_row(user_id: str, thread_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("threads")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", thread_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)


def get_message_summary(message_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("message_summaries")
        .select("summary")
        .eq("message_id", message_id)
        .maybe_single()
        .execute()
    )
    return _maybe_single_data(result)
