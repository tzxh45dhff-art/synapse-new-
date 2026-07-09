"""Vault business logic — create, list, update, archive, restore, delete."""

from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.system import ActivityLog
from app.models.vault import Subject, Vault, VaultStatistics
from app.schemas.auth import CurrentUser
from app.schemas.vault_schema import VaultCreate, VaultRead, VaultListItem, VaultUpdate

logger = structlog.get_logger()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_active_vault(db: AsyncSession, vault_id: UUID) -> Vault:
    result = await db.execute(
        select(Vault)
        .where(Vault.id == vault_id, Vault.deleted_at.is_(None))
        .options(
            joinedload(Vault.statistics),
            joinedload(Vault.subject),  # type: ignore[attr-defined]
        )
    )
    vault = result.scalar_one_or_none()
    if not vault:
        raise NotFoundError("Vault")
    return vault


async def _assert_squad_member(db: AsyncSession, vault: Vault, user_id: UUID) -> None:
    from app.models.squad import SquadMember
    result = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user_id,
            SquadMember.removed_at.is_(None),
        )
    )
    if not result.scalar_one_or_none():
        raise ForbiddenError("You are not a member of this squad.")


async def _assert_can_manage(db: AsyncSession, vault: Vault, user: CurrentUser) -> None:
    """Owner or admin of squad, or vault creator."""
    from app.models.squad import SquadMember
    result = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise ForbiddenError("You are not a member of this squad.")
    if member.role not in ("owner", "admin") and vault.created_by != user.id:
        raise ForbiddenError("Only squad admins or the vault creator can perform this action.")


async def _log(db: AsyncSession, user_id: UUID, action: str, squad_id: UUID, **meta: object) -> None:
    db.add(ActivityLog(
        user_id=user_id,
        squad_id=squad_id,
        action=action,
        entity_type="vault",
        metadata_=meta,
    ))


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def list_subjects(db: AsyncSession) -> list[Subject]:
    result = await db.execute(select(Subject).order_by(Subject.name))
    return list(result.scalars().all())


async def create_vault(
    db: AsyncSession,
    user: CurrentUser,
    squad_id: UUID,
    data: VaultCreate,
) -> Vault:
    # Verify squad membership
    from app.models.squad import SquadMember
    result = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise ForbiddenError("You are not a member of this squad.")
    if member.role == "viewer":
        raise ForbiddenError("Viewers cannot create vaults.")

    # Uniqueness: title within squad (case-insensitive)
    dup = await db.execute(
        select(Vault).where(
            Vault.squad_id == squad_id,
            func.lower(Vault.title) == data.title.lower().strip(),
            Vault.deleted_at.is_(None),
        )
    )
    if dup.scalar_one_or_none():
        raise ConflictError(f"A vault named '{data.title}' already exists in this squad.")

    # Verify subject exists
    subj = await db.execute(select(Subject).where(Subject.id == data.subject_id))
    if not subj.scalar_one_or_none():
        raise ValidationError("Invalid subject_id.")

    vault = Vault(
        squad_id=squad_id,
        created_by=user.id,
        title=data.title.strip(),
        subject_id=data.subject_id,
        description=data.description,
        color=data.color,
        icon=data.icon,
    )
    db.add(vault)
    await db.flush()  # gets vault.id; trigger auto-creates vault_statistics row

    await _log(db, user.id, "vault.created", squad_id, vault_id=str(vault.id), title=vault.title)
    await db.commit()
    return await _get_active_vault(db, vault.id)


async def list_vaults(
    db: AsyncSession,
    user: CurrentUser,
    squad_id: UUID,
    search: str | None = None,
    include_archived: bool = False,
    sort: str = "updated_at",
) -> list[Vault]:
    from app.models.squad import SquadMember

    # Verify membership
    res = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    if not res.scalar_one_or_none():
        raise ForbiddenError("You are not a member of this squad.")

    stmt = (
        select(Vault)
        .where(Vault.squad_id == squad_id, Vault.deleted_at.is_(None))
        .options(
            joinedload(Vault.statistics),
            joinedload(Vault.subject),  # type: ignore[attr-defined]
        )
    )

    if not include_archived:
        stmt = stmt.where(Vault.is_archived == False)  # noqa: E712

    if search:
        stmt = stmt.where(Vault.title.ilike(f"%{search}%"))

    order_col = {
        "updated_at": Vault.updated_at.desc(),
        "created_at": Vault.created_at.desc(),
        "title": Vault.title.asc(),
    }.get(sort, Vault.updated_at.desc())

    stmt = stmt.order_by(order_col)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_vault(db: AsyncSession, user: CurrentUser, vault_id: UUID) -> Vault:
    vault = await _get_active_vault(db, vault_id)
    await _assert_squad_member(db, vault, user.id)
    return vault


async def update_vault(
    db: AsyncSession, user: CurrentUser, vault_id: UUID, data: VaultUpdate
) -> Vault:
    vault = await _get_active_vault(db, vault_id)
    await _assert_can_manage(db, vault, user)

    if data.title is not None:
        new_title = data.title.strip()
        dup = await db.execute(
            select(Vault).where(
                Vault.squad_id == vault.squad_id,
                Vault.id != vault_id,
                func.lower(Vault.title) == new_title.lower(),
                Vault.deleted_at.is_(None),
            )
        )
        if dup.scalar_one_or_none():
            raise ConflictError(f"A vault named '{new_title}' already exists in this squad.")
        vault.title = new_title

    if data.subject_id is not None:
        subj = await db.execute(select(Subject).where(Subject.id == data.subject_id))
        if not subj.scalar_one_or_none():
            raise ValidationError("Invalid subject_id.")
        vault.subject_id = data.subject_id

    for field in ("description", "color", "icon"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(vault, field, val)

    await _log(db, user.id, "vault.updated", vault.squad_id, vault_id=str(vault.id))
    await db.commit()
    await db.refresh(vault)
    return vault


async def archive_vault(db: AsyncSession, user: CurrentUser, vault_id: UUID) -> Vault:
    vault = await _get_active_vault(db, vault_id)
    await _assert_can_manage(db, vault, user)
    if vault.is_archived:
        raise ValidationError("Vault is already archived.")
    vault.is_archived = True
    await _log(db, user.id, "vault.archived", vault.squad_id, vault_id=str(vault.id))
    await db.commit()
    await db.refresh(vault)
    return vault


async def restore_vault(db: AsyncSession, user: CurrentUser, vault_id: UUID) -> Vault:
    vault = await _get_active_vault(db, vault_id)
    await _assert_can_manage(db, vault, user)
    if not vault.is_archived:
        raise ValidationError("Vault is not archived.")
    vault.is_archived = False
    await _log(db, user.id, "vault.restored", vault.squad_id, vault_id=str(vault.id))
    await db.commit()
    await db.refresh(vault)
    return vault


async def delete_vault(db: AsyncSession, user: CurrentUser, vault_id: UUID) -> None:
    vault = await _get_active_vault(db, vault_id)
    # Only squad owner/admin can delete vaults
    from app.models.squad import SquadMember
    res = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    member = res.scalar_one_or_none()
    if not member or member.role not in ("owner", "admin"):
        raise ForbiddenError("Only squad admins can delete vaults.")

    vault.deleted_at = datetime.now(timezone.utc)
    await _log(db, user.id, "vault.deleted", vault.squad_id, vault_id=str(vault.id), title=vault.title)
    await db.commit()
