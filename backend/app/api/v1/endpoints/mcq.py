"""MCQ endpoints — generate, list, get, delete."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.mcq_schema import (
    MCQGenerateRequest,
    MCQGenerateResponse,
    MCQSetListItem,
    MCQSetDetail,
)
from app.services import mcq_service

router = APIRouter()


@router.post("/vaults/{vault_id}/mcq/generate", response_model=MCQGenerateResponse)
async def generate_mcq(
    vault_id: UUID,
    data: MCQGenerateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MCQGenerateResponse:
    """Generate MCQs from vault context and a topics/syllabus description."""
    return await mcq_service.generate_mcq(db, current_user, vault_id, data)


@router.get("/vaults/{vault_id}/mcq/sets", response_model=list[MCQSetListItem])
async def list_mcq_sets(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MCQSetListItem]:
    """List all saved MCQ sets for a vault."""
    return await mcq_service.list_mcq_sets(db, current_user, vault_id)


@router.get("/vaults/{vault_id}/mcq/sets/{set_id}", response_model=MCQSetDetail)
async def get_mcq_set(
    vault_id: UUID,
    set_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MCQSetDetail:
    """Load a saved MCQ set with all questions."""
    return await mcq_service.get_mcq_set(db, current_user, vault_id, set_id)


@router.delete("/vaults/{vault_id}/mcq/sets/{set_id}", status_code=204)
async def delete_mcq_set(
    vault_id: UUID,
    set_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft-delete a saved MCQ set (creator only)."""
    await mcq_service.delete_mcq_set(db, current_user, vault_id, set_id)
