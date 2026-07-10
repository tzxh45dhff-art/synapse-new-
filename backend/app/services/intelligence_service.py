"""Practice-attempt tracking and dashboard insights.

Every MCQ/coding practice attempt is recorded here as a StudySession, which
drives three real, derived signals: a daily streak (StudyStreak), per-topic
mastery (TopicMastery, cumulative average of score_pct), and the dashboard's
activity heatmap / score trend. Nothing here is fabricated — a brand-new user
with zero attempts gets zero-valued, honestly-empty results.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flashcard import Flashcard, SpacedRepetitionState
from app.models.intelligence import StudySession, StudyStreak, TopicMastery
from app.models.vault import Subject, Vault
from app.schemas.auth import CurrentUser
from app.schemas.intelligence_schema import (
    DashboardInsights,
    HeatmapDay,
    MasteryTopic,
    PracticeAttemptCreate,
    ScoreTrendPoint,
    StreakRead,
    VaultInsights,
)
from app.services.vault_service import _assert_squad_member, _get_active_vault

logger = structlog.get_logger()

HEATMAP_WEEKS = 16
SCORE_TREND_LIMIT = 14


async def _resolve_topic(db: AsyncSession, vault: Vault, requested: str | None) -> str:
    if requested and requested.strip():
        return requested.strip()[:300]
    if vault.subject_id:
        res = await db.execute(select(Subject).where(Subject.id == vault.subject_id))
        subj = res.scalar_one_or_none()
        if subj:
            return subj.name
    return vault.title


async def _touch_streak(db: AsyncSession, user_id: UUID) -> None:
    result = await db.execute(select(StudyStreak).where(StudyStreak.user_id == user_id))
    streak = result.scalar_one_or_none()
    today = datetime.now(timezone.utc).date()

    if streak is None:
        db.add(StudyStreak(user_id=user_id, current_streak=1, longest_streak=1, last_study_date=today))
        return

    if streak.last_study_date == today:
        return  # already counted today
    if streak.last_study_date == today - timedelta(days=1):
        streak.current_streak += 1
    else:
        streak.current_streak = 1
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.last_study_date = today


async def _update_topic_mastery(
    db: AsyncSession, user_id: UUID, vault_id: UUID, topic: str, score_pct: float
) -> None:
    result = await db.execute(
        select(TopicMastery).where(
            TopicMastery.user_id == user_id,
            TopicMastery.vault_id == vault_id,
            TopicMastery.topic == topic,
        )
    )
    mastery = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if mastery is None:
        db.add(
            TopicMastery(
                user_id=user_id,
                vault_id=vault_id,
                topic=topic,
                mastery_score=score_pct,
                confidence=10,
                quiz_attempts=1,
                last_assessed_at=now,
            )
        )
        return

    # Cumulative average — smooths outliers, easy to reason about ("your average
    # accuracy on this topic across all attempts") rather than an opaque EMA.
    total = float(mastery.mastery_score) * mastery.quiz_attempts + score_pct
    mastery.quiz_attempts += 1
    mastery.mastery_score = total / mastery.quiz_attempts
    mastery.confidence = min(100, mastery.quiz_attempts * 10)
    mastery.last_assessed_at = now


async def record_practice_attempt(
    db: AsyncSession, user: CurrentUser, data: PracticeAttemptCreate
) -> None:
    vault = await _get_active_vault(db, data.vault_id)
    await _assert_squad_member(db, vault, user.id)
    topic = await _resolve_topic(db, vault, data.topic)

    db.add(
        StudySession(
            user_id=user.id,
            vault_id=data.vault_id,
            squad_id=vault.squad_id,
            session_type=data.session_type,
            ended_at=datetime.now(timezone.utc),
            focus_score=data.score_pct,
            metadata_={"topic": topic},
        )
    )
    await _touch_streak(db, user.id)
    await _update_topic_mastery(db, user.id, data.vault_id, topic, data.score_pct)
    await db.commit()


async def get_dashboard_insights(db: AsyncSession, user: CurrentUser) -> DashboardInsights:
    streak_row = (
        await db.execute(select(StudyStreak).where(StudyStreak.user_id == user.id))
    ).scalar_one_or_none()
    streak = StreakRead(
        current_streak=streak_row.current_streak if streak_row else 0,
        longest_streak=streak_row.longest_streak if streak_row else 0,
    )

    # ── Heatmap: calendar-aligned 16-week window ending this week (Mon-Sun) ──
    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=today.weekday()) - timedelta(weeks=HEATMAP_WEEKS - 1)
    window_end = window_start + timedelta(days=HEATMAP_WEEKS * 7 - 1)

    day_col = func.date(StudySession.started_at)
    counts_result = await db.execute(
        select(day_col.label("day"), func.count().label("n"))
        .where(
            StudySession.user_id == user.id,
            StudySession.started_at >= window_start,
        )
        .group_by(day_col)
    )
    counts_by_day: dict[date, int] = {row.day: row.n for row in counts_result}
    heatmap = [
        HeatmapDay(date=d, count=counts_by_day.get(d, 0))
        for d in (window_start + timedelta(days=i) for i in range((window_end - window_start).days + 1))
    ]

    # ── Topic mastery ──
    mastery_result = await db.execute(
        select(TopicMastery).where(TopicMastery.user_id == user.id).order_by(TopicMastery.mastery_score.desc())
    )
    mastery_rows = list(mastery_result.scalars().all())
    mastery_avg = (
        sum(float(m.mastery_score) for m in mastery_rows) / len(mastery_rows) if mastery_rows else None
    )
    strongest = (
        MasteryTopic(topic=mastery_rows[0].topic, mastery_score=float(mastery_rows[0].mastery_score), attempts=mastery_rows[0].quiz_attempts)
        if mastery_rows
        else None
    )
    weakest = (
        MasteryTopic(topic=mastery_rows[-1].topic, mastery_score=float(mastery_rows[-1].mastery_score), attempts=mastery_rows[-1].quiz_attempts)
        if len(mastery_rows) > 1
        else None
    )

    # ── Score trend: most recent attempts, chronological ──
    trend_result = await db.execute(
        select(StudySession)
        .where(StudySession.user_id == user.id, StudySession.focus_score.is_not(None))
        .order_by(StudySession.started_at.desc())
        .limit(SCORE_TREND_LIMIT)
    )
    trend_rows = list(reversed(trend_result.scalars().all()))
    score_trend = [
        ScoreTrendPoint(
            recorded_at=s.started_at,
            score_pct=float(s.focus_score),
            session_type=s.session_type,  # type: ignore[arg-type]
        )
        for s in trend_rows
    ]

    trend_change_pct = None
    if len(score_trend) >= 4:
        mid = len(score_trend) // 2
        first_half_avg = sum(p.score_pct for p in score_trend[:mid]) / mid
        second_half_avg = sum(p.score_pct for p in score_trend[mid:]) / (len(score_trend) - mid)
        if first_half_avg > 0:
            trend_change_pct = round(((second_half_avg - first_half_avg) / first_half_avg) * 100, 1)

    return DashboardInsights(
        has_data=streak_row is not None or bool(mastery_rows) or bool(score_trend),
        streak=streak,
        heatmap=heatmap,
        mastery_avg=round(mastery_avg, 1) if mastery_avg is not None else None,
        strongest_topic=strongest,
        weakest_topic=weakest,
        score_trend=score_trend,
        trend_change_pct=trend_change_pct,
    )


async def get_vault_insights(db: AsyncSession, user: CurrentUser, vault_id: UUID) -> VaultInsights:
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)

    mastery_rows = list(
        (
            await db.execute(
                select(TopicMastery).where(TopicMastery.user_id == user.id, TopicMastery.vault_id == vault_id)
            )
        ).scalars()
    )
    concepts_avg = (
        sum(float(m.mastery_score) for m in mastery_rows) / len(mastery_rows) if mastery_rows else None
    )
    weakest_topic = min(mastery_rows, key=lambda m: m.mastery_score).topic if mastery_rows else None

    async def _type_avg(session_type: str) -> float | None:
        result = await db.execute(
            select(func.avg(StudySession.focus_score)).where(
                StudySession.user_id == user.id,
                StudySession.vault_id == vault_id,
                StudySession.session_type == session_type,
            )
        )
        avg = result.scalar_one_or_none()
        return round(float(avg), 1) if avg is not None else None

    quiz_avg = await _type_avg("mcq")
    coding_avg = await _type_avg("coding")

    attempts_count = (
        await db.execute(
            select(func.count()).where(StudySession.user_id == user.id, StudySession.vault_id == vault_id)
        )
    ).scalar_one()

    total_cards = (
        await db.execute(select(func.count()).where(Flashcard.vault_id == vault_id, Flashcard.deleted_at.is_(None)))
    ).scalar_one()
    reviewed_cards = (
        await db.execute(
            select(func.count())
            .select_from(Flashcard)
            .join(
                SpacedRepetitionState,
                (SpacedRepetitionState.flashcard_id == Flashcard.id)
                & (SpacedRepetitionState.user_id == user.id),
            )
            .where(Flashcard.vault_id == vault_id, Flashcard.deleted_at.is_(None), SpacedRepetitionState.repetitions > 0)
        )
    ).scalar_one()
    flashcard_coverage_pct = round((reviewed_cards / total_cards) * 100, 1) if total_cards else None

    return VaultInsights(
        has_data=bool(mastery_rows) or attempts_count > 0,
        concepts_avg=round(concepts_avg, 1) if concepts_avg is not None else None,
        quiz_avg=quiz_avg,
        coding_avg=coding_avg,
        flashcard_coverage_pct=flashcard_coverage_pct,
        attempts_count=attempts_count,
        weakest_topic=weakest_topic,
    )
