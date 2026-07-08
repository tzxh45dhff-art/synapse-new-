"""Pydantic schemas for Invitation API contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.schemas import BunkerBaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────

class InvitationCreate(BunkerBaseModel):
    role: Literal["admin", "member", "viewer"] = "member"


# ─────────────────────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class InvitationRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    squad_name: str | None = None
    invited_by: UUID
    inviter_name: str | None = None
    invited_email: str | None
    invited_user_id: UUID | None
    token: str
    role: str
    status: str
    expires_at: datetime
    responded_at: datetime | None
    accepted_by: UUID | None
    accepted_at: datetime | None
    created_at: datetime


class InvitationPublicRead(BunkerBaseModel):
    """Token-based public view — no sensitive internal IDs."""
    squad_name: str
    squad_avatar_url: str | None
    squad_member_count: int
    role: str
    status: str
    expires_at: datetime
    inviter_name: str | None = None
    is_expired: bool = False
