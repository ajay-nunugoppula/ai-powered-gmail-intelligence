from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_LEGACY_NVIDIA_EMBED_MODELS = {
    "nvidia/nv-embedqa-e5-v5-v2": "nvidia/nv-embedqa-e5-v5",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Gmail Intelligence Platform"
    debug: bool = False
    api_prefix: str = "/api/v1"

    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"

    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/gmail/callback"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    nvidia_api_key: str = ""
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_embed_model: str = "nvidia/nv-embedqa-e5-v5"

    redis_url: str = "redis://localhost:6379"
    token_encryption_key: str = ""

    cors_origins: str = "http://localhost:5173"

    sync_max_messages: int = 1000
    sync_days_back: int = 90
    gmail_requests_per_second: float = 10.0
    use_arq_worker: bool = False
    sync_stale_seconds: int = 90

    enrichment_auto_start: bool = True
    enrichment_batch_size: int = 50
    embedding_chunk_size: int = 400
    embedding_chunk_overlap: int = 50

    @field_validator("nvidia_embed_model", mode="before")
    @classmethod
    def normalize_nvidia_embed_model(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        model = value.strip()
        if model in _LEGACY_NVIDIA_EMBED_MODELS:
            return _LEGACY_NVIDIA_EMBED_MODELS[model]
        if model.endswith("-v2"):
            return "nvidia/nv-embedqa-e5-v5"
        return model

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
