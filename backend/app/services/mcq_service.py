"""MCQ generation service.

Builds a structured prompt, calls the configured AI provider (OpenAI / Azure /
Gemini), and parses the JSON response into validated MCQQuestion objects.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import Vault, Subject
from app.schemas.mcq_schema import (
    MCQGenerateRequest,
    MCQGenerateResponse,
    MCQOption,
    MCQQuestion,
)
from app.schemas.auth import CurrentUser
from app.services.ai.factory import get_provider
from app.services.vault_service import _get_active_vault, _assert_squad_member
from app.core.exceptions import ValidationError

logger = structlog.get_logger()

_DIFFICULTY_GUIDANCE = {
    "easy": "straightforward recall and basic understanding questions suitable for beginners",
    "medium": "application and analysis questions requiring solid subject knowledge",
    "hard": "synthesis, evaluation, and tricky edge-case questions for advanced learners",
    "mixed": "a balanced mix of easy, medium, and hard questions",
}

_SYSTEM_PROMPT = """\
You are an expert academic MCQ generator. Your output must be valid JSON — \
nothing else, no prose, no markdown fences, just the raw JSON array.

Return a JSON array where each element is an object with these exact keys:
  "number"        : integer (1-based)
  "question"      : string — the question text
  "options"       : array of 4 objects, each {"key":"A"|"B"|"C"|"D","text":"..."}
  "correct_answer": "A"|"B"|"C"|"D"
  "explanation"   : string — why the answer is correct (2–4 sentences)
  "difficulty"    : "easy"|"medium"|"hard"
  "topic_hint"    : string — which sub-topic this tests (can be null)

Rules:
- All 4 distractors must be plausible, not obviously wrong
- No duplicate questions
- Do NOT include the answer inside the question text
- JSON must be parseable with json.loads()
"""


def _build_user_prompt(
    req: MCQGenerateRequest,
    subject_name: str | None,
    context_chunks: list[str],
) -> str:
    parts: list[str] = []

    if subject_name:
        parts.append(f"Subject: {subject_name}")

    parts.append(f"Difficulty: {req.difficulty} — {_DIFFICULTY_GUIDANCE.get(req.difficulty, '')}")
    parts.append(f"Number of questions: {req.count}")
    parts.append(f"\nTopics / Syllabus:\n{req.topics}")

    if context_chunks:
        combined = "\n\n---\n\n".join(context_chunks[:8])
        parts.append(
            f"\nAdditional context from study materials (use to enrich questions):\n{combined}"
        )

    if req.custom_instruction:
        parts.append(f"\nExtra instruction: {req.custom_instruction}")

    parts.append(
        f"\nGenerate exactly {req.count} high-quality MCQ questions. "
        "Return only the JSON array."
    )
    return "\n".join(parts)


def _parse_questions(raw: str, count: int) -> list[MCQQuestion]:
    """Extract and validate the JSON array from the model output."""
    # Strip any accidental markdown fences
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        # Attempt to extract the first [...] block
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
        else:
            raise ValidationError(f"AI returned invalid JSON: {exc}") from exc

    if not isinstance(data, list):
        raise ValidationError("AI response must be a JSON array of questions.")

    questions: list[MCQQuestion] = []
    for i, item in enumerate(data[:count], start=1):
        try:
            opts = [MCQOption(**o) for o in item.get("options", [])]
            q = MCQQuestion(
                number=item.get("number", i),
                question=item["question"],
                options=opts,
                correct_answer=item["correct_answer"],
                explanation=item.get("explanation", ""),
                difficulty=item.get("difficulty", "medium"),
                topic_hint=item.get("topic_hint"),
            )
            questions.append(q)
        except Exception as exc:
            logger.warning("mcq.parse.skip_question", index=i, error=str(exc))

    return questions


async def _fetch_vault_context(
    db: AsyncSession, user_id: UUID, vault_id: UUID, topics: str
) -> list[str]:
    """Try to pull relevant chunks from the vault via vector search."""
    try:
        from app.services.vector_search_service import search
        chunks = await search(db, vault_id=vault_id, query=topics, user_id=user_id, top_k=8)
        return [c.chunk.content for c in chunks]
    except Exception as exc:
        logger.warning("mcq.context.unavailable", error=str(exc))
        return []


async def generate_mcq(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    req: MCQGenerateRequest,
) -> MCQGenerateResponse:
    """Generate MCQs for a vault and return structured results."""
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

    # MCQ always uses Azure OpenAI (GPT-4o) as the generation backend.
    provider = get_provider("azure")
    model_name: str | None = getattr(provider, "name", None)

    # Collect full response (non-streaming for JSON reliability)
    full_text = ""
    async for event in provider.stream_chat(
        messages,
        temperature=0.5,
        max_tokens=3500,
    ):
        if event.type == "delta":
            full_text += event.text

    questions = _parse_questions(full_text, req.count)

    return MCQGenerateResponse(
        vault_id=vault_id,
        subject_name=subject_name,
        difficulty=req.difficulty,
        requested_count=req.count,
        generated_count=len(questions),
        topics=req.topics,
        questions=questions,
        generated_at=datetime.now(timezone.utc),
        model_used=model_name,
    )
