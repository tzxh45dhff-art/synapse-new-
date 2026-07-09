"""Squad business logic — create, list, update, delete, join, leave, members, roles."""

import secrets
import string
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select, update, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.profile import Profile
from app.models.squad import Invitation, Squad, SquadMember
from app.models.system import ActivityLog
from app.schemas.auth import CurrentUser
from app.schemas.squad_schema import (
    ChangeRoleRequest,
    SquadCreate,
    SquadListItem,
    SquadMemberRead,
    SquadRead,
    SquadUpdate,
    MemberProfile,
    TransferOwnershipRequest,
)

logger = structlog.get_logger()

ROLE_HIERARCHY = {"owner": 4, "admin": 3, "member": 2, "viewer": 1}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_invite_code(length: int = 8) -> str:
    """Generate a short, human-readable invite code (uppercase alphanumeric)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _get_active_squad(db: AsyncSession, squad_id: UUID) -> Squad:
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id, Squad.deleted_at.is_(None))
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise NotFoundError("Squad")
    return squad


async def _get_membership(db: AsyncSession, squad_id: UUID, user_id: UUID) -> SquadMember | None:
    result = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == squad_id,
            SquadMember.user_id == user_id,
            SquadMember.removed_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _log_activity(
    db: AsyncSession,
    user_id: UUID,
    squad_id: UUID,
    action: str,
    entity_type: str = "squad",
    entity_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    log = ActivityLog(
        user_id=user_id,
        squad_id=squad_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id or squad_id,
        metadata_=metadata or {},
    )
    db.add(log)


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

async def create_squad(
    db: AsyncSession,
    data: SquadCreate,
    user: CurrentUser,
    is_personal: bool = False,
) -> SquadRead:
    # Generate unique invite code with retry
    invite_code = _generate_invite_code()
    for _ in range(5):
        exists = await db.execute(select(Squad.id).where(Squad.invite_code == invite_code))
        if not exists.scalar_one_or_none():
            break
        invite_code = _generate_invite_code()

    squad = Squad(
        name=data.name,
        description=data.description,
        avatar_url=data.avatar_url,
        invite_code=invite_code,
        is_personal=is_personal,
        created_by=user.id,
    )
    db.add(squad)
    await db.flush()

    # Add creator as owner
    membership = SquadMember(
        squad_id=squad.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)
    await db.flush()

    await _log_activity(db, user.id, squad.id, "squad.created")

    logger.info("squad.created", squad_id=str(squad.id), user_id=str(user.id))

    return SquadRead(
        id=squad.id,
        name=squad.name,
        description=squad.description,
        avatar_url=squad.avatar_url,
        invite_code=squad.invite_code,
        is_personal=squad.is_personal,
        max_members=squad.max_members,
        member_count=1,
        created_by=squad.created_by,
        created_at=squad.created_at,
        updated_at=squad.updated_at,
        current_user_role="owner",
    )


async def create_personal_squad(db: AsyncSession, user: CurrentUser, name: str = "Personal") -> SquadRead:
    """Create the personal workspace squad during onboarding."""
    # Check if user already has a personal squad
    result = await db.execute(
        select(Squad).join(SquadMember).where(
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
            Squad.is_personal.is_(True),
            Squad.deleted_at.is_(None),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return SquadRead(
            id=existing.id,
            name=existing.name,
            description=existing.description,
            avatar_url=existing.avatar_url,
            invite_code=existing.invite_code,
            is_personal=existing.is_personal,
            max_members=existing.max_members,
            member_count=existing.member_count,
            created_by=existing.created_by,
            created_at=existing.created_at,
            updated_at=existing.updated_at,
            current_user_role="owner",
        )

    data = SquadCreate(name=name, description="Your personal workspace")
    return await create_squad(db, data, user, is_personal=True)


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

async def list_user_squads(
    db: AsyncSession,
    user: CurrentUser,
    search: str | None = None,
    sort_by: str = "recent",
) -> list[SquadListItem]:
    query = (
        select(Squad, SquadMember.role)
        .join(SquadMember, and_(
            SquadMember.squad_id == Squad.id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        ))
        .where(Squad.deleted_at.is_(None))
    )

    if search:
        query = query.where(Squad.name.ilike(f"%{search}%"))

    if sort_by == "alphabetical":
        query = query.order_by(Squad.name.asc())
    elif sort_by == "members":
        query = query.order_by(Squad.member_count.desc())
    else:  # recent
        query = query.order_by(Squad.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    return [
        SquadListItem(
            id=squad.id,
            name=squad.name,
            description=squad.description,
            avatar_url=squad.avatar_url,
            is_personal=squad.is_personal,
            member_count=squad.member_count,
            current_user_role=role,
            created_at=squad.created_at,
        )
        for squad, role in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Detail
# ─────────────────────────────────────────────────────────────────────────────

async def get_squad_detail(
    db: AsyncSession,
    squad_id: UUID,
    user: CurrentUser,
) -> SquadRead:
    squad = await _get_active_squad(db, squad_id)
    membership = await _get_membership(db, squad_id, user.id)

    if not membership:
        raise ForbiddenError("You are not a member of this squad.")

    return SquadRead(
        id=squad.id,
        name=squad.name,
        description=squad.description,
        avatar_url=squad.avatar_url,
        invite_code=squad.invite_code,
        is_personal=squad.is_personal,
        max_members=squad.max_members,
        member_count=squad.member_count,
        created_by=squad.created_by,
        created_at=squad.created_at,
        updated_at=squad.updated_at,
        current_user_role=membership.role,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────────────────────────

async def update_squad(
    db: AsyncSession,
    squad_id: UUID,
    data: SquadUpdate,
    user: CurrentUser,
    member: SquadMember,
) -> SquadRead:
    squad = await _get_active_squad(db, squad_id)

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise ValidationError("No fields to update.")

    for field, value in update_data.items():
        setattr(squad, field, value)

    await db.flush()
    await _log_activity(db, user.id, squad_id, "squad.updated", metadata={"fields": list(update_data.keys())})

    return SquadRead(
        id=squad.id,
        name=squad.name,
        description=squad.description,
        avatar_url=squad.avatar_url,
        invite_code=squad.invite_code,
        is_personal=squad.is_personal,
        max_members=squad.max_members,
        member_count=squad.member_count,
        created_by=squad.created_by,
        created_at=squad.created_at,
        updated_at=squad.updated_at,
        current_user_role=member.role,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Delete (soft)
# ─────────────────────────────────────────────────────────────────────────────

async def delete_squad(
    db: AsyncSession,
    squad_id: UUID,
    user: CurrentUser,
) -> None:
    squad = await _get_active_squad(db, squad_id)

    if squad.is_personal:
        raise ForbiddenError("Cannot delete your personal workspace.")

    squad.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_activity(db, user.id, squad_id, "squad.deleted")
    logger.info("squad.deleted", squad_id=str(squad_id), user_id=str(user.id))


# ─────────────────────────────────────────────────────────────────────────────
# Join
# ─────────────────────────────────────────────────────────────────────────────

async def join_by_invite_code(
    db: AsyncSession,
    invite_code: str,
    user: CurrentUser,
) -> SquadRead:
    # Find squad by code
    result = await db.execute(
        select(Squad).where(Squad.invite_code == invite_code, Squad.deleted_at.is_(None))
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise NotFoundError("Invalid invite code.")

    # Check not already a member
    existing = await _get_membership(db, squad.id, user.id)
    if existing:
        raise ConflictError("You are already a member of this squad.")

    # Check capacity
    if squad.member_count >= squad.max_members:
        raise ValidationError("This squad has reached its member limit.")

    # Add as member
    membership = SquadMember(
        squad_id=squad.id,
        user_id=user.id,
        role="member",
    )
    db.add(membership)
    await db.flush()

    await _log_activity(db, user.id, squad.id, "member.joined")
    logger.info("member.joined", squad_id=str(squad.id), user_id=str(user.id))

    return SquadRead(
        id=squad.id,
        name=squad.name,
        description=squad.description,
        avatar_url=squad.avatar_url,
        invite_code=squad.invite_code,
        is_personal=squad.is_personal,
        max_members=squad.max_members,
        member_count=squad.member_count + 1,  # trigger hasn't fired yet in same tx
        created_by=squad.created_by,
        created_at=squad.created_at,
        updated_at=squad.updated_at,
        current_user_role="member",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Leave
# ─────────────────────────────────────────────────────────────────────────────

async def leave_squad(
    db: AsyncSession,
    squad_id: UUID,
    user: CurrentUser,
) -> None:
    squad = await _get_active_squad(db, squad_id)
    membership = await _get_membership(db, squad_id, user.id)

    if not membership:
        raise NotFoundError("You are not a member of this squad.")

    if squad.is_personal:
        raise ForbiddenError("Cannot leave your personal workspace.")

    # Owner cannot leave if sole owner
    if membership.role == "owner":
        owner_count = await db.execute(
            select(func.count()).select_from(SquadMember).where(
                SquadMember.squad_id == squad_id,
                SquadMember.role == "owner",
                SquadMember.removed_at.is_(None),
            )
        )
        if owner_count.scalar_one() <= 1:
            raise ForbiddenError(
                "You are the only owner. Transfer ownership before leaving."
            )

    membership.removed_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_activity(db, user.id, squad_id, "member.left")
    logger.info("member.left", squad_id=str(squad_id), user_id=str(user.id))


# ─────────────────────────────────────────────────────────────────────────────
# Members
# ─────────────────────────────────────────────────────────────────────────────

async def get_members(
    db: AsyncSession,
    squad_id: UUID,
) -> list[SquadMemberRead]:
    result = await db.execute(
        select(SquadMember)
        .options(joinedload(SquadMember.profile))
        .where(
            SquadMember.squad_id == squad_id,
            SquadMember.removed_at.is_(None),
        )
        .order_by(
            # Owner first, then admin, then member, then viewer
            func.array_position(
                func.cast(["owner", "admin", "member", "viewer"], ARRAY(String)),
                SquadMember.role,
            ),
            SquadMember.joined_at.asc(),
        )
    )
    members = result.unique().scalars().all()

    return [
        SquadMemberRead(
            id=m.id,
            squad_id=m.squad_id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            profile=MemberProfile(
                id=m.profile.id,
                email=m.profile.email,
                display_name=m.profile.display_name,
                full_name=m.profile.full_name,
                avatar_url=m.profile.avatar_url,
            ) if m.profile else None,
        )
        for m in members
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Role changes
# ─────────────────────────────────────────────────────────────────────────────

async def change_member_role(
    db: AsyncSession,
    squad_id: UUID,
    target_user_id: UUID,
    data: ChangeRoleRequest,
    actor: CurrentUser,
    actor_member: SquadMember,
) -> SquadMemberRead:
    target_member = await _get_membership(db, squad_id, target_user_id)
    if not target_member:
        raise NotFoundError("Member")

    if target_user_id == actor.id:
        raise ForbiddenError("Cannot change your own role.")

    actor_level = ROLE_HIERARCHY.get(actor_member.role, 0)
    target_level = ROLE_HIERARCHY.get(target_member.role, 0)
    new_level = ROLE_HIERARCHY.get(data.role, 0)

    # Cannot change role of someone at same or higher level
    if target_level >= actor_level:
        raise ForbiddenError("Cannot change role of a member with equal or higher rank.")

    # Cannot promote above own level
    if new_level >= actor_level:
        raise ForbiddenError("Cannot promote a member to your rank or higher.")

    old_role = target_member.role
    target_member.role = data.role
    await db.flush()

    await _log_activity(
        db, actor.id, squad_id, "member.role_changed",
        entity_type="squad_member", entity_id=target_member.id,
        metadata={"target_user_id": str(target_user_id), "old_role": old_role, "new_role": data.role},
    )

    # Re-fetch with profile
    return (await get_members(db, squad_id)).__iter__().__next__()


# ─────────────────────────────────────────────────────────────────────────────
# Remove member
# ─────────────────────────────────────────────────────────────────────────────

async def remove_member(
    db: AsyncSession,
    squad_id: UUID,
    target_user_id: UUID,
    actor: CurrentUser,
    actor_member: SquadMember,
) -> None:
    if target_user_id == actor.id:
        raise ForbiddenError("Use the leave endpoint to leave a squad.")

    target_member = await _get_membership(db, squad_id, target_user_id)
    if not target_member:
        raise NotFoundError("Member")

    actor_level = ROLE_HIERARCHY.get(actor_member.role, 0)
    target_level = ROLE_HIERARCHY.get(target_member.role, 0)

    if target_level >= actor_level:
        raise ForbiddenError("Cannot remove a member with equal or higher rank.")

    target_member.removed_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_activity(
        db, actor.id, squad_id, "member.removed",
        entity_type="squad_member", entity_id=target_member.id,
        metadata={"target_user_id": str(target_user_id), "role": target_member.role},
    )
    logger.info("member.removed", squad_id=str(squad_id), target=str(target_user_id), actor=str(actor.id))


# ─────────────────────────────────────────────────────────────────────────────
# Transfer ownership
# ─────────────────────────────────────────────────────────────────────────────

async def transfer_ownership(
    db: AsyncSession,
    squad_id: UUID,
    data: TransferOwnershipRequest,
    actor: CurrentUser,
    actor_member: SquadMember,
) -> None:
    if actor_member.role != "owner":
        raise ForbiddenError("Only the owner can transfer ownership.")

    if data.new_owner_id == actor.id:
        raise ValidationError("Cannot transfer ownership to yourself.")

    target_member = await _get_membership(db, squad_id, data.new_owner_id)
    if not target_member:
        raise NotFoundError("Target user is not a member of this squad.")

    # Promote target to owner
    target_member.role = "owner"
    # Demote actor to admin
    actor_member.role = "admin"
    await db.flush()

    await _log_activity(
        db, actor.id, squad_id, "ownership.transferred",
        metadata={"new_owner_id": str(data.new_owner_id)},
    )
    logger.info("ownership.transferred", squad_id=str(squad_id), new_owner=str(data.new_owner_id))


# ─────────────────────────────────────────────────────────────────────────────
# Regenerate invite code
# ─────────────────────────────────────────────────────────────────────────────

async def regenerate_invite_code(
    db: AsyncSession,
    squad_id: UUID,
    user: CurrentUser,
) -> str:
    squad = await _get_active_squad(db, squad_id)

    new_code = _generate_invite_code()
    for _ in range(5):
        exists = await db.execute(select(Squad.id).where(Squad.invite_code == new_code))
        if not exists.scalar_one_or_none():
            break
        new_code = _generate_invite_code()

    squad.invite_code = new_code
    await db.flush()

    await _log_activity(db, user.id, squad_id, "squad.invite_code_regenerated")
    return new_code
