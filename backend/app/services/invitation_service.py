"""Invitation business logic — create, accept, decline, revoke, token lookup."""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.profile import Profile
from app.models.squad import Invitation, Squad, SquadMember
from app.models.system import ActivityLog
from app.schemas.auth import CurrentUser
from app.schemas.invitation_schema import InvitationPublicRead, InvitationRead

logger = structlog.get_logger()

INVITATION_EXPIRY_DAYS = 7


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_token() -> str:
    return secrets.token_urlsafe(48)


async def _log_activity(
    db: AsyncSession, user_id: UUID, squad_id: UUID, action: str,
    entity_type: str = "invitation", entity_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    log = ActivityLog(
        user_id=user_id, squad_id=squad_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        metadata_=metadata or {},
    )
    db.add(log)


# ─────────────────────────────────────────────────────────────────────────────
# Create invitation (generates a shareable link token)
# ─────────────────────────────────────────────────────────────────────────────

async def create_invitation(
    db: AsyncSession,
    squad_id: UUID,
    role: str,
    actor: CurrentUser,
) -> InvitationRead:
    # Verify squad exists
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id, Squad.deleted_at.is_(None))
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise NotFoundError("Squad")

    # Check capacity
    if squad.member_count >= squad.max_members:
        raise ValidationError("This squad has reached its member limit.")

    token = _generate_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRY_DAYS)

    invitation = Invitation(
        squad_id=squad_id,
        invited_by=actor.id,
        token=token,
        role=role,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.flush()

    # Get inviter profile for response
    inviter_result = await db.execute(select(Profile).where(Profile.id == actor.id))
    inviter = inviter_result.scalar_one_or_none()

    await _log_activity(
        db, actor.id, squad_id, "invitation.created",
        entity_id=invitation.id,
        metadata={"role": role},
    )

    return InvitationRead(
        id=invitation.id,
        squad_id=squad_id,
        squad_name=squad.name,
        invited_by=actor.id,
        inviter_name=inviter.display_name or inviter.full_name if inviter else None,
        invited_email=None,
        invited_user_id=None,
        token=token,
        role=role,
        status="pending",
        expires_at=expires_at,
        responded_at=None,
        accepted_by=None,
        accepted_at=None,
        created_at=invitation.created_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Get invitation by token (public)
# ─────────────────────────────────────────────────────────────────────────────

async def get_invitation_by_token(
    db: AsyncSession,
    token: str,
) -> InvitationPublicRead:
    result = await db.execute(
        select(Invitation)
        .options(joinedload(Invitation.squad))
        .where(Invitation.token == token)
    )
    invitation = result.unique().scalar_one_or_none()
    if not invitation:
        raise NotFoundError("Invitation")

    now = datetime.now(timezone.utc)
    is_expired = invitation.expires_at < now or invitation.status == "expired"

    # Auto-expire if needed
    if invitation.status == "pending" and invitation.expires_at < now:
        invitation.status = "expired"
        await db.flush()

    # Get inviter name
    inviter_result = await db.execute(select(Profile).where(Profile.id == invitation.invited_by))
    inviter = inviter_result.scalar_one_or_none()

    return InvitationPublicRead(
        squad_name=invitation.squad.name if invitation.squad else "Unknown Squad",
        squad_avatar_url=invitation.squad.avatar_url if invitation.squad else None,
        squad_member_count=invitation.squad.member_count if invitation.squad else 0,
        role=invitation.role,
        status=invitation.status,
        expires_at=invitation.expires_at,
        inviter_name=inviter.display_name or inviter.full_name if inviter else None,
        is_expired=is_expired,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Accept invitation
# ─────────────────────────────────────────────────────────────────────────────

async def accept_invitation(
    db: AsyncSession,
    token: str,
    user: CurrentUser,
) -> dict:
    result = await db.execute(
        select(Invitation)
        .options(joinedload(Invitation.squad))
        .where(Invitation.token == token)
    )
    invitation = result.unique().scalar_one_or_none()
    if not invitation:
        raise NotFoundError("Invitation")

    now = datetime.now(timezone.utc)

    # Validate status
    if invitation.status != "pending":
        raise ValidationError(f"This invitation has already been {invitation.status}.")

    if invitation.expires_at < now:
        invitation.status = "expired"
        await db.flush()
        raise ValidationError("This invitation has expired.")

    squad = invitation.squad
    if not squad or squad.deleted_at is not None:
        raise NotFoundError("The squad no longer exists.")

    # Check not already a member
    existing = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == invitation.squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("You are already a member of this squad.")

    # Check capacity
    if squad.member_count >= squad.max_members:
        raise ValidationError("This squad has reached its member limit.")

    # Accept
    invitation.status = "accepted"
    invitation.responded_at = now
    invitation.accepted_by = user.id
    invitation.accepted_at = now

    # Create membership
    membership = SquadMember(
        squad_id=invitation.squad_id,
        user_id=user.id,
        role=invitation.role,
    )
    db.add(membership)
    await db.flush()

    await _log_activity(
        db, user.id, invitation.squad_id, "member.joined_via_invitation",
        entity_id=invitation.id,
        metadata={"role": invitation.role, "invitation_token": token[:8] + "..."},
    )

    logger.info("invitation.accepted", squad_id=str(invitation.squad_id), user_id=str(user.id))

    return {"squad_id": str(invitation.squad_id), "role": invitation.role}


# ─────────────────────────────────────────────────────────────────────────────
# Decline invitation
# ─────────────────────────────────────────────────────────────────────────────

async def decline_invitation(
    db: AsyncSession,
    token: str,
    user: CurrentUser,
) -> None:
    result = await db.execute(
        select(Invitation).where(Invitation.token == token)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise NotFoundError("Invitation")

    if invitation.status != "pending":
        raise ValidationError(f"This invitation has already been {invitation.status}.")

    invitation.status = "declined"
    invitation.responded_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_activity(
        db, user.id, invitation.squad_id, "invitation.declined",
        entity_id=invitation.id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Revoke invitation (admin/owner)
# ─────────────────────────────────────────────────────────────────────────────

async def revoke_invitation(
    db: AsyncSession,
    token: str,
    actor: CurrentUser,
) -> None:
    result = await db.execute(
        select(Invitation).where(Invitation.token == token)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise NotFoundError("Invitation")

    if invitation.status != "pending":
        raise ValidationError(f"This invitation has already been {invitation.status}.")

    # Verify actor is admin/owner of the squad
    member_result = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == invitation.squad_id,
            SquadMember.user_id == actor.id,
            SquadMember.removed_at.is_(None),
            SquadMember.role.in_(["owner", "admin"]),
        )
    )
    if not member_result.scalar_one_or_none():
        raise ForbiddenError("Only squad admins can revoke invitations.")

    invitation.status = "revoked"
    invitation.responded_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_activity(
        db, actor.id, invitation.squad_id, "invitation.revoked",
        entity_id=invitation.id,
    )
