"""Pydantic schemas for Vault, VaultStatistics, and Subject."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Subject
# ─────────────────────────────────────────────────────────────────────────────

class SubjectRead(BunkerBaseModel):
    id: UUID
    name: str
    slug: str
    icon: str | None
    parent_id: UUID | None


# ─────────────────────────────────────────────────────────────────────────────
# Vault Statistics
# ─────────────────────────────────────────────────────────────────────────────

class VaultStatsRead(BunkerBaseModel):
    resource_count: int
    storage_bytes: int
    pdf_count: int
    ppt_count: int
    doc_count: int
    image_count: int
    other_count: int
    last_upload_at: datetime | None
    contributor_count: int


# ─────────────────────────────────────────────────────────────────────────────
# Vault CRUD
# ─────────────────────────────────────────────────────────────────────────────

class VaultCreate(BunkerBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    subject_id: UUID
    description: str | None = Field(None, max_length=2000)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str | None = Field(None, max_length=50)


class VaultUpdate(BunkerBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    subject_id: UUID | None = None
    description: str | None = Field(None, max_length=2000)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str | None = Field(None, max_length=50)


class VaultListItem(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    title: str
    description: str | None
    color: str | None
    icon: str | None
    is_archived: bool
    subject: SubjectRead | None
    statistics: VaultStatsRead | None
    created_at: datetime
    updated_at: datetime


class VaultRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    created_by: UUID
    title: str
    description: str | None
    color: str | None
    icon: str | None
    is_archived: bool
    subject: SubjectRead | None
    statistics: VaultStatsRead | None
    created_at: datetime
    updated_at: datetime
