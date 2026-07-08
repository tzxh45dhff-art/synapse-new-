"""Vault endpoints — nested under /squads/{squad_id}/vaults and flat /vaults/{vault_id}."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.vault_schema import VaultCreate, VaultListItem, VaultRead, VaultUpdate, SubjectRead
from app.services import vault_service

router = APIRouter()


# ── Subjects ─────────────────────────────────────────────────────────────────

@router.get("/subjects", response_model=list[SubjectRead])
async def list_subjects(
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all available subjects (for vault creation form)."""
    subjects = await vault_service.list_subjects(db)
    return subjects


# ── Vault list / create (nested under squad) ─────────────────────────────────

@router.get("/squads/{squad_id}/vaults", response_model=list[VaultListItem])
async def list_vaults(
    squad_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, max_length=200),
    include_archived: bool = Query(False),
    sort: str = Query("updated_at", pattern="^(updated_at|created_at|title)$"),
):
    vaults = await vault_service.list_vaults(
        db, current_user, squad_id, search=search,
        include_archived=include_archived, sort=sort,
    )
    return vaults


@router.post("/squads/{squad_id}/vaults", response_model=VaultRead, status_code=201)
async def create_vault(
    squad_id: UUID,
    data: VaultCreate,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    vault = await vault_service.create_vault(db, current_user, squad_id, data)
    return vault


# ── Flat vault CRUD ───────────────────────────────────────────────────────────

@router.get("/vaults/{vault_id}", response_model=VaultRead)
async def get_vault(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await vault_service.get_vault(db, current_user, vault_id)


@router.patch("/vaults/{vault_id}", response_model=VaultRead)
async def update_vault(
    vault_id: UUID,
    data: VaultUpdate,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await vault_service.update_vault(db, current_user, vault_id, data)


@router.delete("/vaults/{vault_id}", status_code=204)
async def delete_vault(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await vault_service.delete_vault(db, current_user, vault_id)


@router.post("/vaults/{vault_id}/archive", response_model=VaultRead)
async def archive_vault(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await vault_service.archive_vault(db, current_user, vault_id)


@router.post("/vaults/{vault_id}/restore", response_model=VaultRead)
async def restore_vault(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await vault_service.restore_vault(db, current_user, vault_id)
