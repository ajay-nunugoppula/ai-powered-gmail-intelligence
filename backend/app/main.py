from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, chat, compose, config, enrichment, health, sync, threads
from app.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_settings.cache_clear()
    yield


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(config.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(sync.router, prefix=settings.api_prefix)
app.include_router(enrichment.router, prefix=settings.api_prefix)
app.include_router(compose.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(threads.router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": settings.app_name, "status": "ok"}
