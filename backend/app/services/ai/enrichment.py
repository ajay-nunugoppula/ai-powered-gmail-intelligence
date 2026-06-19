import logging
import time

from app.config import Settings, get_settings
from app.services.ai.chunker import chunk_text
from app.services.ai import gemini, nvidia
from app.services import supabase_client

logger = logging.getLogger(__name__)

_PROGRESS_FLUSH_EVERY = 5
_PROGRESS_FLUSH_SECONDS = 2.0


class _EnrichmentProgress:
    def __init__(self, user_id: str, total: int) -> None:
        self.user_id = user_id
        self.total = total
        self.processed = 0
        self.phase = "starting"
        self._last_flush = time.monotonic()
        self._since_flush = 0

    def set_phase(self, phase: str) -> None:
        self.phase = phase
        self.flush(force=True)

    def tick(self) -> None:
        self.processed += 1
        self._since_flush += 1
        if (
            self._since_flush >= _PROGRESS_FLUSH_EVERY
            or time.monotonic() - self._last_flush >= _PROGRESS_FLUSH_SECONDS
        ):
            self.flush()

    def flush(self, *, force: bool = False) -> None:
        if not force and self._since_flush == 0:
            return
        supabase_client.update_enrichment_progress(
            self.user_id,
            {
                "status": "running",
                "phase": self.phase,
                "total": self.total,
                "processed": self.processed,
                "error": None,
            },
        )
        self._last_flush = time.monotonic()
        self._since_flush = 0

    def complete(self) -> None:
        supabase_client.update_enrichment_progress(
            self.user_id,
            {
                "status": "completed",
                "phase": "complete",
                "total": self.total,
                "processed": self.processed,
                "error": None,
            },
        )

    def fail(self, error: str) -> None:
        supabase_client.update_enrichment_progress(
            self.user_id,
            {
                "status": "failed",
                "phase": self.phase,
                "total": self.total,
                "processed": self.processed,
                "error": error,
            },
        )


def run_enrichment(user_id: str) -> None:
    settings = get_settings()
    if not settings.gemini_api_key and not settings.nvidia_api_key:
        logger.warning("Skipping enrichment for user %s — no AI keys configured", user_id)
        supabase_client.update_enrichment_progress(
            user_id,
            {
                "status": "failed",
                "phase": "idle",
                "total": 0,
                "processed": 0,
                "error": "Configure GEMINI_API_KEY and/or NVIDIA_API_KEY in backend/.env",
            },
        )
        return

    current = supabase_client.get_enrichment_progress(user_id)
    if current.get("status") == "running":
        logger.info("Enrichment already running for user %s", user_id)
        return

    pending_total = supabase_client.count_messages_needing_enrichment(user_id)
    if pending_total == 0:
        supabase_client.update_enrichment_progress(
            user_id,
            {
                "status": "completed",
                "phase": "complete",
                "total": 0,
                "processed": 0,
                "error": None,
            },
        )
        return

    job_id = supabase_client.create_sync_job(
        user_id,
        "summarize",
        {"started_at": time.time(), "pending_total": pending_total},
    )
    progress = _EnrichmentProgress(user_id, pending_total)
    progress.set_phase("starting")

    try:
        categories = supabase_client.list_categories(user_id)
        affected_threads: set[str] = set()
        processed_ids: set[str] = set()

        while True:
            batch = supabase_client.list_messages_for_enrichment(
                user_id,
                limit=settings.enrichment_batch_size,
            )
            batch = [row for row in batch if row["id"] not in processed_ids]
            if not batch:
                break

            for message in batch:
                message_id = message["id"]
                thread_id = message["thread_id"]
                processed_ids.add(message_id)
                affected_threads.add(thread_id)

                if not message.get("message_summaries") and settings.gemini_api_key:
                    progress.set_phase("summarize")
                    summary = gemini.summarize_message(
                        subject=message.get("subject"),
                        from_email=message.get("from_email", ""),
                        body_text=message.get("body_text"),
                        settings=settings,
                    )
                    supabase_client.upsert_message_summary(
                        message_id,
                        summary,
                        settings.gemini_model,
                    )

                if not message.get("message_categories") and settings.gemini_api_key:
                    progress.set_phase("categorize")
                    try:
                        slug, confidence = gemini.categorize_message(
                            subject=message.get("subject"),
                            from_email=message.get("from_email", ""),
                            body_text=message.get("body_text"),
                            categories=categories,
                            settings=settings,
                        )
                        category_id = supabase_client.get_category_id_by_slug(user_id, slug)
                        if category_id:
                            supabase_client.upsert_message_category(
                                message_id,
                                category_id,
                                confidence,
                                settings.gemini_model,
                            )
                            supabase_client.assign_thread_category(thread_id, category_id)
                    except Exception as exc:
                        logger.warning(
                            "Categorization failed for message %s: %s",
                            message_id,
                            exc,
                        )

                if not message.get("message_embeddings") and settings.nvidia_api_key:
                    progress.set_phase("embed")
                    chunks = chunk_text(
                        message.get("body_text") or message.get("subject") or "",
                        chunk_size=settings.embedding_chunk_size,
                        overlap=settings.embedding_chunk_overlap,
                    )
                    if not chunks and message.get("subject"):
                        chunks = [message["subject"]]

                    if chunks:
                        try:
                            vectors = nvidia.embed_texts(chunks, settings=settings)
                            for index, (chunk, vector) in enumerate(
                                zip(chunks, vectors, strict=True)
                            ):
                                supabase_client.upsert_message_embedding(
                                    message_id=message_id,
                                    user_id=user_id,
                                    chunk_index=index,
                                    chunk_text=chunk,
                                    embedding=vector,
                                    metadata={
                                        "subject": message.get("subject"),
                                        "from_email": message.get("from_email"),
                                    },
                                )
                        except Exception as exc:
                            logger.warning(
                                "Embedding failed for message %s: %s",
                                message_id,
                                exc,
                            )

                progress.tick()

        if settings.gemini_api_key:
            progress.set_phase("thread_summaries")
            for thread_id in affected_threads:
                summaries = supabase_client.get_message_summaries_for_thread(user_id, thread_id)
                if not summaries:
                    continue
                subject = supabase_client.get_thread_subject(user_id, thread_id)
                thread_summary = gemini.summarize_thread(
                    subject=subject,
                    message_summaries=summaries,
                    settings=settings,
                )
                supabase_client.upsert_thread_summary(
                    thread_id,
                    thread_summary,
                    settings.gemini_model,
                )

        progress.complete()
        supabase_client.update_sync_job(job_id, "completed")
    except Exception as exc:
        logger.exception("Enrichment failed for user %s", user_id)
        progress.fail(str(exc))
        supabase_client.update_sync_job(job_id, "failed", error=str(exc))
        raise
