"""Pydantic schemas for practice-attempt tracking, dashboard insights, and flashcards."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


SessionType = Literal["mcq", "coding"]


# ─────────────────────────────────────────────────────────────────────────────
# Practice attempts
# ─────────────────────────────────────────────────────────────────────────────

class PracticeAttemptCreate(BunkerBaseModel):
    vault_id: UUID
    session_type: SessionType
    score_pct: float = Field(..., ge=0, le=100)
    topic: str | None = Field(None, max_length=300)


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard insights
# ─────────────────────────────────────────────────────────────────────────────

class StreakRead(BunkerBaseModel):
    current_streak: int
    longest_streak: int


class HeatmapDay(BunkerBaseModel):
    date: date
    count: int


class MasteryTopic(BunkerBaseModel):
    topic: str
    mastery_score: float
    attempts: int


class ScoreTrendPoint(BunkerBaseModel):
    recorded_at: datetime
    score_pct: float
    session_type: SessionType


class DashboardInsights(BunkerBaseModel):
    has_data: bool
    streak: StreakRead
    heatmap: list[HeatmapDay]
    mastery_avg: float | None
    strongest_topic: MasteryTopic | None
    weakest_topic: MasteryTopic | None
    score_trend: list[ScoreTrendPoint]
    trend_change_pct: float | None


class VaultInsights(BunkerBaseModel):
    """Per-(user, vault) practice breakdown — backs the vault radar/phase widget."""
    has_data: bool
    concepts_avg: float | None
    quiz_avg: float | None
    coding_avg: float | None
    flashcard_coverage_pct: float | None
    attempts_count: int
    weakest_topic: str | None


# ─────────────────────────────────────────────────────────────────────────────
# Flashcards
# ─────────────────────────────────────────────────────────────────────────────

class FlashcardGenerateRequest(BunkerBaseModel):
    count: int = Field(default=5, ge=1, le=20)
    topics: str | None = Field(None, max_length=500)


class FlashcardRead(BunkerBaseModel):
    id: UUID
    vault_id: UUID
    vault_title: str
    front: str
    back: str
    difficulty: str | None
    status: str
    next_review_at: datetime


class FlashcardReviewRequest(BunkerBaseModel):
    rating: int = Field(..., ge=0, le=3)  # 0=again 1=hard 2=good 3=easy
