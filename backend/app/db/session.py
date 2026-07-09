import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.core.config import settings

# ---------------------------------------------------------------------------
# Async engine (application queries)
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# Supabase's auth.users table is managed outside this app's migrations. Every
# model FK's it by string ("auth.users.id"); without a real Table object in
# Base.metadata, SQLAlchemy can't resolve those FKs during mapper/dependency
# sorts (e.g. on flush). Declare a minimal shadow — id only, just enough for
# FK resolution — and keep it out of autogenerate via alembic/env.py's
# include_object.
sa.Table(
    "users",
    Base.metadata,
    sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
    schema="auth",
)


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------
async def get_db() -> AsyncSession:  # type: ignore[override]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Startup check
# ---------------------------------------------------------------------------
async def check_db_connection() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
