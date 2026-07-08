"""Invitation API endpoints — token-based operations."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUserDep, require_squad_role
from app.db.session import get_db
from app.models.squad import SquadMember
from app.schemas.invitation_schema import InvitationCreate, InvitationPublicRead, InvitationRead
from app.services import invitation_service

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[SquadMember, Depends(require_squad_role("admin"))]


# ─────────────────────────────────────────────────────────────────────────────
# Create invitation (on squad endpoint, but grouped here for clarity)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/squads/{squad_id}/invite", response_model=InvitationRead, status_code=201)
async def create_invitation(
    squad_id: UUID,
    data: InvitationCreate,
    user: CurrentUserDep,
    db: DbDep,
    _admin: AdminDep = None,
):
    """Create a shareable invitation link. Requires admin or owner."""
    return await invitation_service.create_invitation(db, squad_id, data.role, user)


# ─────────────────────────────────────────────────────────────────────────────
# Token-based operations
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/invitations/{token}", response_model=InvitationPublicRead)
async def get_invitation(
    token: str,
    db: DbDep,
):
    """View invitation details by token. No auth required for viewing."""
    return await invitation_service.get_invitation_by_token(db, token)


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    user: CurrentUserDep,
    db: DbDep,
):
    """Accept an invitation. Auth required."""
    result = await invitation_service.accept_invitation(db, token, user)
    return result


@router.post("/invitations/{token}/decline", status_code=204)
async def decline_invitation(
    token: str,
    user: CurrentUserDep,
    db: DbDep,
):
    """Decline an invitation."""
    await invitation_service.decline_invitation(db, token, user)


@router.post("/invitations/{token}/revoke", status_code=204)
async def revoke_invitation(
    token: str,
    user: CurrentUserDep,
    db: DbDep,
):
    """Revoke a pending invitation. Requires admin/owner of the squad."""
    await invitation_service.revoke_invitation(db, token, user)
