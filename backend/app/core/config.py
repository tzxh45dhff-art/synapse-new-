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

    # Provider abstraction. Only requirement: swapping providers = new adapter,
    # never touching services. See app/services/ai/.
    AI_PROVIDER: str = "openai"           # openai | azure | gemini
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536      # MUST match resource_chunks.embedding vector(N)
    LLM_CHAT_MODEL: str = "gpt-4o-mini"   # default generation model
    LLM_MAX_OUTPUT_TOKENS: int = 4096

    # Azure OpenAI (only required when AI_PROVIDER=azure)
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_VERSION: str = "2025-01-01-preview"
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o"               # chat deployment
    AZURE_EMBEDDING_DEPLOYMENT: str = "text-embedding-3-small"  # embedding deployment
    # Vector search tuning
    VECTOR_SEARCH_TOP_K: int = 20         # candidates fetched before rerank
    VECTOR_SEARCH_RERANK_K: int = 5       # returned after rerank
    # Chunking
    CHUNK_TARGET_TOKENS: int = 475        # 450–500 token target
    CHUNK_OVERLAP_TOKENS: int = 75

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
