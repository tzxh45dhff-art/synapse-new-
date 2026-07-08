from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Environment ────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str  # async: postgresql+asyncpg://...
    DATABASE_URL_SYNC: str  # sync: postgresql+psycopg2://... (Alembic)

    # ── Supabase ───────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Server-only. Never expose to frontend.
    SUPABASE_JWT_SECRET: str        # For local JWT verification (no network call)

    # ── AI ─────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str = ""  # Optional fallback

    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── CORS ───────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://bunker.vercel.app",
    ]

    # ── Storage ────────────────────────────────────────────────────────────
    SUPABASE_STORAGE_BUCKET: str = "resources"
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── Rate Limiting ──────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 100
    AI_RATE_LIMIT_PER_MINUTE: int = 10

    # ── Sentry ─────────────────────────────────────────────────────────────
    SENTRY_DSN: str = ""


settings = Settings()  # type: ignore[call-arg]
