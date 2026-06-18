from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    nvidia_api_key: str = ""
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"

    redis_url: str = "redis://localhost:6379"
    token_encryption_key: str = ""

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
