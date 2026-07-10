"""Squad group-chat endpoints (WhatsApp-style, per-squad, multi-user).

Registered without a prefix (mirrors invitations.py); every route carries the
`{squad_id}` path segment so `require_squad_role("member")` can authorize the
caller. Real-time delivery is handled client-side via Supabase Realtime — these
routes only persist state and return the canonical serialized message.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentUserDep, require_squad_role
from app.db.session import get_db
from app.models.squad import SquadMember
from app.schemas.squad_chat_schema import (
    AttachmentUrlRequest,
    AttachmentUrlResponse,
    MessagePage,
    ReactionRequest,
    SendMessageRequest,
    SquadMessageRead,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services import squad_chat_service

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
MemberDep = Annotated[SquadMember, Depends(require_squad_role("member"))]


@router.get("/squads/{squad_id}/messages", response_model=MessagePage)
async def list_messages(
    squad_id: UUID,
    db: DbDep,
    _member: MemberDep,
    before: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=50),
) -> MessagePage:
    return await squad_chat_service.list_messages(db, squad_id, before=before, limit=limit)


@router.get("/squads/{squad_id}/messages/{message_id}", response_model=SquadMessageRead)
async def get_message(
    squad_id: UUID,
    message_id: UUID,
    db: DbDep,
    _member: MemberDep,
) -> SquadMessageRead:
    return await squad_chat_service.get_message(db, squad_id, message_id)


@router.post("/squads/{squad_id}/messages", response_model=SquadMessageRead, status_code=201)
async def send_message(
    squad_id: UUID,
    data: SendMessageRequest,
    db: DbDep,
    member: MemberDep,
    user: CurrentUserDep,
) -> SquadMessageRead:
    return await squad_chat_service.send_message(db, squad_id, member, user, data)


@router.delete("/squads/{squad_id}/messages/{message_id}", status_code=204)
async def delete_message(
    squad_id: UUID,
    message_id: UUID,
    db: DbDep,
    member: MemberDep,
    user: CurrentUserDep,
) -> None:
    await squad_chat_service.delete_message(db, squad_id, message_id, member, user)


@router.put("/squads/{squad_id}/messages/{message_id}/reactions", status_code=204)
async def toggle_reaction(
    squad_id: UUID,
    message_id: UUID,
    data: ReactionRequest,
    db: DbDep,
    _member: MemberDep,
    user: CurrentUserDep,
) -> None:
    await squad_chat_service.toggle_reaction(db, squad_id, message_id, user, data.emoji)


@router.post("/squads/{squad_id}/messages/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    squad_id: UUID,
    data: UploadUrlRequest,
    _member: MemberDep,
) -> UploadUrlResponse:
    return await squad_chat_service.create_upload_url(squad_id, data)


@router.post("/squads/{squad_id}/messages/attachment-url", response_model=AttachmentUrlResponse)
async def get_attachment_url(
    squad_id: UUID,
    data: AttachmentUrlRequest,
    _member: MemberDep,
) -> AttachmentUrlResponse:
    return await squad_chat_service.get_attachment_url(squad_id, data.storage_path)
