import logging
import time
from datetime import UTC, datetime, timedelta

from googleapiclient.errors import HttpError

from app.config import Settings, get_settings
from app.services.email.repository import save_parsed_message
from app.services.gmail.client import build_gmail_service
from app.services.gmail.parser import parse_gmail_message
from app.services.gmail.rate_limiter import GmailRateLimiter, with_rate_limit
from app.services import supabase_client

logger = logging.getLogger(__name__)

_PROGRESS_FLUSH_EVERY = 10
_PROGRESS_FLUSH_SECONDS = 2.0


def _mark_enrichment_needed_if_pending(user_id: str) -> None:
    """Reset enrichment status when new messages need AI processing."""
    pending = supabase_client.count_messages_needing_enrichment(user_id)
    if pending <= 0:
        return

    supabase_client.update_enrichment_progress(
        user_id,
        {
            "status": "idle",
            "phase": "idle",
            "total": 0,
            "processed": 0,
            "error": None,
        },
    )


class _SyncProgress:
    def __init__(self, user_id: str, total: int, *, baseline_threads: int, baseline_messages: int) -> None:
        self.user_id = user_id
        self.total = total
        self.processed = 0
        self.new_messages = 0
        self.new_threads = 0
        self.baseline_threads = baseline_threads
        self.baseline_messages = baseline_messages
        self._last_flush = time.monotonic()
        self._since_flush = 0

    def record(self, *, skipped: bool, new_thread: bool = False) -> None:
        self.processed += 1
        if not skipped:
            self.new_messages += 1
            if new_thread:
                self.new_threads += 1
        self._since_flush += 1
        if (
            self._since_flush >= _PROGRESS_FLUSH_EVERY
            or time.monotonic() - self._last_flush >= _PROGRESS_FLUSH_SECONDS
        ):
            self.flush()

    def flush(self, *, force: bool = False) -> None:
        if not force and self._since_flush == 0:
            return
        supabase_client.update_sync_state(
            self.user_id,
            status="syncing",
            progress_json={
                "phase": "fetching",
                "total": self.total,
                "processed": self.processed,
                "threads_synced": self.baseline_threads + self.new_threads,
                "messages_synced": self.baseline_messages + self.new_messages,
            },
        )
        self._last_flush = time.monotonic()
        self._since_flush = 0


def _format_sync_error(exc: Exception) -> str:
    if isinstance(exc, HttpError) and exc.resp and exc.resp.status == 403:
        return (
            "Gmail API is not enabled for your Google Cloud project. "
            "Enable it at Google Cloud Console → APIs & Services → Library → Gmail API, "
            "then wait 2–3 minutes and sync again."
        )
    return str(exc)


def run_gmail_sync(user_id: str, job_type: str = "initial_sync") -> None:
    settings = get_settings()
    limiter = GmailRateLimiter(requests_per_second=settings.gmail_requests_per_second)
    service = build_gmail_service(user_id, settings)

    sync_state = supabase_client.get_sync_state(user_id) or {}
    job_id = supabase_client.create_sync_job(
        user_id,
        job_type,
        {"started_at": datetime.now(UTC).isoformat()},
    )

    supabase_client.update_sync_state(
        user_id,
        status="syncing",
        progress_json={
            "phase": "starting",
            "total": 0,
            "processed": 0,
            "threads_synced": 0,
            "messages_synced": 0,
        },
    )

    try:
        if job_type == "incremental_sync" and sync_state.get("history_id"):
            try:
                _run_incremental_sync(
                    user_id,
                    service,
                    limiter,
                    sync_state["history_id"],
                    settings,
                )
            except HttpError as exc:
                if exc.resp and exc.resp.status == 404:
                    _run_initial_sync(user_id, service, limiter, settings)
                else:
                    raise
        else:
            _run_initial_sync(user_id, service, limiter, settings)

        profile = with_rate_limit(
            limiter,
            lambda: service.users().getProfile(userId="me").execute(),
        )
        history_id = profile.get("historyId")

        _mark_enrichment_needed_if_pending(user_id)

        supabase_client.update_sync_state(
            user_id,
            status="completed",
            progress_json={
                "phase": "complete",
                "total": supabase_client.count_messages(user_id),
                "processed": supabase_client.count_messages(user_id),
                "threads_synced": supabase_client.count_threads(user_id),
                "messages_synced": supabase_client.count_messages(user_id),
            },
            history_id=history_id,
            last_sync_at=datetime.now(UTC).isoformat(),
        )
        supabase_client.update_sync_job(job_id, "completed")
    except Exception as exc:
        logger.exception("Gmail sync failed for user %s", user_id)
        current = supabase_client.get_sync_state(user_id) or {}
        progress = current.get("progress_json") or {}
        progress["error"] = _format_sync_error(exc)
        supabase_client.update_sync_state(user_id, status="failed", progress_json=progress)
        supabase_client.update_sync_job(job_id, "failed", error=_format_sync_error(exc))
        raise


def _run_initial_sync(
    user_id: str,
    service: object,
    limiter: GmailRateLimiter,
    settings: Settings,
) -> None:
    after_date = (datetime.now(UTC) - timedelta(days=settings.sync_days_back)).strftime(
        "%Y/%m/%d"
    )
    query = f"after:{after_date}"
    message_ids: list[str] = []
    page_token: str | None = None

    while len(message_ids) < settings.sync_max_messages:
        result = with_rate_limit(
            limiter,
            lambda token=page_token: service.users()
            .messages()
            .list(
                userId="me",
                q=query,
                maxResults=min(100, settings.sync_max_messages - len(message_ids)),
                pageToken=token,
            )
            .execute(),
        )
        messages = result.get("messages", [])
        message_ids.extend(message["id"] for message in messages)
        page_token = result.get("nextPageToken")
        if not page_token or not messages:
            break

    message_ids = message_ids[: settings.sync_max_messages]
    total = len(message_ids)
    existing_ids = supabase_client.get_synced_gmail_message_ids(user_id)
    baseline_threads = supabase_client.count_threads(user_id)
    baseline_messages = len(existing_ids)
    thread_cache: dict[str, str] = {}
    progress = _SyncProgress(
        user_id,
        total,
        baseline_threads=baseline_threads,
        baseline_messages=baseline_messages,
    )

    supabase_client.update_sync_state(
        user_id,
        status="syncing",
        progress_json={
            "phase": "fetching",
            "total": total,
            "processed": 0,
            "threads_synced": baseline_threads,
            "messages_synced": baseline_messages,
        },
    )

    for message_id in message_ids:
        if message_id in existing_ids:
            progress.record(skipped=True)
            continue

        message = with_rate_limit(
            limiter,
            lambda mid=message_id: service.users()
            .messages()
            .get(userId="me", id=mid, format="full")
            .execute(),
        )
        parsed = parse_gmail_message(message)
        _, new_thread = save_parsed_message(user_id, parsed, thread_cache=thread_cache)
        existing_ids.add(message_id)
        progress.record(skipped=False, new_thread=new_thread)

    progress.flush(force=True)


def _run_incremental_sync(
    user_id: str,
    service: object,
    limiter: GmailRateLimiter,
    start_history_id: str,
    settings: Settings,
) -> None:
    history_id = start_history_id
    page_token: str | None = None
    new_message_ids: list[str] = []

    while True:
        result = with_rate_limit(
            limiter,
            lambda token=page_token: service.users()
            .history()
            .list(
                userId="me",
                startHistoryId=history_id,
                historyTypes=["messageAdded"],
                pageToken=token,
            )
            .execute(),
        )

        for record in result.get("history", []):
            for added in record.get("messagesAdded", []):
                message_id = added["message"]["id"]
                if message_id not in new_message_ids:
                    new_message_ids.append(message_id)

        page_token = result.get("nextPageToken")
        if not page_token:
            history_id = result.get("historyId", history_id)
            break

    total = len(new_message_ids)
    existing_ids = supabase_client.get_synced_gmail_message_ids(user_id)
    baseline_threads = supabase_client.count_threads(user_id)
    baseline_messages = len(existing_ids)
    thread_cache: dict[str, str] = {}
    progress = _SyncProgress(
        user_id,
        total,
        baseline_threads=baseline_threads,
        baseline_messages=baseline_messages,
    )

    supabase_client.update_sync_state(
        user_id,
        status="syncing",
        progress_json={
            "phase": "fetching",
            "total": total,
            "processed": 0,
            "threads_synced": baseline_threads,
            "messages_synced": baseline_messages,
        },
    )

    for message_id in new_message_ids[: settings.sync_max_messages]:
        if message_id in existing_ids:
            progress.record(skipped=True)
            continue

        message = with_rate_limit(
            limiter,
            lambda mid=message_id: service.users()
            .messages()
            .get(userId="me", id=mid, format="full")
            .execute(),
        )
        parsed = parse_gmail_message(message)
        _, new_thread = save_parsed_message(user_id, parsed, thread_cache=thread_cache)
        existing_ids.add(message_id)
        progress.record(skipped=False, new_thread=new_thread)

    progress.flush(force=True)
