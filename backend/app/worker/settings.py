from arq.connections import RedisSettings

from app.config import get_settings
from app.worker.tasks import run_gmail_sync_task

settings = get_settings()


async def startup(ctx: dict) -> None:
    ctx["settings"] = settings


async def shutdown(ctx: dict) -> None:
    pass


class WorkerSettings:
    functions = [run_gmail_sync_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
