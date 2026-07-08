"""Pydantic schemas for Resource, ResourceMetadata, upload flow, and status polling."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Processing
# ─────────────────────────────────────────────────────────────────────────────

ProcessingStage = Literal[
    "uploaded", "validating", "extracting",
    "chunking", "embedding", "complete", "failed", "cancelled"
]

STAGE_LABELS: dict[str, str] = {
    "uploaded": "Queued",
    "validating": "Validating",
    "extracting": "Extracting Metadata",
    "chunking": "Chunking",
    "embedding": "Embedding",
    "complete": "Ready",
    "failed": "Failed",
    "cancelled": "Cancelled",
}

STAGE_PROGRESS: dict[str, int] = {
    "uploaded": 5,
    "validating": 25,
    "extracting": 60,
    "chunking": 75,
    "embedding": 90,
    "complete": 100,
    "failed": 0,
    "cancelled": 0,
}


class ProcessingJobRead(BunkerBaseModel):
    id: UUID
    job_type: str
    status: str
    attempts: int
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime


class ResourceStatusResponse(BunkerBaseModel):
    id: UUID
    processing_status: str
    processing_stage: str
    stage_label: str
    progress_pct: int
    error: str | None
    is_ai_ready: bool


# ─────────────────────────────────────────────────────────────────────────────
# Resource metadata
# ─────────────────────────────────────────────────────────────────────────────

class ResourceMetadataRead(BunkerBaseModel):
    pages: int | None
    words: int | None
    images: int | None
    slides: int | None
    language: str | None
    detected_title: str | None
    author: str | None
    pdf_version: str | None
    reading_time_mins: int | None
    width_px: int | None
    height_px: int | None
    extracted_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Uploader profile (embedded in resource list/detail)
# ─────────────────────────────────────────────────────────────────────────────

class UploaderProfile(BunkerBaseModel):
    id: UUID
    display_name: str | None
    full_name: str | None
    avatar_url: str | None


# ─────────────────────────────────────────────────────────────────────────────
# Resource CRUD
# ─────────────────────────────────────────────────────────────────────────────

class ResourceUpdate(BunkerBaseModel):
    title: str = Field(..., min_length=1, max_length=500)


class ResourceListItem(BunkerBaseModel):
    id: UUID
    vault_id: UUID
    title: str
    file_name: str
    file_type: str
    file_size_bytes: int
    mime_type: str | None
    processing_status: str
    processing_stage: str
    is_ai_ready: bool
    uploader: UploaderProfile | None
    created_at: datetime
    updated_at: datetime


class ResourceRead(BunkerBaseModel):
    id: UUID
    vault_id: UUID
    title: str
    file_name: str
    file_url: str
    file_type: str
    file_size_bytes: int
    mime_type: str | None
    processing_status: str
    processing_stage: str
    is_ai_ready: bool
    processing_error: str | None
    processed_at: datetime | None
    uploader: UploaderProfile | None
    metadata_record: ResourceMetadataRead | None
    processing_jobs: list[ProcessingJobRead]
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Upload flow
# ─────────────────────────────────────────────────────────────────────────────

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
    "text/plain": "txt",
    "text/markdown": "md",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}


class UploadUrlRequest(BunkerBaseModel):
    file_name: str = Field(..., min_length=1, max_length=500)
    mime_type: str
    file_size_bytes: int = Field(..., gt=0)


class UploadUrlResponse(BunkerBaseModel):
    resource_id: UUID
    upload_url: str
    storage_path: str
    expires_at: datetime


class UploadCompleteRequest(BunkerBaseModel):
    resource_id: UUID
    storage_path: str


class UploadCompleteResponse(BunkerBaseModel):
    resource_id: UUID
    processing_stage: str
    message: str
