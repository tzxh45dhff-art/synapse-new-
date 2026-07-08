"""ChunkRepository — all reads/writes for ``resource_chunks``.

Includes vector similarity search. Every read is vault-scoped by the caller;
:meth:`search` enforces the ``vault_id`` filter itself as a hard guarantee —
cross-vault retrieval is impossible through this method.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resource import Resource, ResourceChunk


class ScoredChunk:
    """A chunk plus its similarity score (0..1, higher = closer)."""

    __slots__ = ("chunk", "similarity")

    def __init__(self, chunk: ResourceChunk, similarity: float) -> None:
        self.chunk = chunk
        self.similarity = similarity


class ChunkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Writes ────────────────────────────────────────────────────────────────
    async def bulk_insert(self, chunks: list[ResourceChunk]) -> list[ResourceChunk]:
        """Insert many chunks in one flush. Caller owns the commit."""
        if not chunks:
            return []
        self.db.add_all(chunks)
        await self.db.flush()
        return chunks

    async def create_chunks(self, chunks: list[ResourceChunk]) -> list[ResourceChunk]:
        return await self.bulk_insert(chunks)

    async def delete_chunks(self, resource_id: UUID) -> int:
        """Delete every chunk for a resource (idempotent — supports re-runs)."""
        result = await self.db.execute(
            delete(ResourceChunk).where(ResourceChunk.resource_id == resource_id)
        )
        return result.rowcount or 0

    # ── Reads ─────────────────────────────────────────────────────────────────
    async def get_chunk(self, chunk_id: UUID) -> ResourceChunk | None:
        result = await self.db.execute(
            select(ResourceChunk).where(ResourceChunk.id == chunk_id)
        )
        return result.scalar_one_or_none()

    async def count_for_resource(self, resource_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(ResourceChunk).where(
                ResourceChunk.resource_id == resource_id
            )
        )
        return int(result.scalar_one())

    async def count_embedded(self, resource_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(ResourceChunk).where(
                ResourceChunk.resource_id == resource_id,
                ResourceChunk.embedding.isnot(None),
            )
        )
        return int(result.scalar_one())

    async def list_unembedded(self, resource_id: UUID) -> list[ResourceChunk]:
        result = await self.db.execute(
            select(ResourceChunk)
            .where(
                ResourceChunk.resource_id == resource_id,
                ResourceChunk.embedding.is_(None),
            )
            .order_by(ResourceChunk.chunk_index.asc())
        )
        return list(result.scalars().all())

    # ── Direct (non-semantic) selection for note modes ──────────────────────────
    async def get_by_resources(
        self, resource_ids: list[UUID], *, limit: int | None = None
    ) -> list[ResourceChunk]:
        if not resource_ids:
            return []
        stmt = (
            select(ResourceChunk)
            .where(ResourceChunk.resource_id.in_(resource_ids))
            .order_by(ResourceChunk.resource_id, ResourceChunk.chunk_index.asc())
        )
        if limit:
            stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_pages(
        self, resource_id: UUID, pages: list[int], *, limit: int | None = None
    ) -> list[ResourceChunk]:
        if not pages:
            return []
        stmt = (
            select(ResourceChunk)
            .where(
                ResourceChunk.resource_id == resource_id,
                ResourceChunk.page_number.in_(pages),
            )
            .order_by(ResourceChunk.chunk_index.asc())
        )
        if limit:
            stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_headings(
        self, resource_ids: list[UUID], headings: list[str], *, limit: int | None = None
    ) -> list[ResourceChunk]:
        """Chapter selection: chunks whose heading matches one of ``headings``."""
        if not resource_ids or not headings:
            return []
        stmt = (
            select(ResourceChunk)
            .where(
                ResourceChunk.resource_id.in_(resource_ids),
                ResourceChunk.heading.in_(headings),
            )
            .order_by(ResourceChunk.resource_id, ResourceChunk.chunk_index.asc())
        )
        if limit:
            stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_all_for_vault(self, vault_id: UUID, *, limit: int) -> list[ResourceChunk]:
        stmt = (
            select(ResourceChunk)
            .where(ResourceChunk.vault_id == vault_id)
            .order_by(ResourceChunk.resource_id, ResourceChunk.chunk_index.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Semantic search ─────────────────────────────────────────────────────────
    async def search(
        self,
        vault_id: UUID,
        query_embedding: list[float],
        *,
        top_k: int = 20,
        resource_ids: list[UUID] | None = None,
    ) -> list[ScoredChunk]:
        """Cosine-similarity search, HARD-scoped to ``vault_id``.

        Excludes chunks belonging to soft-deleted resources.
        """
        distance = ResourceChunk.embedding.cosine_distance(query_embedding)
        stmt = (
            select(ResourceChunk, distance.label("distance"))
            .join(Resource, Resource.id == ResourceChunk.resource_id)
            .where(
                ResourceChunk.vault_id == vault_id,           # tenant isolation — never removed
                ResourceChunk.embedding.isnot(None),
                Resource.deleted_at.is_(None),
            )
            .order_by(distance.asc())
            .limit(top_k)
        )
        if resource_ids:
            stmt = stmt.where(ResourceChunk.resource_id.in_(resource_ids))

        result = await self.db.execute(stmt)
        scored: list[ScoredChunk] = []
        for chunk, dist in result.all():
            # cosine_distance is in [0, 2]; similarity = 1 - distance.
            scored.append(ScoredChunk(chunk=chunk, similarity=round(1.0 - float(dist), 4)))
        return scored
