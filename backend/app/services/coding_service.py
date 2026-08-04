"""Coding question generation and grading.

Generation asks the model for an executable contract (entry point, runnable
reference solution, concrete test cases), then **runs the reference solution**
to repair or drop any test case the model got wrong. Grading then executes the
learner's submission against those verified cases, so printing or hardcoding
the sample answer fails the hidden cases the way it should.

See ``app/services/coding/`` for prompts, parsing, verification and grading, and
``app/services/execution/`` for the sandbox itself.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.models.mcq_coding_set import CodingSet
from app.models.vault import Subject
from app.schemas.auth import CurrentUser
from app.schemas.coding_schema import (
    CodingGenerateRequest,
    CodingGenerateResponse,
    CodingGradeRequest,
    CodingGradeResponse,
    CodingLanguage,
    CodingQuestion,
    CodingRuntimeInfo,
    CodingSetDetail,
    CodingSetListItem,
)
from app.services.ai.factory import get_provider
from app.services.coding import grading, parsing, verification
from app.services.coding.prompts import (
    REPAIR_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_generation_prompt,
)
from app.services.execution.runtimes import (
    detect_runtimes,
    display_name,
    is_language_executable,
    normalise_language,
)
from app.services.notes_service import _assert_resources_in_vault
from app.services.vault_service import _assert_squad_member, _get_active_vault

logger = structlog.get_logger()

# Smaller batches keep every question inside the model's reliable output window,
# which is what stops half-written JSON and duplicate problems.
_BATCH_SIZE = 3
_GENERATION_TIMEOUT_S = 180.0
_MAX_OUTPUT_TOKENS = 8000


# ── Language inference from subject name ───────────────────────────────────────
# Ordered so more specific keywords (e.g. "javascript") are checked before
# substrings they contain (e.g. "java"). Plain "c" is handled separately with a
# strict word-boundary match — checked last so "c++"/"cpp" claim those first.

import re  # noqa: E402  (kept next to the table it serves)

_LANG_KEYWORDS: list[tuple[str, CodingLanguage]] = [
    ("c++", "cpp"),
    ("cpp", "cpp"),
    ("typescript", "typescript"),
    ("javascript", "javascript"),
    ("golang", "go"),
    (" go ", "go"),
    ("java", "java"),
    ("python", "python"),
]

_C_WORD = re.compile(r"\bc\b")

_DEFAULT_LANGUAGE: CodingLanguage = "python"


def _infer_language(subject_name: str | None) -> CodingLanguage:
    """Guess the coding language from the vault's subject name.

    Falls back to Python (the common default for DSA/algorithms subjects
    like "DSA" or "LeetCode" that name no specific language).
    """
    if not subject_name:
        return _DEFAULT_LANGUAGE
    lower = f" {subject_name.lower()} "
    for keyword, lang in _LANG_KEYWORDS:
        if keyword in lower:
            return lang
    if _C_WORD.search(lower):
        return "c"
    return _DEFAULT_LANGUAGE


def _build_title(topics: str, language: str, difficulty: str) -> str:
    """Derive a human-readable title for a saved coding set."""
    snippet = topics.strip()[:50].strip()
    if len(topics.strip()) > 50:
        snippet += "…"
    return f"{snippet} — {display_name(language)} ({difficulty.capitalize()})"


def _plan_batches(count: int, types: list[str]) -> list[tuple[int, list[str]]]:
    """Split the request into batches, spreading question types across them."""
    batches: list[tuple[int, list[str]]] = []
    remaining = count
    cursor = 0
    while remaining > 0:
        size = min(_BATCH_SIZE, remaining)
        batch_types = [types[(cursor + offset) % len(types)] for offset in range(size)]
        # Preserve order but drop duplicates so the guidance stays short.
        deduped = list(dict.fromkeys(batch_types))
        batches.append((size, deduped))
        cursor += size
        remaining -= size
    return batches


# ── Context retrieval ─────────────────────────────────────────────────────────


async def _fetch_vault_context(
    db: AsyncSession,
    user_id: UUID,
    vault_id: UUID,
    topics: str,
    resource_ids: list[UUID] | None = None,
) -> list[str]:
    """Pull relevant chunks from the vault (or selected resources) via vector search."""
    try:
        from app.services.vector_search_service import search

        chunks = await search(
            db, vault_id=vault_id, query=topics, user_id=user_id, top_k=6,
            resource_ids=resource_ids or None,
        )
        return [c.chunk.content for c in chunks]
    except Exception as exc:  # noqa: BLE001 — context is an enhancement, not a requirement
        logger.warning("coding.context.unavailable", error=str(exc))
        return []


async def _fetch_exact_context(db: AsyncSession, resource_ids: list[UUID]) -> list[str]:
    """Pull the full content of the selected resources, in document order.

    Used for exact-extraction mode: a top-k semantic search only returns
    fragments relevant to the topics query, which isn't enough to reliably
    lift whole questions verbatim out of a question bank / syllabus PDF.
    """
    from app.repositories.chunk_repository import ChunkRepository

    repo = ChunkRepository(db)
    chunks = await repo.get_by_resources(resource_ids, limit=60)
    return [c.content for c in chunks]


# ── Model calls ───────────────────────────────────────────────────────────────


async def _complete(
    messages: list[dict[str, str]], *, temperature: float, max_tokens: int
) -> str:
    provider = get_provider("azure")
    text = ""

    async def collect() -> None:
        nonlocal text
        async for event in provider.stream_chat(
            messages, temperature=temperature, max_tokens=max_tokens  # type: ignore[arg-type]
        ):
            if event.type == "delta":
                text += event.text

    await asyncio.wait_for(collect(), timeout=_GENERATION_TIMEOUT_S)
    return text


async def _repair_json(raw: str) -> str:
    """Ask the model to fix its own malformed array — cheaper than regenerating."""
    try:
        return await _complete(
            [
                {"role": "system", "content": REPAIR_SYSTEM_PROMPT},
                {"role": "user", "content": raw[:24000]},
            ],
            temperature=0.0,
            max_tokens=_MAX_OUTPUT_TOKENS,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("coding.generate.repair_failed", error=str(exc))
        return ""


async def _generate_batch(
    req: CodingGenerateRequest,
    *,
    subject_name: str | None,
    language: str,
    batch_count: int,
    batch_types: list[str],
    context_chunks: list[str],
    exact_mode: bool,
    avoid_titles: list[str],
    start_number: int,
) -> list[CodingQuestion]:
    prompt = build_generation_prompt(
        req,
        subject_name=subject_name,
        language=language,
        batch_count=batch_count,
        batch_types=batch_types,
        context_chunks=context_chunks,
        exact_mode=exact_mode,
        avoid_titles=avoid_titles,
        start_number=start_number,
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    raw = await _complete(messages, temperature=0.55, max_tokens=_MAX_OUTPUT_TOKENS)
    questions = parsing.parse_questions(
        raw, language=language, start_number=start_number, limit=batch_count
    )
    if questions:
        return questions

    logger.warning("coding.generate.parse_empty", batch=batch_count)
    repaired = await _repair_json(raw)
    return parsing.parse_questions(
        repaired, language=language, start_number=start_number, limit=batch_count
    )


# ── Generation ────────────────────────────────────────────────────────────────


async def generate_coding_questions(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    req: CodingGenerateRequest,
) -> CodingGenerateResponse:
    """Generate coding questions for a vault, verify them, persist and return them."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)
    await _assert_resources_in_vault(db, vault_id, req.resource_ids)

    subject_name: str | None = None
    if vault.subject_id:
        result = await db.execute(select(Subject).where(Subject.id == vault.subject_id))
        subject = result.scalar_one_or_none()
        if subject:
            subject_name = subject.name

    language = normalise_language(req.language or _infer_language(subject_name))

    # Exact mode reads the full selected resources; otherwise a topics-scoped
    # semantic search (optionally narrowed to the selected resources).
    exact_mode = req.extract_exact and bool(req.resource_ids)
    context_chunks: list[str] = []
    if exact_mode:
        context_chunks = await _fetch_exact_context(db, req.resource_ids)
    elif req.use_vault_context:
        context_chunks = await _fetch_vault_context(
            db, user.id, vault_id, req.topics, resource_ids=req.resource_ids
        )

    questions: list[CodingQuestion] = []
    for batch_count, batch_types in _plan_batches(req.count, list(req.question_types)):
        try:
            batch = await _generate_batch(
                req,
                subject_name=subject_name,
                language=language,
                batch_count=batch_count,
                batch_types=batch_types,
                context_chunks=context_chunks,
                exact_mode=exact_mode,
                avoid_titles=[question.title for question in questions],
                start_number=len(questions) + 1,
            )
        except asyncio.TimeoutError:
            logger.warning("coding.generate.timeout", generated=len(questions))
            break
        except Exception as exc:  # noqa: BLE001 — keep whatever we already have
            logger.exception("coding.generate.batch_failed", error=str(exc))
            break

        seen = {question.title.strip().lower() for question in questions}
        for question in batch:
            if question.title.strip().lower() in seen:
                continue
            question.number = len(questions) + 1
            questions.append(question)
            seen.add(question.title.strip().lower())

    if not questions:
        raise ValidationError(
            "The generator could not produce usable questions for those topics. "
            "Try describing the topics more specifically, or lower the count."
        )

    # Execute every reference solution: correct the expected values the model
    # guessed wrong, drop cases it cannot survive, capture real trace output.
    questions, warnings = await verification.verify_questions(questions)
    verified_count = sum(1 for question in questions if question.tests_verified)

    generated_at = datetime.now(timezone.utc)
    provider_name = getattr(get_provider("azure"), "name", None)

    coding_set = CodingSet(
        vault_id=vault_id,
        created_by=user.id,
        title=_build_title(req.topics, language, req.difficulty),
        language=language,
        difficulty=req.difficulty,
        topics=req.topics,
        question_count=len(questions),
        questions=[question.model_dump(mode="json") for question in questions],
        subject_name=subject_name,
        model_used=provider_name,
    )
    db.add(coding_set)
    await db.flush()

    logger.info(
        "coding.set.saved",
        set_id=str(coding_set.id),
        vault_id=str(vault_id),
        count=len(questions),
        verified=verified_count,
    )

    return CodingGenerateResponse(
        id=str(coding_set.id),
        vault_id=vault_id,
        subject_name=subject_name,
        language=language,
        difficulty=req.difficulty,
        requested_count=req.count,
        generated_count=len(questions),
        topics=req.topics,
        questions=[question.public_copy() for question in questions],
        generated_at=generated_at,
        model_used=provider_name,
        verified_count=verified_count,
        runtime_available=is_language_executable(language),
        warnings=warnings,
    )


# ── Grading ───────────────────────────────────────────────────────────────────


async def _load_question(
    db: AsyncSession, vault_id: UUID, set_id: UUID, number: int
) -> CodingQuestion | None:
    """Load a stored question so hidden tests never round-trip through the client."""
    result = await db.execute(
        select(CodingSet).where(
            CodingSet.id == set_id,
            CodingSet.vault_id == vault_id,
            CodingSet.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    for raw in row.questions or []:
        if int(raw.get("number", 0)) == number:
            try:
                return CodingQuestion(**raw)
            except Exception as exc:  # noqa: BLE001
                logger.warning("coding.grade.question_unreadable", error=str(exc))
                return None
    return None


async def grade_coding_question(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    req: CodingGradeRequest,
) -> CodingGradeResponse:
    """Grade a submission — by really running it whenever that is possible."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    question: CodingQuestion | None = None
    if req.set_id and req.question_number:
        question = await _load_question(db, vault_id, req.set_id, req.question_number)

    if question is None:
        # Freshly generated, unsaved, or a legacy client: grade from the payload.
        if not req.problem or not req.solution:
            raise ValidationError("Could not find the question for this submission.")
        question = CodingQuestion(
            number=req.question_number or 1,
            type=req.type,
            title=req.title or "Coding problem",
            language=normalise_language(req.language),
            difficulty="medium",
            problem=req.problem,
            solution=req.solution,
            examples=req.examples,
            constraints=req.constraints,
        )

    return await grading.grade(question, req.code, sample_only=req.sample_only)


# ── Runtime capability ────────────────────────────────────────────────────────


def list_runtimes() -> list[CodingRuntimeInfo]:
    """Which languages this server can actually execute."""
    return [
        CodingRuntimeInfo(
            language=info.language,
            display=info.display,
            available=info.available,
            version=info.version,
            reason=info.reason,
        )
        for info in detect_runtimes().values()
    ]


# ── List / Get / Delete saved sets ────────────────────────────────────────────


async def list_coding_sets(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
) -> list[CodingSetListItem]:
    """List all non-deleted coding sets for a vault (accessible by any squad member)."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    stmt = (
        select(CodingSet)
        .where(CodingSet.vault_id == vault_id, CodingSet.deleted_at.is_(None))
        .order_by(CodingSet.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        CodingSetListItem(
            id=str(row.id),
            title=row.title,
            language=row.language,
            difficulty=row.difficulty,
            question_count=row.question_count,
            topics=row.topics,
            subject_name=row.subject_name,
            created_by=str(row.created_by),
            created_at=row.created_at,
        )
        for row in rows
    ]


async def get_coding_set(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    set_id: UUID,
) -> CodingSetDetail:
    """Load a single coding set with full questions."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    stmt = select(CodingSet).where(
        CodingSet.id == set_id,
        CodingSet.vault_id == vault_id,
        CodingSet.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise ValidationError("Coding set not found.")

    questions: list[CodingQuestion] = []
    for raw in row.questions or []:
        try:
            questions.append(CodingQuestion(**raw))
        except Exception as exc:  # noqa: BLE001 — never lose a whole set to one bad row
            logger.warning("coding.set.question_unreadable", set_id=str(set_id), error=str(exc))

    return CodingSetDetail(
        id=str(row.id),
        vault_id=str(row.vault_id),
        title=row.title,
        language=row.language,
        difficulty=row.difficulty,
        topics=row.topics,
        question_count=len(questions),
        questions=[question.public_copy() for question in questions],
        subject_name=row.subject_name,
        model_used=row.model_used,
        created_by=str(row.created_by),
        created_at=row.created_at,
    )


async def delete_coding_set(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    set_id: UUID,
) -> None:
    """Soft-delete a coding set (creator only)."""
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    stmt = select(CodingSet).where(
        CodingSet.id == set_id,
        CodingSet.vault_id == vault_id,
        CodingSet.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise ValidationError("Coding set not found.")

    if row.created_by != user.id:
        raise ValidationError("Only the creator can delete this coding set.")

    row.deleted_at = datetime.now(timezone.utc)
    logger.info("coding.set.deleted", set_id=str(set_id), by=str(user.id))
