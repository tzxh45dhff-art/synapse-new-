"""Coding questions generation endpoint — POST /vaults/{vault_id}/coding/generate."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.coding_schema import (
    CodingGenerateRequest,
    CodingGenerateResponse,
    CodingGradeRequest,
    CodingGradeResponse,
)
from app.services import coding_service

router = APIRouter()


@router.post("/vaults/{vault_id}/coding/generate", response_model=CodingGenerateResponse)
async def generate_coding_questions(
    vault_id: UUID,
    data: CodingGenerateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CodingGenerateResponse:
    """Generate coding questions from vault context and a topics/syllabus description."""
    return await coding_service.generate_coding_questions(db, current_user, vault_id, data)


@router.post("/vaults/{vault_id}/coding/grade", response_model=CodingGradeResponse)
async def grade_coding_question(
    vault_id: UUID,
    data: CodingGradeRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CodingGradeResponse:
    """Grade a user's code submission using the AI simulator judge."""
    return await coding_service.grade_coding_question(db, current_user, vault_id, data)

