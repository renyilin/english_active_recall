from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "English Active Recall API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database - Neon PostgreSQL
    database_url: str

    # JWT Configuration
    secret_key: str
    refresh_secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS (for frontend)
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # AI Provider Configuration
    ai_provider: str = "openai"  # "openai" or "gemini"
    openai_api_key: str | None = None
    gemini_api_key: str | None = None

    # TTS Configuration
    tts_voice: str = "alloy"  # OpenAI TTS voice
    tts_model: str = "tts-1-1106"
    tts_cache_max_size_bytes: int = 524_288_000  # 500 MB
    tts_cache_dir: str = "./cache/tts"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
