# Bunker — Pydantic Schemas
"""Shared Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, EmailStr

T = TypeVar("T")


# ─────────────────────────────────────────────────────────────────────────────
# Base
# ─────────────────────────────────────────────────────────────────────────────

class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


class PaginatedResponse(BunkerBaseModel, Generic[T]):
    data: list[T]
    total: int
    page: int
    page_size: int
    has_next: bool


# ─────────────────────────────────────────────────────────────────────────────
# Profile
# ─────────────────────────────────────────────────────────────────────────────

class ProfileRead(BunkerBaseModel):
    id: UUID
    email: str
    full_name: str | None
    display_name: str | None
    avatar_url: str | None
    university: str | None
    year_of_study: int | None
    onboarding_completed: bool
    created_at: datetime


class ProfileUpdate(BunkerBaseModel):
    full_name: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    university: str | None = None
    year_of_study: int | None = None
    timezone: str | None = None
    onboarding_completed: bool | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Squad
# ─────────────────────────────────────────────────────────────────────────────

class SquadCreate(BunkerBaseModel):
    name: str
    description: str | None = None


class SquadRead(BunkerBaseModel):
    id: UUID
    name: str
    description: str | None
    avatar_url: str | None
    invite_code: str
    is_personal: bool
    max_members: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class SquadMemberRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Vault
# ─────────────────────────────────────────────────────────────────────────────

class VaultCreate(BunkerBaseModel):
    title: str
    description: str | None = None
    subject_id: UUID | None = None
    color: str | None = None
    icon: str | None = None


class VaultRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    subject_id: UUID | None
    created_by: UUID
    title: str
    description: str | None
    color: str | None
    icon: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Resource
# ─────────────────────────────────────────────────────────────────────────────

class ResourceRead(BunkerBaseModel):
    id: UUID
    vault_id: UUID
    uploaded_by: UUID
    title: str
    file_name: str
    file_type: str
    file_size_bytes: int
    processing_status: str
    created_at: datetime
