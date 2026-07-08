"""Pydantic schemas for the AI Notes Generator."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


GenerationMode = Literal[
    "full_notes",
    "summary",
    "exam_notes",
    "revision_notes",
    "detailed_notes",
    "bullet_notes",
    "concept_explanation",
    "formula_sheet",
    "cheat_sheet",
    "definitions_only",
    "qa_notes",
]

# How source context is selected before generation.
RetrievalMode = Literal["vault", "resources", "chapters", "pages"]

ExportFormat = Literal["markdown", "pdf", "docx"]


# ── Generation settings (mirrors AI Settings requirements) ───────────────────
class NoteGenerationSettings(BunkerBaseModel):
    length: Literal["short", "medium", "long", "comprehensive"] = "medium"
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    audience: str = Field(default="university student", max_length=120)
    language: str = Field(default="English", max_length=60)
    output_format: Literal["markdown"] = "markdown"
    tone: Literal["neutral", "formal", "casual", "concise"] = "neutral"
    exam_focus: bool = False
    include_citations: bool = True


class NoteGenerateRequest(BunkerBaseModel):
    mode: GenerationMode
    retrieval_mode: RetrievalMode = "vault"
    title: str | None = Field(default=None, max_length=500)
    # Semantic focus / query (used for retrieval_mode="vault" and optional filtering).
    query: str | None = Field(default=None, max_length=1000)
    # Selection inputs (depend on retrieval_mode).
    resource_ids: list[UUID] = Field(default_factory=list)
    page_resource_id: UUID | None = None
    pages: list[int] = Field(default_factory=list)
    chapters: list[str] = Field(default_factory=list)
    settings: NoteGenerationSettings = Field(default_factory=NoteGenerationSettings)
    max_context_chunks: int = Field(default=12, ge=1, le=40)


class NoteRegenerateRequest(NoteGenerateRequest):
    """Same inputs as generation; targets an existing note (creates a version)."""


# ── Reads ─────────────────────────────────────────────────────────────────────
class CitationRead(BunkerBaseModel):
    index: int
    chunk_id: UUID
    resource_id: UUID
    resource_title: str
    page_number: int | None
    heading: str | None
    snippet: str
    similarity: float


class NoteListItem(BunkerBaseModel):
    id: UUID
    vault_id: UUID
    title: str
    source_type: str
    content_format: str
    is_pinned: bool
    word_count: int
    created_at: datetime
    updated_at: datetime


class NoteRead(NoteListItem):
    content: str
    created_by: UUID
    metadata: dict = Field(default_factory=dict)


class NoteVersionRead(BunkerBaseModel):
    id: UUID
    note_id: UUID
    version_number: int
    content: str
    created_by: UUID
    change_summary: str | None
    created_at: datetime


class NoteGenerationRead(BunkerBaseModel):
    id: UUID
    note_id: UUID
    generation_id: UUID | None
    source_resource_ids: list[UUID]
    prompt_template: str | None
    created_at: datetime


# ── Mutations ───────────────────────────────────────────────────────────────
class NoteUpdateRequest(BunkerBaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = None
    is_pinned: bool | None = None
    change_summary: str | None = Field(default=None, max_length=500)


class NoteCreateRequest(BunkerBaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = ""


class RestoreVersionRequest(BunkerBaseModel):
    version_id: UUID


# ── Template catalogue ──────────────────────────────────────────────────────
class PromptTemplateRead(BunkerBaseModel):
    key: str
    version: str
    label: str
    description: str
