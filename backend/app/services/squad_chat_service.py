"""Squad group-chat service — send / list / delete messages and toggle reactions.

Orchestration only; all SQL lives in SquadChatRepository. Messages are written
with the backend's DB session (service role at the storage layer) and then
delivered to every subscribed member by Supabase Realtime — this service does
not push anything itself.
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
from uuid import UUID, uuid4

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models.profile import Profile
from app.models.squad import SquadMember
from app.models.squad_message import SquadMessage, SquadMessageReaction
from app.repositories.squad_chat_repository import SquadChatRepository
from app.schemas.auth import CurrentUser
from app.schemas.squad_chat_schema import (
    AttachmentUrlResponse,
    MessagePage,
    ReactionSummary,
    ReplyPreview,
    SendMessageRequest,
    SquadMessageRead,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.schemas.squad_schema import MemberProfile
from app.services import storage_service

logger = structlog.get_logger()

MAX_PAGE = 50


# ─────────────────────────────────────────────────────────────────────────────
# Serialization helpers
# ─────────────────────────────────────────────────────────────────────────────

def _member_profile(profile: Profile | None) -> MemberProfile | None:
    if profile is None:
        return None
    return MemberProfile(
        id=profile.id,
        email=profile.email,
        display_name=profile.display_name,
        full_name=profile.full_name,
        avatar_url=profile.avatar_url,
    )


def _display_name(profile: Profile | None) -> str | None:
    if profile is None:
        return None
    return profile.display_name or profile.full_name or profile.email


def _reaction_summaries(reactions: list[SquadMessageReaction]) -> list[ReactionSummary]:
    grouped: "OrderedDict[str, list[UUID]]" = OrderedDict()
    for r in reactions:
        grouped.setdefault(r.emoji, []).append(r.user_id)
    return [
        ReactionSummary(emoji=emoji, count=len(uids), user_ids=uids)
        for emoji, uids in grouped.items()
    ]


def _reply_preview(
    reply: SquadMessage | None, profiles: dict[UUID, Profile]
) -> ReplyPreview | None:
    if reply is None:
        return None
    deleted = reply.deleted_at is not None
    return ReplyPreview(
        id=reply.id,
        sender_id=reply.sender_id,
        sender_name=_display_name(profiles.get(reply.sender_id)),
        content="" if deleted else reply.content,
        message_type=reply.message_type,  # type: ignore[arg-type]
        deleted=deleted,
    )


def _serialize(msg: SquadMessage, profiles: dict[UUID, Profile]) -> SquadMessageRead:
    deleted = msg.deleted_at is not None
    return SquadMessageRead(
        id=msg.id,
        squad_id=msg.squad_id,
        sender_id=msg.sender_id,
        sender=_member_profile(profiles.get(msg.sender_id)),
        content="" if deleted else msg.content,
        message_type=msg.message_type,  # type: ignore[arg-type]
        attachment=None if deleted else msg.attachment,
        reply_to=_reply_preview(msg.reply_to, profiles),
        reactions=[] if deleted else _reaction_summaries(list(msg.reactions)),
        created_at=msg.created_at,
        edited_at=msg.edited_at,
        deleted=deleted,
    )


async def _profiles_for(
    repo: SquadChatRepository, messages: list[SquadMessage]
) -> dict[UUID, Profile]:
    ids: set[UUID] = set()
    for m in messages:
        ids.add(m.sender_id)
        if m.reply_to is not None:
            ids.add(m.reply_to.sender_id)
    return await repo.get_profiles(ids)


# ─────────────────────────────────────────────────────────────────────────────
# Reads
# ─────────────────────────────────────────────────────────────────────────────

async def get_message(
    db: AsyncSession, squad_id: UUID, message_id: UUID
) -> SquadMessageRead:
    repo = SquadChatRepository(db)
    msg = await repo.get_message(message_id)
    if msg is None or msg.squad_id != squad_id:
        raise NotFoundError("Message")
    profiles = await _profiles_for(repo, [msg])
    return _serialize(msg, profiles)


async def list_messages(
    db: AsyncSession,
    squad_id: UUID,
    *,
    before: datetime | None = None,
    limit: int = MAX_PAGE,
) -> MessagePage:
    limit = max(1, min(limit, MAX_PAGE))
    repo = SquadChatRepository(db)
    # fetch one extra to detect whether older messages remain
    rows = await repo.list_messages(squad_id, before=before, limit=limit + 1)
    has_more = len(rows) > limit
    if has_more:
        rows = rows[1:]  # rows are oldest→newest; drop the extra oldest one
    profiles = await _profiles_for(repo, rows)
    messages = [_serialize(m, profiles) for m in rows]
    return MessagePage(
        messages=messages,
        has_more=has_more,
        next_before=rows[0].created_at if rows and has_more else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Writes
# ─────────────────────────────────────────────────────────────────────────────

async def send_message(
    db: AsyncSession,
    squad_id: UUID,
    member: SquadMember,
    user: CurrentUser,
    req: SendMessageRequest,
) -> SquadMessageRead:
    if member.role == "viewer":
        raise ForbiddenError("Viewers cannot send messages.")

    content = req.content.strip()
    attachment: dict | None = None
    message_type = "text"

    if req.file is not None:
        exists = await storage_service.verify_object_exists(req.file.storage_path)
        if not exists:
            raise ValidationError("Uploaded file was not found in storage.")
        attachment = req.file.model_dump()
        message_type = "file"
    elif req.shared is not None:
        attachment = req.shared.model_dump(mode="json")
        message_type = "note" if req.message_type == "note" else "resource"

    if not content and attachment is None:
        raise ValidationError("Message must have text or an attachment.")

    repo = SquadChatRepository(db)

    if req.reply_to_id is not None:
        parent = await repo.get_message(req.reply_to_id)
        if parent is None or parent.squad_id != squad_id:
            raise ValidationError("Cannot reply to a message from another squad.")

    message = SquadMessage(
        squad_id=squad_id,
        sender_id=user.id,
        content=content,
        message_type=message_type,
        attachment=attachment,
        reply_to_id=req.reply_to_id,
    )
    await repo.create_message(message)
    await db.commit()

    created = await repo.get_message(message.id)
    assert created is not None
    profiles = await _profiles_for(repo, [created])
    logger.info("squad_chat.sent", squad_id=str(squad_id), message_id=str(created.id))
    return _serialize(created, profiles)


async def delete_message(
    db: AsyncSession, squad_id: UUID, message_id: UUID, member: SquadMember, user: CurrentUser
) -> None:
    repo = SquadChatRepository(db)
    msg = await repo.get_message(message_id)
    if msg is None or msg.squad_id != squad_id or msg.deleted_at is not None:
        raise NotFoundError("Message")

    is_owner = msg.sender_id == user.id
    is_moderator = member.role in ("owner", "admin")
    if not (is_owner or is_moderator):
        raise ForbiddenError("You can only delete your own messages.")

    msg.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("squad_chat.deleted", squad_id=str(squad_id), message_id=str(message_id))


async def toggle_reaction(
    db: AsyncSession, squad_id: UUID, message_id: UUID, user: CurrentUser, emoji: str
) -> None:
    repo = SquadChatRepository(db)
    msg = await repo.get_message(message_id)
    if msg is None or msg.squad_id != squad_id or msg.deleted_at is not None:
        raise NotFoundError("Message")

    existing = await repo.get_reaction(message_id, user.id, emoji)
    if existing is not None:
        await repo.remove_reaction(message_id, user.id, emoji)
    else:
        await repo.add_reaction(
            SquadMessageReaction(
                message_id=message_id,
                squad_id=squad_id,
                user_id=user.id,
                emoji=emoji,
            )
        )
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Attachments
# ─────────────────────────────────────────────────────────────────────────────

def _chat_storage_path(squad_id: UUID, file_name: str) -> str:
    safe = file_name.replace("/", "_").strip() or "file"
    return f"chat/{squad_id}/{uuid4()}/{safe}"


async def create_upload_url(
    squad_id: UUID, req: UploadUrlRequest
) -> UploadUrlResponse:
    path = _chat_storage_path(squad_id, req.file_name)
    upload_url = await storage_service.generate_signed_upload_url(path)
    return UploadUrlResponse(upload_url=upload_url, storage_path=path)


async def get_attachment_url(
    squad_id: UUID, storage_path: str
) -> AttachmentUrlResponse:
    # Defence in depth: chat attachments always live under chat/{squad_id}/…
    if not storage_path.startswith(f"chat/{squad_id}/"):
        raise ForbiddenError("Attachment does not belong to this squad.")
    url = await storage_service.generate_signed_download_url(storage_path)
    return AttachmentUrlResponse(download_url=url)
