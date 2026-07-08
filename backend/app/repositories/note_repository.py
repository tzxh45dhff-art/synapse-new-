"""NoteRepository — all reads/writes for notes, versions and generations."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note, NoteGeneration, NoteVersion


class NoteRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Notes ─────────────────────────────────────────────────────────────────
    async def create(self, note: Note) -> Note:
        self.db.add(note)
        await self.db.flush()
        return note

    async def get(self, note_id: UUID) -> Note | None:
        result = await self.db.execute(
            select(Note).where(Note.id == note_id, Note.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_vault(
        self,
        vault_id: UUID,
        *,
        search: str | None = None,
        source_type: str | None = None,
        pinned_only: bool = False,
    ) -> list[Note]:
        stmt = (
            select(Note)
            .where(Note.vault_id == vault_id, Note.deleted_at.is_(None))
            .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
        )
        if search:
            stmt = stmt.where(Note.title.ilike(f"%{search}%"))
        if source_type:
            stmt = stmt.where(Note.source_type == source_type)
        if pinned_only:
            stmt = stmt.where(Note.is_pinned.is_(True))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def soft_delete(self, note: Note) -> None:
        note.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ── Versions ────────────────────────────────────────────────────────────────
    async def next_version_number(self, note_id: UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.max(NoteVersion.version_number), 0)).where(
                NoteVersion.note_id == note_id
            )
        )
        return int(result.scalar_one()) + 1

    async def create_version(
        self,
        *,
        note_id: UUID,
        content: str,
        created_by: UUID,
        change_summary: str | None = None,
    ) -> NoteVersion:
        version = NoteVersion(
            note_id=note_id,
            version_number=await self.next_version_number(note_id),
            content=content,
            created_by=created_by,
            change_summary=change_summary,
        )
        self.db.add(version)
        await self.db.flush()
        return version

    async def list_versions(self, note_id: UUID) -> list[NoteVersion]:
        result = await self.db.execute(
            select(NoteVersion)
            .where(NoteVersion.note_id == note_id)
            .order_by(NoteVersion.version_number.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, version_id: UUID) -> NoteVersion | None:
        result = await self.db.execute(
            select(NoteVersion).where(NoteVersion.id == version_id)
        )
        return result.scalar_one_or_none()

    # ── Generations ──────────────────────────────────────────────────────────────
    async def create_generation(
        self,
        *,
        note_id: UUID,
        generation_id: UUID | None,
        source_resource_ids: list[UUID],
        prompt_template: str | None,
    ) -> NoteGeneration:
        gen = NoteGeneration(
            note_id=note_id,
            generation_id=generation_id,
            source_resource_ids=source_resource_ids,
            prompt_template=prompt_template,
        )
        self.db.add(gen)
        await self.db.flush()
        return gen

    async def list_generations(self, note_id: UUID) -> list[NoteGeneration]:
        result = await self.db.execute(
            select(NoteGeneration)
            .where(NoteGeneration.note_id == note_id)
            .order_by(NoteGeneration.created_at.desc())
        )
        return list(result.scalars().all())
