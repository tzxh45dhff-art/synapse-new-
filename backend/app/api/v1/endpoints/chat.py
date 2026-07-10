"""Chat endpoints — the global Ask AI assistant. Sessions, history (SSE), feedback.

Streaming endpoints return ``text/event-stream``. The chat service owns its own
DB session for the duration of the stream, so those handlers do not take the
request-scoped ``get_db`` dependency (mirrors ``notes.py``).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.chat_schema import (
    ChatFeedbackRequest,
    ChatMessageRead,
    ChatMessageSendRequest,
    ChatSessionCreateRequest,
    ChatSessionRead,
)
from app.services import chat_service

router = APIRouter()

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


# ── Sessions ────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=ChatSessionRead, status_code=201)
async def create_session(
    data: ChatSessionCreateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await chat_service.create_session(db, current_user, data.vault_id)


@router.get("/sessions", response_model=list[ChatSessionRead])
async def list_sessions(
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await chat_service.list_sessions(db, current_user)


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageRead])
async def get_messages(
    session_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await chat_service.get_messages(db, current_user, session_id)


# ── Send message (SSE) ───────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: UUID,
    data: ChatMessageSendRequest,
    current_user: CurrentUserDep,
):
    return StreamingResponse(
        chat_service.stream_message(current_user, session_id, data.content),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


# ── Feedback ─────────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/feedback", status_code=204)
async def submit_feedback(
    message_id: UUID,
    data: ChatFeedbackRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await chat_service.submit_feedback(
        db, current_user, message_id, data.rating, data.feedback_text, data.feedback_tags
    )
