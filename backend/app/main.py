import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import auth, emails, compose, chat, categories

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"Starting {settings.app_name}")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Gmail Intelligence Platform",
    description="AI-powered email management and intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(emails.router, prefix="/api")
app.include_router(compose.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(categories.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": settings.app_name}
