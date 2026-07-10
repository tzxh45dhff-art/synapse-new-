"""SquadChatRepository — all reads/writes for squad group-chat messages & reactions."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.profile import Profile
from app.models.squad_message import SquadMessage, SquadMessageReaction


class SquadChatRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Messages ─────────────────────────────────────────────────────────────
    async def create_message(self, message: SquadMessage) -> SquadMessage:
        self.db.add(message)
        await self.db.flush()
        return message

    async def get_message(self, message_id: UUID) -> SquadMessage | None:
        result = await self.db.execute(
            select(SquadMessage)
            .options(
                selectinload(SquadMessage.reactions),
                joinedload(SquadMessage.reply_to),
            )
            .where(SquadMessage.id == message_id)
        )
        return result.unique().scalar_one_or_none()

    async def list_messages(
        self,
        squad_id: UUID,
        *,
        before: datetime | None = None,
        limit: int = 50,
    ) -> list[SquadMessage]:
        """Return the newest `limit` messages older than `before`, oldest → newest."""
        stmt = (
            select(SquadMessage)
            .options(
                selectinload(SquadMessage.reactions),
                joinedload(SquadMessage.reply_to),
            )
            .where(SquadMessage.squad_id == squad_id)
        )
        if before is not None:
            stmt = stmt.where(SquadMessage.created_at < before)
        stmt = stmt.order_by(SquadMessage.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        rows = list(result.unique().scalars().all())
        rows.reverse()  # oldest → newest for rendering
        return rows

    # ── Profiles (for resolving sender + reply author names) ─────────────────
    async def get_profiles(self, user_ids: set[UUID]) -> dict[UUID, Profile]:
        if not user_ids:
            return {}
        result = await self.db.execute(select(Profile).where(Profile.id.in_(user_ids)))
        return {p.id: p for p in result.scalars().all()}

    # ── Reactions ────────────────────────────────────────────────────────────
    async def get_reaction(
        self, message_id: UUID, user_id: UUID, emoji: str
    ) -> SquadMessageReaction | None:
        result = await self.db.execute(
            select(SquadMessageReaction).where(
                SquadMessageReaction.message_id == message_id,
                SquadMessageReaction.user_id == user_id,
                SquadMessageReaction.emoji == emoji,
            )
        )
        return result.scalar_one_or_none()

    async def add_reaction(self, reaction: SquadMessageReaction) -> SquadMessageReaction:
        self.db.add(reaction)
        await self.db.flush()
        return reaction

    async def remove_reaction(self, message_id: UUID, user_id: UUID, emoji: str) -> None:
        await self.db.execute(
            delete(SquadMessageReaction).where(
                SquadMessageReaction.message_id == message_id,
                SquadMessageReaction.user_id == user_id,
                SquadMessageReaction.emoji == emoji,
            )
        )
        await self.db.flush()
