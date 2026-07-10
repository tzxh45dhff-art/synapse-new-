"""Pydantic schemas for the squad group chat API contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.schemas import BunkerBaseModel
from app.schemas.squad_schema import MemberProfile

MessageType = Literal["text", "file", "resource", "note"]


# ─────────────────────────────────────────────────────────────────────────────
# Attachments
# ─────────────────────────────────────────────────────────────────────────────

class FileAttachment(BunkerBaseModel):
    """A file uploaded to storage and attached to a message."""
    storage_path: str
    file_name: str
    mime_type: str
    size_bytes: int


class SharedAttachment(BunkerBaseModel):
    """A reference to in-app content (a vault resource or note)."""
    ref_id: UUID
    vault_id: UUID
    title: str
    subtitle: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Requests
# ─────────────────────────────────────────────────────────────────────────────

class UploadUrlRequest(BunkerBaseModel):
    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., max_length=255)
    size_bytes: int = Field(..., ge=0)


class UploadUrlResponse(BunkerBaseModel):
    upload_url: str
    storage_path: str


class SendMessageRequest(BunkerBaseModel):
    content: str = Field("", max_length=8000)
    message_type: MessageType = "text"
    file: FileAttachment | None = None
    shared: SharedAttachment | None = None
    reply_to_id: UUID | None = None


class ReactionRequest(BunkerBaseModel):
    emoji: str = Field(..., min_length=1, max_length=16)


class AttachmentUrlRequest(BunkerBaseModel):
    storage_path: str


class AttachmentUrlResponse(BunkerBaseModel):
    download_url: str


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class ReactionSummary(BunkerBaseModel):
    emoji: str
    count: int
    user_ids: list[UUID]


class ReplyPreview(BunkerBaseModel):
    id: UUID
    sender_id: UUID
    sender_name: str | None
    content: str
    message_type: MessageType
    deleted: bool


class SquadMessageRead(BunkerBaseModel):
    id: UUID
    squad_id: UUID
    sender_id: UUID
    sender: MemberProfile | None = None
    content: str
    message_type: MessageType
    attachment: dict | None = None
    reply_to: ReplyPreview | None = None
    reactions: list[ReactionSummary] = []
    created_at: datetime
    edited_at: datetime | None = None
    deleted: bool = False


class MessagePage(BunkerBaseModel):
    """A page of history, oldest → newest, with a cursor for older pages."""
    messages: list[SquadMessageRead]
    has_more: bool
    next_before: datetime | None = None
