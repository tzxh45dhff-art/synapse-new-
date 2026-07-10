"""Pydantic schemas for the global Ask AI chat assistant."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BunkerBaseModel(BaseModel):
    model_config = {"from_attributes": True}


MessageRole = Literal["user", "assistant"]


# ── Requests ────────────────────────────────────────────────────────────────
class ChatSessionCreateRequest(BunkerBaseModel):
    # Set to scope the session to one vault; omit for a global session that
    # searches every vault the user can access.
    vault_id: UUID | None = None


class ChatMessageSendRequest(BunkerBaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class ChatFeedbackRequest(BunkerBaseModel):
    rating: Literal[-1, 1]
    feedback_text: str | None = Field(default=None, max_length=1000)
    feedback_tags: list[str] = Field(default_factory=list)


# ── Reads ─────────────────────────────────────────────────────────────────────
class ChatCitationRead(BunkerBaseModel):
    index: int
    chunk_id: UUID
    resource_id: UUID
    resource_title: str
    vault_id: UUID
    vault_title: str
    squad_id: UUID
    page_number: int | None
    heading: str | None
    snippet: str
    similarity: float


class ChatSessionRead(BunkerBaseModel):
    id: UUID
    vault_id: UUID | None
    title: str | None
    message_count: int
    last_message_at: datetime | None
    created_at: datetime


class ChatMessageRead(BunkerBaseModel):
    id: UUID
    session_id: UUID
    role: MessageRole
    content: str
    created_at: datetime
    citations: list[ChatCitationRead] = Field(default_factory=list)


class ChatFeedbackRead(BunkerBaseModel):
    id: UUID
    message_id: UUID
    rating: int
    created_at: datetime
