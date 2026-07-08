"""SQLAlchemy models: Tag, ResourceTag, NoteTag, QuizTag, FlashcardTag."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    squad_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squads.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResourceTag(Base):
    __tablename__ = "resource_tags"

    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    resource_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )


class NoteTag(Base):
    __tablename__ = "note_tags"

    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    note_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )


class QuizTag(Base):
    __tablename__ = "quiz_tags"

    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    quiz_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True
    )


class FlashcardTag(Base):
    __tablename__ = "flashcard_tags"

    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    flashcard_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("flashcards.id", ondelete="CASCADE"), primary_key=True
    )
