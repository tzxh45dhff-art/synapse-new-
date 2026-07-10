"""Flashcard generation and spaced-repetition review.

Flashcards are generated once per vault (shared study material, like MCQs and
coding questions), but each squad member keeps their own SpacedRepetitionState
— reviewing a shared deck doesn't affect anyone else's schedule. Uses a
simplified SM-2: correct reviews grow the interval by the ease factor, an
"again" resets it.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.flashcard import Flashcard, FlashcardReview, SpacedRepetitionState
from app.models.squad import SquadMember
from app.models.vault import Subject, Vault
from app.schemas.auth import CurrentUser
from app.schemas.intelligence_schema import FlashcardGenerateRequest, FlashcardRead
from app.services.ai import get_provider
from app.services.vault_service import _assert_squad_member, _get_active_vault

logger = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are an expert flashcard writer for spaced-repetition study. Output must be \
valid JSON — nothing else, no prose, no markdown fences.

Return a JSON array where each element is an object with exactly these keys:
  "front": string — a short question or term (one line)
  "back":  string — a concise, correct answer/definition (1-3 sentences)

Rules:
- No duplicate cards
- Front must be answerable from the back alone (self-contained)
- Keep answers precise and exam-relevant, not vague
- CRITICAL: never use a double-quote character ("...") for emphasis anywhere
  inside "front" or "back" text — it breaks JSON parsing. Use single quotes
  ('...') or backticks instead if you need to quote a word or term.
"""

# Reviewing an "again" card resurfaces it soon rather than resetting to a full day.
_AGAIN_DELAY = timedelta(minutes=10)


async def _fetch_context(db: AsyncSession, user_id: UUID, vault_id: UUID, query: str) -> list[str]:
    try:
        from app.services.vector_search_service import search
        chunks = await search(db, vault_id=vault_id, query=query, user_id=user_id, top_k=10)
        return [c.chunk.content for c in chunks]
    except Exception as exc:
        logger.warning("flashcards.context.unavailable", error=str(exc))
        return []


def _parse_cards(raw: str, count: int) -> list[tuple[str, str]]:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            raise ValidationError(f"AI returned invalid JSON: {exc}") from exc
        data = json.loads(match.group(0))

    if not isinstance(data, list):
        raise ValidationError("AI response must be a JSON array of flashcards.")

    cards: list[tuple[str, str]] = []
    for item in data[:count]:
        front, back = item.get("front"), item.get("back")
        if front and back:
            cards.append((str(front).strip(), str(back).strip()))
    return cards


async def generate_flashcards(
    db: AsyncSession, user: CurrentUser, vault_id: UUID, req: FlashcardGenerateRequest
) -> list[FlashcardRead]:
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    subject_name: str | None = None
    if vault.subject_id:
        res = await db.execute(select(Subject).where(Subject.id == vault.subject_id))
        subj = res.scalar_one_or_none()
        subject_name = subj.name if subj else None

    topic_query = req.topics or subject_name or vault.title
    context_chunks = await _fetch_context(db, user.id, vault_id, topic_query)

    parts = [f"Vault topic: {topic_query}"]
    if context_chunks:
        parts.append("Source material:\n" + "\n\n---\n\n".join(context_chunks[:8]))
    parts.append(f"\nGenerate exactly {req.count} flashcards. Return only the JSON array.")

    provider = get_provider()
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(parts)},
    ]

    # The model occasionally embeds an unescaped quote in a definition, breaking
    # JSON — retry once before giving up rather than failing on a coin flip.
    cards: list[tuple[str, str]] = []
    last_error: Exception | None = None
    for attempt in range(2):
        full_text = ""
        async for event in provider.stream_chat(messages, temperature=0.3, max_tokens=2000):
            if event.type == "delta":
                full_text += event.text
        try:
            cards = _parse_cards(full_text, req.count)
            if cards:
                break
        except ValidationError as exc:
            last_error = exc
            logger.warning("flashcards.parse_retry", attempt=attempt, error=str(exc))

    if not cards:
        raise last_error or ValidationError("AI failed to generate flashcards. Try again or add more resources.")

    now = datetime.now(timezone.utc)
    created: list[Flashcard] = []
    for front, back in cards:
        card = Flashcard(vault_id=vault_id, created_by=user.id, front=front, back=back)
        db.add(card)
        created.append(card)
    await db.flush()

    for card in created:
        db.add(SpacedRepetitionState(flashcard_id=card.id, user_id=user.id, next_review_at=now))
    await db.commit()

    return [
        FlashcardRead(
            id=c.id, vault_id=vault_id, vault_title=vault.title,
            front=c.front, back=c.back, difficulty=c.difficulty,
            status="new", next_review_at=now,
        )
        for c in created
    ]


async def get_due_flashcards(db: AsyncSession, user: CurrentUser, limit: int = 5) -> list[FlashcardRead]:
    member_vaults = (
        select(Vault.id)
        .join(SquadMember, SquadMember.squad_id == Vault.squad_id)
        .where(SquadMember.user_id == user.id, SquadMember.removed_at.is_(None), Vault.deleted_at.is_(None))
    )

    stmt = (
        select(Flashcard, SpacedRepetitionState, Vault.title)
        .join(Vault, Vault.id == Flashcard.vault_id)
        .outerjoin(
            SpacedRepetitionState,
            (SpacedRepetitionState.flashcard_id == Flashcard.id)
            & (SpacedRepetitionState.user_id == user.id),
        )
        .where(Flashcard.vault_id.in_(member_vaults), Flashcard.deleted_at.is_(None))
        .order_by(SpacedRepetitionState.next_review_at.asc().nulls_first())
        .limit(limit * 3)  # over-fetch since not-yet-reviewed rows have no state to filter on in SQL
    )
    rows = (await db.execute(stmt)).all()

    now = datetime.now(timezone.utc)
    due: list[FlashcardRead] = []
    for card, state, vault_title in rows:
        next_review = state.next_review_at if state else now
        if next_review > now:
            continue
        due.append(
            FlashcardRead(
                id=card.id, vault_id=card.vault_id, vault_title=vault_title,
                front=card.front, back=card.back, difficulty=card.difficulty,
                status=state.status if state else "new", next_review_at=next_review,
            )
        )
        if len(due) >= limit:
            break
    return due


async def review_flashcard(db: AsyncSession, user: CurrentUser, flashcard_id: UUID, rating: int) -> None:
    card = (
        await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id, Flashcard.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if card is None:
        raise NotFoundError("Flashcard")

    vault = await _get_active_vault(db, card.vault_id)
    await _assert_squad_member(db, vault, user.id)

    state = (
        await db.execute(
            select(SpacedRepetitionState).where(
                SpacedRepetitionState.flashcard_id == flashcard_id,
                SpacedRepetitionState.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if state is None:
        state = SpacedRepetitionState(flashcard_id=flashcard_id, user_id=user.id, next_review_at=now)
        db.add(state)

    ease = float(state.ease_factor)
    if rating == 0:  # again
        state.repetitions = 0
        state.interval_days = 0
        state.ease_factor = max(1.3, ease - 0.2)
        state.next_review_at = now + _AGAIN_DELAY
        state.status = "learning"
    else:
        if state.repetitions == 0:
            interval = 1.0
        elif state.repetitions == 1:
            interval = 6.0
        else:
            interval = float(state.interval_days) * ease
        quality = rating + 2  # map 1..3 -> SM-2 quality 3..5
        new_ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        state.ease_factor = max(1.3, new_ease)
        state.interval_days = round(interval, 2)
        state.repetitions += 1
        state.next_review_at = now + timedelta(days=interval)
        state.status = "review" if state.repetitions > 1 else "learning"

    state.last_reviewed_at = now
    db.add(FlashcardReview(flashcard_id=flashcard_id, user_id=user.id, rating=rating))
    await db.commit()
