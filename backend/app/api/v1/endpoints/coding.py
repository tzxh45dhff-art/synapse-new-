"""Coding questions endpoints — generate, grade, list, get, delete."""

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
    CodingRuntimeInfo,
    CodingSetListItem,
    CodingSetDetail,
)
from app.services import coding_service

router = APIRouter()


@router.get("/coding/runtimes", response_model=list[CodingRuntimeInfo])
async def list_coding_runtimes(current_user: CurrentUserDep) -> list[CodingRuntimeInfo]:
    """Which languages this server can execute for real (vs. AI-reviewed)."""
    return coding_service.list_runtimes()


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
    """Grade a submission by executing it against the question's verified tests.

    Falls back to AI review only when the server has no runtime for the language
    or the question predates executable test cases; the response says which.
    """
    return await coding_service.grade_coding_question(db, current_user, vault_id, data)


@router.get("/vaults/{vault_id}/coding/sets", response_model=list[CodingSetListItem])
async def list_coding_sets(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CodingSetListItem]:
    """List all saved coding question sets for a vault."""
    return await coding_service.list_coding_sets(db, current_user, vault_id)


@router.get("/vaults/{vault_id}/coding/sets/{set_id}", response_model=CodingSetDetail)
async def get_coding_set(
    vault_id: UUID,
    set_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CodingSetDetail:
    """Load a saved coding question set with all questions."""
    return await coding_service.get_coding_set(db, current_user, vault_id, set_id)


@router.delete("/vaults/{vault_id}/coding/sets/{set_id}", status_code=204)
async def delete_coding_set(
    vault_id: UUID,
    set_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft-delete a saved coding question set (creator only)."""
    await coding_service.delete_coding_set(db, current_user, vault_id, set_id)
