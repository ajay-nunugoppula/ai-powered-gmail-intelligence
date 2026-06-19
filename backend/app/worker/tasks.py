import asyncio
import logging

from app.config import get_settings
from app.services.ai.enrichment import run_enrichment
from app.services.sync.service import run_gmail_sync

logger = logging.getLogger(__name__)


async def run_gmail_sync_task(_ctx: dict, user_id: str, job_type: str = "initial_sync") -> dict:
    await asyncio.to_thread(run_gmail_sync, user_id, job_type)
    settings = get_settings()
    if settings.enrichment_auto_start:
        try:
            await asyncio.to_thread(run_enrichment, user_id)
        except Exception:
            logger.exception("Enrichment failed after sync for user %s", user_id)
    return {"status": "completed", "user_id": user_id, "job_type": job_type}


async def run_enrichment_task(_ctx: dict, user_id: str) -> dict:
    await asyncio.to_thread(run_enrichment, user_id)
    return {"status": "completed", "user_id": user_id}
