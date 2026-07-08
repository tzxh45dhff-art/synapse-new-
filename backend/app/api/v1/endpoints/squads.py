"""Squad API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUserDep, get_current_user, require_squad_role
from app.db.session import get_db
from app.models.squad import SquadMember
from app.schemas.auth import CurrentUser
from app.schemas.squad_schema import (
    ChangeRoleRequest,
    JoinSquadRequest,
    SquadCreate,
    SquadListItem,
    SquadMemberRead,
    SquadRead,
    SquadUpdate,
    TransferOwnershipRequest,
)
from app.services import squad_service

router = APIRouter()

# Type aliases for dependency injection
DbDep = Annotated[AsyncSession, Depends(get_db)]
MemberDep = Annotated[SquadMember, Depends(require_squad_role("member"))]
AdminDep = Annotated[SquadMember, Depends(require_squad_role("admin"))]
OwnerDep = Annotated[SquadMember, Depends(require_squad_role("owner"))]


# ─────────────────────────────────────────────────────────────────────────────
# Squad CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=SquadRead, status_code=201)
async def create_squad(
    data: SquadCreate,
    user: CurrentUserDep,
    db: DbDep,
):
    """Create a new squad. The creator becomes the owner."""
    return await squad_service.create_squad(db, data, user)


@router.get("", response_model=list[SquadListItem])
async def list_squads(
    user: CurrentUserDep,
    db: DbDep,
    search: str | None = Query(None, max_length=100),
    sort_by: str = Query("recent", regex="^(recent|alphabetical|members)$"),
):
    """List all squads the current user belongs to."""
    return await squad_service.list_user_squads(db, user, search=search, sort_by=sort_by)


@router.get("/{squad_id}", response_model=SquadRead)
async def get_squad(
    squad_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    _member: MemberDep = None,
):
    """Get squad details. Requires membership."""
    return await squad_service.get_squad_detail(db, squad_id, user)


@router.patch("/{squad_id}", response_model=SquadRead)
async def update_squad(
    squad_id: UUID,
    data: SquadUpdate,
    user: CurrentUserDep,
    db: DbDep,
    member: AdminDep,
):
    """Update squad settings. Requires admin or owner role."""
    return await squad_service.update_squad(db, squad_id, data, user, member)


@router.delete("/{squad_id}", status_code=204)
async def delete_squad(
    squad_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    _owner: OwnerDep = None,
):
    """Soft-delete a squad. Owner only."""
    await squad_service.delete_squad(db, squad_id, user)


# ─────────────────────────────────────────────────────────────────────────────
# Join / Leave
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/join", response_model=SquadRead)
async def join_squad(
    data: JoinSquadRequest,
    user: CurrentUserDep,
    db: DbDep,
):
    """Join a squad using an invite code."""
    return await squad_service.join_by_invite_code(db, data.invite_code, user)


@router.post("/{squad_id}/leave", status_code=204)
async def leave_squad(
    squad_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
):
    """Leave a squad. Owners must transfer ownership first if they are the sole owner."""
    await squad_service.leave_squad(db, squad_id, user)


# ─────────────────────────────────────────────────────────────────────────────
# Members
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{squad_id}/members", response_model=list[SquadMemberRead])
async def list_members(
    squad_id: UUID,
    db: DbDep,
    _member: MemberDep = None,
):
    """List active squad members. Requires membership."""
    return await squad_service.get_members(db, squad_id)


@router.patch("/{squad_id}/members/{user_id}", response_model=SquadMemberRead)
async def change_role(
    squad_id: UUID,
    user_id: UUID,
    data: ChangeRoleRequest,
    user: CurrentUserDep,
    db: DbDep,
    member: AdminDep,
):
    """Change a member's role. Requires admin or owner."""
    return await squad_service.change_member_role(db, squad_id, user_id, data, user, member)


@router.delete("/{squad_id}/members/{user_id}", status_code=204)
async def remove_member(
    squad_id: UUID,
    user_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    member: AdminDep,
):
    """Remove a member from the squad. Requires admin or owner."""
    await squad_service.remove_member(db, squad_id, user_id, user, member)


# ─────────────────────────────────────────────────────────────────────────────
# Ownership transfer
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{squad_id}/transfer-ownership", status_code=204)
async def transfer_ownership(
    squad_id: UUID,
    data: TransferOwnershipRequest,
    user: CurrentUserDep,
    db: DbDep,
    member: OwnerDep,
):
    """Transfer squad ownership to another member. Owner only."""
    await squad_service.transfer_ownership(db, squad_id, data, user, member)


# ─────────────────────────────────────────────────────────────────────────────
# Invite code
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{squad_id}/regenerate-invite-code")
async def regenerate_invite_code(
    squad_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    _admin: AdminDep = None,
):
    """Regenerate the squad invite code. Requires admin or owner."""
    new_code = await squad_service.regenerate_invite_code(db, squad_id, user)
    return {"invite_code": new_code}
