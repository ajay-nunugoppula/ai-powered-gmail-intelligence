import logging
from datetime import UTC, datetime

from app.config import get_settings
from app.services import supabase_client

logger = logging.getLogger(__name__)

INTERRUPTED_MESSAGE = (
    "Sync was interrupted (server restart or timeout). Click sync to continue."
)


def _parse_timestamp(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def reconcile_stale_sync_state(user_id: str) -> bool:
    """Mark orphaned in-progress syncs as failed. Returns True if state was updated."""
    state = supabase_client.get_sync_state(user_id)
    if not state or state.get("status") != "syncing":
        return False

    stale_seconds = get_settings().sync_stale_seconds
    now = datetime.now(UTC)
    progress = dict(state.get("progress_json") or {})
    last_progress_at = _parse_timestamp(progress.get("last_progress_at", ""))

    if last_progress_at is not None:
        is_stale = (now - last_progress_at).total_seconds() > stale_seconds
    else:
        running_job = supabase_client.get_latest_running_sync_job(user_id)
        if not running_job:
            is_stale = True
        else:
            job_started = _parse_timestamp(running_job.get("created_at", ""))
            is_stale = (
                job_started is None
                or (now - job_started).total_seconds() > stale_seconds
            )

    if not is_stale:
        return False

    logger.warning("Reconciling stale sync state for user %s", user_id)
    progress["error"] = INTERRUPTED_MESSAGE
    progress["phase"] = "interrupted"
    supabase_client.update_sync_state(user_id, status="failed", progress_json=progress)
    supabase_client.fail_running_sync_jobs(user_id, INTERRUPTED_MESSAGE)
    return True
