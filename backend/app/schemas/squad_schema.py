"""Pydantic schemas for Squad and SquadMember API contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.schemas import BunkerBaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────

class SquadCreate(BunkerBaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)
    avatar_url: str | None = None


class SquadUpdate(BunkerBaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)
    avatar_url: str | None = None
    max_members: int | None = Field(None, ge=1, le=500)


class JoinSquadRequest(BunkerBaseModel):
    invite_code: str = Field(..., min_length=1, max_length=20)


class ChangeRoleRequest(BunkerBaseModel):
    role: Literal["admin", "member", "viewer"]


class TransferOwnershipRequest(BunkerBaseModel):
    new_owner_id: UUID


# ─────────────────────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class MemberProfile(BunkerBaseModel):
    """Lightweight profile data embedded in member responses."""
    id: UUID
    email: str
    display_name: str | None
    full_name: str | None
    avatar_url: str | None


class SquadRead(BunkerBaseModel):
    id: UUID
    name: str
    description: str | None
    avatar_url: str | None
    invite_code: str
    is_personal: bool
    max_members: int
    member_count: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    current_user_role: str | None = None


class SquadListItem(BunkerBaseModel):
    """Lighter version of SquadRead for list views."""
    id: UUID
    name: str
    description: str | None
    avatar_url: str | None
    is_personal: bool
    member_count: int
    current_user_role: str | None = None
    created_at: datetime


class SquadMemberRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    profile: MemberProfile | None = None
