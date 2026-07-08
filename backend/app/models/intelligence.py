"""SQLAlchemy models: TopicMastery, StudySession, StudyStreak, ExamReadiness, ReadinessHistory, Exam."""

from datetime import datetime, date
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vault_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    exam_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    weightage: Mapped[float | None] = mapped_column(Numeric(5, 2))
    syllabus_topics: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TopicMastery(Base):
    __tablename__ = "topic_mastery"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    vault_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False
    )
    topic: Mapped[str] = mapped_column(String(300), nullable=False)
    mastery_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    quiz_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    flashcard_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    vault_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vaults.id", ondelete="SET NULL")
    )
    squad_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squads.id", ondelete="SET NULL")
    )
    session_type: Mapped[str] = mapped_column(String(30), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_secs: Mapped[int | None] = mapped_column(Integer)
    focus_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)


class StudyStreak(Base):
    __tablename__ = "study_streaks"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_study_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ExamReadiness(Base):
    __tablename__ = "exam_readiness"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    vault_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False
    )
    exam_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("exams.id", ondelete="SET NULL")
    )
    readiness_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    coverage_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    weak_topic_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    strong_topic_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_study_mins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    history: Mapped[list["ReadinessHistory"]] = relationship(back_populates="exam_readiness")


class ReadinessHistory(Base):
    __tablename__ = "readiness_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    exam_readiness_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("exam_readiness.id", ondelete="CASCADE"), nullable=False
    )
    readiness_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exam_readiness: Mapped["ExamReadiness"] = relationship(back_populates="history")
