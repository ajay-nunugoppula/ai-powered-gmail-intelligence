from arq.connections import RedisSettings

from app.config import get_settings

settings = get_settings()


async def startup(ctx: dict) -> None:
    ctx["settings"] = settings


async def shutdown(ctx: dict) -> None:
    pass


async def noop(ctx: dict) -> dict[str, str]:
    return {"status": "worker_ready"}


class WorkerSettings:
    functions = [noop]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
