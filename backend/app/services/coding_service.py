"""Coding question generation service.

Builds a structured prompt, calls Azure OpenAI (GPT-4o), and parses
the JSON response into validated CodingQuestion objects.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import Subject, Vault
from app.schemas.coding_schema import (
    CodingExample,
    CodingGenerateRequest,
    CodingGenerateResponse,
    CodingQuestion,
)
from app.schemas.auth import CurrentUser
from app.services.ai.factory import get_provider
from app.services.vault_service import _get_active_vault, _assert_squad_member
from app.core.exceptions import ValidationError

logger = structlog.get_logger()

# ── Language display names ─────────────────────────────────────────────────────

_LANG_DISPLAY = {
    "python": "Python",
    "java": "Java",
    "cpp": "C++",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "go": "Go",
}

# ── Question-type guidance ─────────────────────────────────────────────────────

_TYPE_GUIDANCE = {
    "solve": (
        "SOLVE: provide a problem statement and a starter function/class with a docstring "
        "and `pass` body. The user must implement the solution. "
        "code_snippet = starter stub. solution = full working implementation."
    ),
    "debug": (
        "DEBUG: provide working-looking code that contains 1–2 deliberate logical or "
        "syntactic bugs. The user must find and fix them. "
        "code_snippet = buggy code. solution = corrected code."
    ),
    "trace": (
        "TRACE: provide a short self-contained code snippet (10–20 lines). "
        "The user must predict the exact printed output or return value. "
        "code_snippet = the code to trace. solution = exact expected output as a string."
    ),
    "fill": (
        "FILL: provide code with 1–3 blanks marked as `___`. "
        "The user must fill in the blanks to make the code correct. "
        "code_snippet = code with blanks. solution = completed code with blanks filled."
    ),
}

_DIFFICULTY_GUIDANCE = {
    "easy":   "straightforward, single-concept questions for beginners",
    "medium": "multi-step logic, standard algorithms and data structures",
    "hard":   "complex problems — optimisation, edge cases, advanced patterns",
    "mixed":  "a balanced spread of easy, medium, and hard questions",
}

_SYSTEM_PROMPT = """\
You are an expert coding-problem writer. Your output must be valid JSON — \
nothing else, no prose, no markdown fences, just the raw JSON array.

Return a JSON array where each element has these EXACT keys:
  "number"              : integer (1-based)
  "type"                : "solve" | "debug" | "trace" | "fill"
  "title"               : short descriptive title (≤ 60 chars)
  "language"            : the programming language used
  "difficulty"          : "easy" | "medium" | "hard"
  "topic_hint"          : string or null — which sub-topic this tests
  "problem"             : string — clear problem statement (plain text, no markdown)
  "code_snippet"        : string or null — starter / buggy / trace / fill code
  "examples"            : array of {\"input\":\"...\",\"output\":\"...\",\"explanation\":\"...\"} (0–3 items)
  "constraints"         : array of strings (0–5 constraints)
  "hints"               : array of 1–3 progressive hint strings
  "solution"            : string — the correct/complete code
  "solution_explanation": string — 2–4 sentences explaining the approach

Rules:
- Use real, runnable code (not pseudocode)
- Every code block must be plain text (no markdown backticks inside the JSON string)
- Escape newlines as \\n in JSON strings
- No duplicate questions
- JSON must be parseable with json.loads()
"""


def _build_user_prompt(
    req: CodingGenerateRequest,
    subject_name: str | None,
    context_chunks: list[str],
) -> str:
    parts: list[str] = []

    if subject_name:
        parts.append(f"Subject: {subject_name}")

    lang_display = _LANG_DISPLAY.get(req.language, req.language)
    parts.append(f"Programming Language: {lang_display}")
    parts.append(f"Difficulty: {req.difficulty} — {_DIFFICULTY_GUIDANCE.get(req.difficulty, '')}")
    parts.append(f"Number of questions: {req.count}")

    types_text = ", ".join(req.question_types)
    parts.append(f"Question types to include (distribute evenly): {types_text}")
    for t in req.question_types:
        parts.append(f"  • {_TYPE_GUIDANCE[t]}")

    parts.append(f"\nTopics / Syllabus:\n{req.topics}")

    if context_chunks:
        combined = "\n\n---\n\n".join(context_chunks[:6])
        parts.append(
            f"\nContext from study materials (use to inspire grounded questions):\n{combined}"
        )

    if req.custom_instruction:
        parts.append(f"\nExtra instruction: {req.custom_instruction}")

    parts.append(
        f"\nGenerate exactly {req.count} questions in {lang_display}. "
        "Distribute the requested types as evenly as possible. "
        "Return only the JSON array."
    )
    return "\n".join(parts)


def _parse_questions(raw: str, count: int) -> list[CodingQuestion]:
    """Extract and validate the JSON array from the model output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
        else:
            raise ValidationError(f"AI returned invalid JSON: {exc}") from exc

    if not isinstance(data, list):
        raise ValidationError("AI response must be a JSON array of questions.")

    questions: list[CodingQuestion] = []
    for i, item in enumerate(data[:count], start=1):
        try:
            examples = [
                CodingExample(**ex) for ex in item.get("examples", [])
            ]
            q = CodingQuestion(
                number=item.get("number", i),
                type=item.get("type", "solve"),
                title=item.get("title", f"Question {i}"),
                language=item.get("language", "python"),
                difficulty=item.get("difficulty", "medium"),
                topic_hint=item.get("topic_hint"),
                problem=item["problem"],
                code_snippet=item.get("code_snippet"),
                examples=examples,
                constraints=item.get("constraints", []),
                hints=item.get("hints", []),
                solution=item["solution"],
                solution_explanation=item.get("solution_explanation", ""),
            )
            questions.append(q)
        except Exception as exc:
            logger.warning("coding.parse.skip_question", index=i, error=str(exc))

    return questions


async def _fetch_vault_context(
    db: AsyncSession, user_id: UUID, vault_id: UUID, topics: str
) -> list[str]:
    """Try to pull relevant chunks from the vault via vector search."""
    try:
        from app.services.vector_search_service import search
        chunks = await search(db, vault_id=vault_id, query=topics, user_id=user_id, top_k=6)
        return [c.chunk.content for c in chunks]
    except Exception as exc:
        logger.warning("coding.context.unavailable", error=str(exc))
        return []


async def generate_coding_questions(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    req: CodingGenerateRequest,
) -> CodingGenerateResponse:
    """Generate coding questions for a vault and return structured results."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    # Get subject name
    subject_name: str | None = None
    if vault.subject_id:
        res = await db.execute(select(Subject).where(Subject.id == vault.subject_id))
        subj = res.scalar_one_or_none()
        if subj:
            subject_name = subj.name

    # Optionally pull vault context
    context_chunks: list[str] = []
    if req.use_vault_context:
        context_chunks = await _fetch_vault_context(db, user.id, vault_id, req.topics)

    # Build messages
    user_prompt = _build_user_prompt(req, subject_name, context_chunks)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # Always use Azure OpenAI (GPT-4o) for coding question generation
    provider = get_provider("azure")
    model_name: str | None = getattr(provider, "name", None)

    full_text = ""
    async for event in provider.stream_chat(
        messages,
        temperature=0.6,
        max_tokens=4000,
    ):
        if event.type == "delta":
            full_text += event.text

    questions = _parse_questions(full_text, req.count)

    return CodingGenerateResponse(
        vault_id=vault_id,
        subject_name=subject_name,
        language=req.language,
        difficulty=req.difficulty,
        requested_count=req.count,
        generated_count=len(questions),
        topics=req.topics,
        questions=questions,
        generated_at=datetime.now(timezone.utc),
        model_used=model_name,
    )


_GRADER_SYSTEM_PROMPT = """\
You are an advanced sandboxed compiler and coding problem test runner.
Your job is to dry-run/simulate the execution of the user's submitted code against the problem statement, examples, constraints, and standard reference solution.

Return a JSON object with these EXACT keys:
  "status"            : "Accepted" | "Wrong Answer" | "Runtime Error" | "Compilation Error" | "Time Limit Exceeded"
  "test_cases_passed" : integer
  "total_test_cases"  : integer
  "feedback"          : string — detailed helpful review of the user's approach, code style, or logical flaws. If compilation/runtime error, explain exactly where.
  "compiler_output"   : string or null — simulated stdout / stderr or exception traceback

Rules:
- Be extremely rigorous. If the code has syntax errors (e.g. missing colons, invalid braces) or runtime errors (e.g. IndexError, NameError, NullPointer), return status = "Compilation Error" or "Runtime Error" and provide the exact exception trace in compiler_output.
- Check edge cases (e.g. empty lists, negative inputs, null values).
- If the user submitted empty or gibberish code, it must fail with "Compilation Error" or "Wrong Answer".
- Return ONLY the JSON object. No markdown backticks or prose.
"""


async def grade_coding_question(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    req: CodingGradeRequest,
) -> CodingGradeResponse:
    """Grade a user's code submission using Azure OpenAI (GPT-4o) as a simulator judge."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    examples_text = "\n".join(
        f"Example {i+1}:\nInput: {ex.input}\nOutput: {ex.output}\n"
        for i, ex in enumerate(req.examples)
    )
    constraints_text = "\n".join(f"- {c}" for c in req.constraints)

    user_prompt = f"""\
Problem Title: {req.title}
Language: {req.language}
Question Type: {req.type}

[PROBLEM STATEMENT]
{req.problem}

[EXAMPLES]
{examples_text}

[CONSTRAINTS]
{constraints_text}

[REFERENCE SOLUTION]
{req.solution}

[USER SUBMISSION]
{req.code}

Evaluate the user's code. Simulate compilation and execution with multiple test cases (including edge cases).
Return only the JSON object.
"""

    messages = [
        {"role": "system", "content": _GRADER_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    provider = get_provider("azure")
    full_text = ""
    async for event in provider.stream_chat(
        messages,
        temperature=0.2,
        max_tokens=2500,
    ):
        if event.type == "delta":
            full_text += event.text

    # Parse response
    raw = full_text.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
        else:
            raise ValidationError(f"Grader returned invalid JSON: {exc}") from exc

    from app.schemas.coding_schema import CodingGradeResponse as GradeResponse
    return GradeResponse(
        status=data.get("status", "Wrong Answer"),
        test_cases_passed=data.get("test_cases_passed", 0),
        total_test_cases=data.get("total_test_cases", 5),
        feedback=data.get("feedback", "No feedback provided."),
        compiler_output=data.get("compiler_output"),
    )

