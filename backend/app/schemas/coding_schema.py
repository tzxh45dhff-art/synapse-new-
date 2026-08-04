"""Pydantic schemas for the Coding Questions Generator.

Every field added after the first release carries a default, because saved
question sets live in a JSONB column and are re-parsed with this model.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ── Literals ───────────────────────────────────────────────────────────────────

CodingLanguage = Literal["python", "java", "c", "cpp", "javascript", "typescript", "go"]
CodingDifficulty = Literal["easy", "medium", "hard", "mixed"]
CodingQuestionType = Literal["solve", "debug", "trace", "fill"]
CodingIOMode = Literal["function", "stdio"]
ComparisonMode = Literal["trim", "exact", "ignore_case", "unordered", "float"]
GradeStatus = Literal[
    "Accepted",
    "Wrong Answer",
    "Runtime Error",
    "Compilation Error",
    "Time Limit Exceeded",
]


# ── Request ────────────────────────────────────────────────────────────────────

class CodingGenerateRequest(BunkerBaseModel):
    """Parameters for generating a set of coding questions."""

    language: CodingLanguage | None = Field(
        default=None,
        description="Explicit language override. If omitted, inferred from the vault's subject.",
    )
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
    resource_ids: list[UUID] = Field(
        default_factory=list,
        description="Restrict context to these resources. Empty = whole vault.",
    )
    extract_exact: bool = Field(
        default=False,
        description="Pull exact/verbatim questions out of the selected resources "
        "(e.g. an uploaded question bank) instead of only generating new ones. "
        "If fewer exact questions exist than requested, the rest are generated as practice.",
    )
    custom_instruction: str | None = Field(None, max_length=500)


# ── Per-question ───────────────────────────────────────────────────────────────

class CodingExample(BunkerBaseModel):
    input: str
    output: str
    explanation: str | None = None


class CodingTestCase(BunkerBaseModel):
    """One executable assertion.

    ``function`` mode uses ``args`` + ``expected``; ``stdio`` mode uses
    ``stdin`` + ``expected_stdout``. Hidden cases are never sent to the browser
    before submission, which is what stops a hardcoded answer from passing.
    """

    name: str | None = None
    args: list[Any] | None = None
    kwargs: dict[str, Any] | None = None
    stdin: str | None = None
    expected: Any = None
    expected_stdout: str | None = None
    hidden: bool = False
    explanation: str | None = None


class CodingQuestion(BunkerBaseModel):
    number: int
    type: CodingQuestionType
    title: str
    language: str
    difficulty: Literal["easy", "medium", "hard"]
    topic_hint: str | None = None
    problem: str                            # problem statement
    code_snippet: str | None = None         # starter / buggy / trace / fill code
    examples: list[CodingExample] = []
    constraints: list[str] = []
    hints: list[str] = []                   # progressive hints (1–3)
    solution: str                           # correct code
    solution_explanation: str = ""          # prose explanation of solution

    # ── Execution contract (added in the "real test runner" release) ──────────
    io_mode: CodingIOMode = "function"
    entry_point: str | None = None
    test_cases: list[CodingTestCase] = []
    comparison: ComparisonMode = "trim"
    float_tolerance: float = 1e-6
    time_limit_ms: int = Field(default=4000, ge=500, le=15000)
    # True once the reference solution has been executed against every case and
    # the expected values agreed (or were corrected to match).
    tests_verified: bool = False
    # For TRACE questions: the snippet's real stdout, captured by running it.
    expected_output: str | None = None
    complexity: str | None = None           # e.g. "O(n) time, O(1) space"
    # Client-facing only: how many hidden cases exist, without revealing them.
    hidden_test_count: int = 0

    @property
    def is_executable(self) -> bool:
        """Can this question be graded by really running code?"""
        if self.type == "trace":
            return bool(self.expected_output)
        return bool(self.test_cases)

    def public_copy(self) -> "CodingQuestion":
        """A copy safe to send to the browser.

        Hidden test cases and the expected trace output are the answer key —
        shipping them would let anyone read the answers out of the network tab,
        which is exactly what hidden tests exist to prevent.
        """
        clone = self.model_copy(deep=True)
        clone.hidden_test_count = sum(1 for case in self.test_cases if case.hidden)
        clone.test_cases = [case for case in self.test_cases if not case.hidden]
        clone.expected_output = None
        return clone


# ── Response ───────────────────────────────────────────────────────────────────

class CodingGenerateResponse(BunkerBaseModel):
    id: str | None = None               # persisted set id (UUID as string)
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
    # How many questions ended up with executable, verified test cases.
    verified_count: int = 0
    runtime_available: bool = True
    warnings: list[str] = []


# ── Persisted set schemas ─────────────────────────────────────────────────────

class CodingSetListItem(BunkerBaseModel):
    """Lightweight representation for listing saved coding sets."""
    id: str
    title: str
    language: str
    difficulty: str
    question_count: int
    topics: str
    subject_name: str | None = None
    created_by: str
    created_at: datetime


class CodingSetDetail(BunkerBaseModel):
    """Full coding question set including all questions."""
    id: str
    vault_id: str
    title: str
    language: str
    difficulty: str
    topics: str
    question_count: int
    questions: list[CodingQuestion]
    subject_name: str | None = None
    model_used: str | None = None
    created_by: str
    created_at: datetime


# ── Runtime capability ────────────────────────────────────────────────────────

class CodingRuntimeInfo(BunkerBaseModel):
    language: str
    display: str
    available: bool
    version: str | None = None
    reason: str | None = None


# ── Grading ────────────────────────────────────────────────────────────────────

class CodingGradeRequest(BunkerBaseModel):
    """A submission to grade.

    Prefer ``set_id`` + ``question_number``: the backend then loads the trusted
    stored question, so the browser can neither see nor rewrite hidden tests.
    The inline fields remain for freshly generated, unsaved sets.
    """

    code: str
    set_id: UUID | None = None
    question_number: int | None = None
    # Run only the visible sample cases ("Run") vs the full suite ("Submit").
    sample_only: bool = False

    # Inline fallback (used when set_id is not supplied)
    title: str = ""
    type: CodingQuestionType = "solve"
    problem: str = ""
    language: str = "python"
    solution: str = ""
    examples: list[CodingExample] = []
    constraints: list[str] = []


class CodingTestResult(BunkerBaseModel):
    index: int
    name: str | None = None
    hidden: bool = False
    passed: bool = False
    skipped: bool = False
    input_display: str | None = None
    expected_display: str | None = None
    actual_display: str | None = None
    stdout: str | None = None
    error: str | None = None
    duration_ms: int = 0


class CodingGradeResponse(BunkerBaseModel):
    status: GradeStatus
    test_cases_passed: int
    total_test_cases: int
    feedback: str
    compiler_output: str | None = None

    # ── Provenance so the UI never claims more certainty than it has ──────────
    # "executed"  — code really ran in the sandbox
    # "simulated" — no runtime for this language on the server; AI reviewed it
    engine: Literal["executed", "simulated"] = "simulated"
    results: list[CodingTestResult] = []
    runtime_ms: int = 0
    hidden_passed: int = 0
    hidden_total: int = 0
    sample_only: bool = False
    warnings: list[str] = []
