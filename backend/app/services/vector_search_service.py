"""VectorSearchService — semantic retrieval over resource chunks.

Pipeline:  query → embedding → vector search (top_k) → rerank → top_k'

Tenant isolation is non-negotiable: every search is scoped to a single
``vault_id`` (enforced again in :class:`ChunkRepository.search`). This service
is shared by Ask My Vault, the Notes Generator, and every future AI feature.
"""

from __future__ import annotations

import asyncio
import re
import time
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.chunk_repository import ChunkRepository, ScoredChunk
from app.services.ai import get_provider
from app.services.ai.base import TokenUsage
from app.services.ai.usage_logger import log_generation

logger = structlog.get_logger()

_WORD = re.compile(r"[a-z0-9]+")


async def search(
    db: AsyncSession,
    *,
    vault_id: UUID,
    query: str,
    user_id: UUID,
    top_k: int | None = None,
    rerank_k: int | None = None,
    resource_ids: list[UUID] | None = None,
) -> list[ScoredChunk]:
    """Embed ``query`` and return the reranked top chunks for ``vault_id``."""
    top_k = top_k or settings.VECTOR_SEARCH_TOP_K
    rerank_k = rerank_k or settings.VECTOR_SEARCH_RERANK_K

    provider = get_provider()
    started = time.perf_counter()
    result = await provider.embed([query])
    await log_generation(
        db,
        user_id=user_id,
        vault_id=vault_id,
        generation_type="search_embedding",
        model=result.model,
        usage=TokenUsage(prompt_tokens=result.total_tokens),
        latency_ms=int((time.perf_counter() - started) * 1000),
        metadata={"query_chars": len(query)},
    )
    if not result.embeddings:
        return []

    repo = ChunkRepository(db)
    candidates = await repo.search(
        vault_id,
        result.embeddings[0],
        top_k=top_k,
        resource_ids=resource_ids,
    )
    return _rerank(query, candidates, rerank_k)


async def search_multi_vault(
    db: AsyncSession,
    *,
    vault_ids: list[UUID],
    query: str,
    user_id: UUID,
    top_k: int | None = None,
    rerank_k: int | None = None,
) -> list[ScoredChunk]:
    """Search across every vault in ``vault_ids`` (the caller's authorized set).

    Used by the global Ask AI assistant. Embeds the query once, then issues one
    ``ChunkRepository.search`` call per vault — each call is still hard-scoped
    by ``WHERE vault_id = ?``, so tenant isolation is never weakened; this only
    fans a single authorized search out across a pre-approved set of vaults.
    Results are merged and reranked together before returning the top ``k``.
    """
    top_k = top_k or settings.VECTOR_SEARCH_TOP_K
    rerank_k = rerank_k or settings.VECTOR_SEARCH_RERANK_K
    if not vault_ids:
        return []

    provider = get_provider()
    started = time.perf_counter()
    result = await provider.embed([query])
    await log_generation(
        db,
        user_id=user_id,
        generation_type="search_embedding",
        model=result.model,
        usage=TokenUsage(prompt_tokens=result.total_tokens),
        latency_ms=int((time.perf_counter() - started) * 1000),
        metadata={"query_chars": len(query), "vault_count": len(vault_ids)},
    )
    if not result.embeddings:
        return []

    repo = ChunkRepository(db)
    embedding = result.embeddings[0]
    per_vault = await asyncio.gather(
        *(repo.search(vault_id, embedding, top_k=top_k) for vault_id in vault_ids)
    )
    candidates = [sc for vault_results in per_vault for sc in vault_results]
    return _rerank(query, candidates, rerank_k)


def _rerank(query: str, candidates: list[ScoredChunk], k: int) -> list[ScoredChunk]:
    """Blend vector similarity with lexical overlap; return the top ``k``.

    A cheap, dependency-free reranker: it rewards chunks that both sit close in
    embedding space and share query terms. A cross-encoder can drop in here
    later without changing any caller.
    """
    if not candidates:
        return []
    q_terms = set(_WORD.findall(query.lower()))
    if not q_terms:
        return candidates[:k]

    def score(sc: ScoredChunk) -> float:
        c_terms = set(_WORD.findall(sc.chunk.content.lower()))
        lexical = len(q_terms & c_terms) / len(q_terms) if q_terms else 0.0
        return 0.8 * sc.similarity + 0.2 * lexical

    return sorted(candidates, key=score, reverse=True)[:k]
