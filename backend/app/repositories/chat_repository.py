"""ChatRepository — all reads/writes for chat sessions, messages, citations and feedback."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatFeedback, ChatMessage, ChatSession, Citation


class ChatRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sessions ────────────────────────────────────────────────────────────────
    async def create_session(self, session: ChatSession) -> ChatSession:
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(self, session_id: UUID) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def list_sessions_for_user(self, user_id: UUID) -> list[ChatSession]:
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id, ChatSession.deleted_at.is_(None))
            .order_by(ChatSession.last_message_at.desc().nullslast(), ChatSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def touch_session(self, session: ChatSession, *, by: int = 1) -> None:
        session.message_count += by
        session.last_message_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ── Messages ────────────────────────────────────────────────────────────────
    async def create_message(self, message: ChatMessage) -> ChatMessage:
        self.db.add(message)
        await self.db.flush()
        return message

    async def list_messages(
        self, session_id: UUID, *, limit: int | None = None
    ) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.citations))
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(stmt)
        messages = list(result.scalars().all())
        if limit:
            return messages[-limit:]
        return messages

    # ── Citations ───────────────────────────────────────────────────────────────
    async def bulk_create_citations(self, citations: list[Citation]) -> list[Citation]:
        if not citations:
            return []
        self.db.add_all(citations)
        await self.db.flush()
        return citations

    async def list_citations_for_message(self, message_id: UUID) -> list[Citation]:
        result = await self.db.execute(
            select(Citation).where(Citation.message_id == message_id).order_by(Citation.created_at.asc())
        )
        return list(result.scalars().all())

    # ── Feedback ────────────────────────────────────────────────────────────────
    async def create_feedback(self, feedback: ChatFeedback) -> ChatFeedback:
        self.db.add(feedback)
        await self.db.flush()
        return feedback
