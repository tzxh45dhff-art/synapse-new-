"""Notes endpoints — generation (SSE), CRUD, versioning, export.

Streaming endpoints return ``text/event-stream``. The generation service owns
its own DB session for the duration of the stream, so those handlers do not
take the request-scoped ``get_db`` dependency.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.note_schema import (
    NoteCreateRequest,
    NoteGenerateRequest,
    NoteGenerationRead,
    NoteListItem,
    NoteRead,
    NoteRegenerateRequest,
    NoteUpdateRequest,
    NoteVersionRead,
    PromptTemplateRead,
    RestoreVersionRequest,
)
from app.services import notes_service, prompt_registry

router = APIRouter()

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


# ── Serialization ──────────────────────────────────────────────────────────────

def _list_item(n) -> dict:
    return {
        "id": n.id,
        "vault_id": n.vault_id,
        "title": n.title,
        "source_type": n.source_type,
        "content_format": n.content_format,
        "is_pinned": n.is_pinned,
        "word_count": n.word_count,
        "created_at": n.created_at,
        "updated_at": n.updated_at,
    }


def _detail(n) -> dict:
    return {**_list_item(n), "content": n.content, "created_by": n.created_by, "metadata": n.metadata_ or {}}


# ── Templates catalogue (static — must precede /notes/{note_id}) ────────────────

@router.get("/notes/templates", response_model=list[PromptTemplateRead])
async def list_templates(_: CurrentUserDep):
    return [
        {"key": t.key, "version": t.version, "label": t.label, "description": t.description}
        for t in prompt_registry.list_templates()
    ]


# ── Generation (SSE) ────────────────────────────────────────────────────────────

@router.post("/vaults/{vault_id}/notes/generate")
async def generate_note(
    vault_id: UUID,
    data: NoteGenerateRequest,
    current_user: CurrentUserDep,
):
    return StreamingResponse(
        notes_service.stream_generate(current_user, vault_id, data),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/notes/{note_id}/regenerate")
async def regenerate_note(
    note_id: UUID,
    data: NoteRegenerateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Resolve the note's vault first (cheap, request-scoped), then stream.
    note = await notes_service.get_note(db, current_user, note_id)
    return StreamingResponse(
        notes_service.stream_generate(current_user, note.vault_id, data, note_id=note_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


# ── List / create ─────────────────────────────────────────────────────────────

@router.get("/vaults/{vault_id}/notes", response_model=list[NoteListItem])
async def list_notes(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, max_length=200),
    source_type: str | None = Query(None),
    pinned: bool = Query(False),
):
    notes = await notes_service.list_notes(
        db, current_user, vault_id, search=search, source_type=source_type, pinned_only=pinned
    )
    return [_list_item(n) for n in notes]


@router.post("/vaults/{vault_id}/notes", response_model=NoteRead, status_code=201)
async def create_note(
    vault_id: UUID,
    data: NoteCreateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    note = await notes_service.create_manual_note(
        db, current_user, vault_id, title=data.title, content=data.content
    )
    return _detail(note)


# ── CRUD ────────────────────────────────────────────────────────────────────────

@router.get("/notes/{note_id}", response_model=NoteRead)
async def get_note(
    note_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return _detail(await notes_service.get_note(db, current_user, note_id))


@router.patch("/notes/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: UUID,
    data: NoteUpdateRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return _detail(await notes_service.update_note(db, current_user, note_id, data))


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await notes_service.delete_note(db, current_user, note_id)


# ── Versions ─────────────────────────────────────────────────────────────────────

@router.get("/notes/{note_id}/versions", response_model=list[NoteVersionRead])
async def list_versions(
    note_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await notes_service.list_versions(db, current_user, note_id)


@router.post("/notes/{note_id}/restore", response_model=NoteRead)
async def restore_version(
    note_id: UUID,
    data: RestoreVersionRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return _detail(await notes_service.restore_version(db, current_user, note_id, data.version_id))


@router.get("/notes/{note_id}/generations", response_model=list[NoteGenerationRead])
async def list_generations(
    note_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await notes_service.list_generations(db, current_user, note_id)


# ── Export ─────────────────────────────────────────────────────────────────────

@router.get("/notes/{note_id}/export")
async def export_note(
    note_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = Query("markdown"),
):
    data, filename, content_type = await notes_service.export_note(db, current_user, note_id, format)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
