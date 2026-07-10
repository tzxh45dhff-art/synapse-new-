"""Practice-attempt tracking, dashboard insights, and flashcard endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUserDep
from app.db.session import get_db
from app.schemas.intelligence_schema import (
    DashboardInsights,
    FlashcardGenerateRequest,
    FlashcardRead,
    FlashcardReviewRequest,
    PracticeAttemptCreate,
    VaultInsights,
)
from app.services import flashcard_service, intelligence_service

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.post("/practice/attempts", status_code=204)
async def record_practice_attempt(
    data: PracticeAttemptCreate,
    db: DbDep,
    user: CurrentUserDep,
) -> None:
    await intelligence_service.record_practice_attempt(db, user, data)


@router.get("/dashboard/insights", response_model=DashboardInsights)
async def get_dashboard_insights(db: DbDep, user: CurrentUserDep) -> DashboardInsights:
    return await intelligence_service.get_dashboard_insights(db, user)


@router.get("/vaults/{vault_id}/insights", response_model=VaultInsights)
async def get_vault_insights(vault_id: UUID, db: DbDep, user: CurrentUserDep) -> VaultInsights:
    return await intelligence_service.get_vault_insights(db, user, vault_id)


@router.post(
    "/vaults/{vault_id}/flashcards/generate",
    response_model=list[FlashcardRead],
    status_code=201,
)
async def generate_flashcards(
    vault_id: UUID,
    data: FlashcardGenerateRequest,
    db: DbDep,
    user: CurrentUserDep,
) -> list[FlashcardRead]:
    return await flashcard_service.generate_flashcards(db, user, vault_id, data)


@router.get("/flashcards/due", response_model=list[FlashcardRead])
async def get_due_flashcards(
    db: DbDep,
    user: CurrentUserDep,
    limit: int = Query(5, ge=1, le=20),
) -> list[FlashcardRead]:
    return await flashcard_service.get_due_flashcards(db, user, limit=limit)


@router.post("/flashcards/{flashcard_id}/review", status_code=204)
async def review_flashcard(
    flashcard_id: UUID,
    data: FlashcardReviewRequest,
    db: DbDep,
    user: CurrentUserDep,
) -> None:
    await flashcard_service.review_flashcard(db, user, flashcard_id, data.rating)
