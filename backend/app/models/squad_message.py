"""SQLAlchemy models for the squad group chat: SquadMessage, SquadMessageReaction.

This is the multi-user, per-squad WhatsApp-style chat — distinct from the
single-user "Ask AI" RAG assistant in app.models.chat. Messages are written by
the backend (service role) and delivered to clients via Supabase Realtime
(postgres_changes), gated by row-level security so only active squad members
can subscribe.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SquadMessage(Base):
    __tablename__ = "squad_messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    squad_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squads.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    # text body; may be empty when the message is a pure attachment
    content: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    # 'text' | 'file' | 'resource' | 'note'
    message_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="text")
    # Flexible attachment payload. For files:
    #   {storage_path, file_name, mime_type, size_bytes}
    # For shared in-app content:
    #   {ref_id, vault_id, title, subtitle}
    attachment: Mapped[dict | None] = mapped_column(JSONB)
    reply_to_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squad_messages.id", ondelete="SET NULL")
    )
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reply_to: Mapped["SquadMessage | None"] = relationship(remote_side=[id], lazy="joined")
    reactions: Mapped[list["SquadMessageReaction"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class SquadMessageReaction(Base):
    __tablename__ = "squad_message_reactions"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_squad_reaction"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    message_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squad_messages.id", ondelete="CASCADE"), nullable=False
    )
    # denormalized for Realtime row-level filtering (reactions have no squad_id otherwise)
    squad_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squads.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    emoji: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["SquadMessage"] = relationship(back_populates="reactions")
