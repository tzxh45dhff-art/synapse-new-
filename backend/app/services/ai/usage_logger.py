"""Central AI cost/usage logging → the ``ai_generations`` table.

Every embedding and generation call routes through here so cost, tokens,
latency, provider, model, status and retries are auditable in one place.
"""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_generation import AIGeneration
from app.services.ai.base import TokenUsage
from app.services.ai.pricing import estimate_cost

logger = structlog.get_logger()


async def log_generation(
    db: AsyncSession,
    *,
    user_id: UUID,
    generation_type: str,
    model: str,
    usage: TokenUsage,
    vault_id: UUID | None = None,
    latency_ms: int | None = None,
    status: str = "success",
    error_message: str | None = None,
    metadata: dict | None = None,
) -> AIGeneration:
    """Insert one ai_generations row and flush it (id available immediately)."""
    row = AIGeneration(
        user_id=user_id,
        vault_id=vault_id,
        generation_type=generation_type,
        model=model,
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        cost_usd=estimate_cost(model, usage.prompt_tokens, usage.completion_tokens),
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
        metadata_=metadata or {},
    )
    db.add(row)
    await db.flush()
    logger.info(
        "ai.generation_logged",
        generation_type=generation_type,
        model=model,
        total_tokens=usage.total_tokens,
        cost_usd=float(row.cost_usd or 0),
        status=status,
    )
    return row
