"""MCQ generation endpoint — POST /vaults/{vault_id}/mcq/generate."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.mcq_schema import MCQGenerateRequest, MCQGenerateResponse
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
