"""Pydantic schemas for the MCQ (Multiple Choice Question) Generator."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ── Request ────────────────────────────────────────────────────────────────────

class MCQGenerateRequest(BunkerBaseModel):
    """Parameters for generating a set of MCQs."""

    difficulty: Literal["easy", "medium", "hard", "mixed"] = "medium"
    count: int = Field(default=10, ge=3, le=50)
    topics: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Topics / syllabus text to base questions on.",
    )
    # Whether to augment the prompt with vault resource context (RAG)
    use_vault_context: bool = Field(
        default=True,
        description="Inject relevant vault resource chunks into the prompt.",
    )
    # Optional extra instruction for the AI
    custom_instruction: str | None = Field(None, max_length=500)


# ── Per-question ───────────────────────────────────────────────────────────────

class MCQOption(BunkerBaseModel):
    key: Literal["A", "B", "C", "D"]
    text: str


class MCQQuestion(BunkerBaseModel):
    number: int
    question: str
    options: list[MCQOption]           # always 4 options A-D
    correct_answer: Literal["A", "B", "C", "D"]
    explanation: str
    difficulty: Literal["easy", "medium", "hard"]
    topic_hint: str | None = None      # which topic this question covers


# ── Response ───────────────────────────────────────────────────────────────────

class MCQGenerateResponse(BunkerBaseModel):
    vault_id: UUID
    subject_name: str | None
    difficulty: str
    requested_count: int
    generated_count: int
    topics: str
    questions: list[MCQQuestion]
    generated_at: datetime
    model_used: str | None = None
