"""EmbeddingService — generate + persist embeddings for a resource's chunks.

Provider-agnostic (goes through :func:`get_provider`). Idempotent: only chunks
without an embedding are processed, so a retried embedding stage never
re-embeds or duplicates. Every pass logs one ``ai_generations`` row.
"""

from __future__ import annotations

import time

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.resource import Resource
from app.repositories.chunk_repository import ChunkRepository
from app.services.ai import get_provider
from app.services.ai.base import TokenUsage
from app.services.ai.usage_logger import log_generation

logger = structlog.get_logger()

_BATCH_SIZE = 96


async def embed_resource_chunks(db: AsyncSession, resource: Resource) -> int:
    """Embed all not-yet-embedded chunks for ``resource``. Returns count embedded."""
    repo = ChunkRepository(db)
    pending = await repo.list_unembedded(resource.id)
    if not pending:
        return 0

    provider = get_provider()
    model = settings.EMBEDDING_MODEL
    usage = TokenUsage()
    started = time.perf_counter()
    embedded = 0
    status = "success"
    error_message: str | None = None

    try:
        for start in range(0, len(pending), _BATCH_SIZE):
            batch = pending[start : start + _BATCH_SIZE]
            result = await provider.embed([c.content for c in batch], model=model)
            usage.prompt_tokens += result.total_tokens
            for chunk, vector in zip(batch, result.embeddings):
                chunk.embedding = vector
                chunk.embedding_model = result.model
                chunk.embedding_dimensions = len(vector)
                embedded += 1
            await db.flush()
    except Exception as e:  # log the failed attempt, then propagate for retry
        status = "error"
        error_message = str(e)
        raise
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await log_generation(
            db,
            user_id=resource.uploaded_by,
            vault_id=resource.vault_id,
            generation_type="embedding",
            model=model,
            usage=usage,
            latency_ms=latency_ms,
            status=status,
            error_message=error_message,
            metadata={"resource_id": str(resource.id), "chunks_embedded": embedded},
        )

    logger.info("embedding.complete", resource_id=str(resource.id), embedded=embedded)
    return embedded
