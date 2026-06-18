import asyncio
import logging

from arq import create_pool
from arq.connections import RedisSettings

from app.config import get_settings
from app.services.sync.service import run_gmail_sync

logger = logging.getLogger(__name__)


async def enqueue_gmail_sync(user_id: str, job_type: str) -> bool:
    settings = get_settings()
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await redis.enqueue_job("run_gmail_sync_task", user_id, job_type)
        await redis.close()
        return True
    except Exception:
        logger.warning("Redis unavailable, sync will run in-process", exc_info=True)
        return False


def run_gmail_sync_in_thread(user_id: str, job_type: str) -> None:
    logger.info("Starting Gmail sync for user %s (%s)", user_id, job_type)
    try:
        run_gmail_sync(user_id, job_type)
        logger.info("Gmail sync completed for user %s", user_id)
    except Exception:
        logger.exception("Background Gmail sync failed for user %s", user_id)


async def run_gmail_sync_async(user_id: str, job_type: str) -> None:
    await asyncio.to_thread(run_gmail_sync_in_thread, user_id, job_type)
