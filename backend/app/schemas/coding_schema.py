"""Pydantic schemas for the Coding Questions Generator."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ── Literals ───────────────────────────────────────────────────────────────────

CodingLanguage = Literal["python", "java", "cpp", "javascript", "typescript", "go"]
CodingDifficulty = Literal["easy", "medium", "hard", "mixed"]
CodingQuestionType = Literal["solve", "debug", "trace", "fill"]


# ── Request ────────────────────────────────────────────────────────────────────

class CodingGenerateRequest(BunkerBaseModel):
    """Parameters for generating a set of coding questions."""

    language: CodingLanguage = "python"
    difficulty: CodingDifficulty = "medium"
    question_types: list[CodingQuestionType] = Field(
        default=["solve", "debug"],
        min_length=1,
        description="Which question types to include.",
    )
    count: int = Field(default=5, ge=1, le=10)
    topics: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Topics / syllabus text to base questions on.",
    )
    use_vault_context: bool = Field(
        default=True,
        description="Inject relevant vault resource chunks into the prompt.",
    )
    custom_instruction: str | None = Field(None, max_length=500)


# ── Per-question ───────────────────────────────────────────────────────────────

class CodingExample(BunkerBaseModel):
    input: str
    output: str
    explanation: str | None = None


class CodingQuestion(BunkerBaseModel):
    number: int
    type: CodingQuestionType
    title: str
    language: str
    difficulty: Literal["easy", "medium", "hard"]
    topic_hint: str | None = None
    problem: str                            # markdown problem statement
    code_snippet: str | None = None         # starter / buggy / trace code
    examples: list[CodingExample] = []
    constraints: list[str] = []
    hints: list[str] = []                   # progressive hints (1–3)
    solution: str                           # correct code
    solution_explanation: str              # prose explanation of solution


# ── Response ───────────────────────────────────────────────────────────────────

class CodingGenerateResponse(BunkerBaseModel):
    vault_id: UUID
    subject_name: str | None
    language: str
    difficulty: str
    requested_count: int
    generated_count: int
    topics: str
    questions: list[CodingQuestion]
    generated_at: datetime
    model_used: str | None = None


# ── Grading ────────────────────────────────────────────────────────────────────

class CodingGradeRequest(BunkerBaseModel):
    title: str
    type: CodingQuestionType
    problem: str
    language: str
    code: str
    solution: str
    examples: list[CodingExample] = []
    constraints: list[str] = []


class CodingGradeResponse(BunkerBaseModel):
    status: Literal["Accepted", "Wrong Answer", "Runtime Error", "Compilation Error", "Time Limit Exceeded"]
    test_cases_passed: int
    total_test_cases: int
    feedback: str
    compiler_output: str | None = None

