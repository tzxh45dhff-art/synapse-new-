"""Resource endpoints — upload flow, list, CRUD, status polling, retry, cancel."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import CurrentUserDep, get_db
from app.db.session import AsyncSession
from app.schemas.resource_schema import (
    ResourceListItem,
    ResourceRead,
    ResourceStatusResponse,
    ResourceUpdate,
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services import resource_service

router = APIRouter()


# ── Upload flow ───────────────────────────────────────────────────────────────

@router.post("/vaults/{vault_id}/resources/upload-url", response_model=UploadUrlResponse, status_code=201)
async def generate_upload_url(
    vault_id: UUID,
    data: UploadUrlRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Step 1: Request a signed upload URL.
    Creates a pending Resource row and returns a signed Supabase Storage URL.
    Client should PUT the file directly to upload_url.
    """
    return await resource_service.generate_upload_url(db, current_user, vault_id, data)


@router.post("/vaults/{vault_id}/resources/upload-complete", response_model=UploadCompleteResponse)
async def complete_upload(
    vault_id: UUID,
    data: UploadCompleteRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Step 2: Notify backend that client upload finished.
    Enqueues the metadata extraction job.
    """
    return await resource_service.complete_upload(db, current_user, vault_id, data)


# ── Resource list ─────────────────────────────────────────────────────────────

@router.get("/vaults/{vault_id}/resources", response_model=list[ResourceListItem])
async def list_resources(
    vault_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, max_length=200),
    file_type: str | None = Query(None),
    stage: str | None = Query(None),
):
    resources = await resource_service.list_resources(
        db, current_user, vault_id,
        search=search, file_type=file_type, stage=stage,
    )
    # Serialize with embedded uploader
    return [_serialize_list_item(r) for r in resources]


# ── Resource CRUD ─────────────────────────────────────────────────────────────

@router.get("/resources/{resource_id}", response_model=ResourceRead)
async def get_resource(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resource = await resource_service.get_resource(db, current_user, resource_id)
    return _serialize_detail(resource)


@router.get("/resources/{resource_id}/status", response_model=ResourceStatusResponse)
async def get_resource_status(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Lightweight status polling endpoint — does not load metadata or jobs."""
    return await resource_service.get_resource_status(db, current_user, resource_id)


@router.patch("/resources/{resource_id}", response_model=ResourceRead)
async def rename_resource(
    resource_id: UUID,
    data: ResourceUpdate,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resource = await resource_service.rename_resource(db, current_user, resource_id, data)
    return _serialize_detail(resource)


@router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await resource_service.delete_resource(db, current_user, resource_id)


@router.post("/resources/{resource_id}/retry", response_model=ResourceRead)
async def retry_processing(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resource = await resource_service.retry_processing(db, current_user, resource_id)
    return _serialize_detail(resource)


@router.post("/resources/{resource_id}/cancel", response_model=ResourceRead)
async def cancel_processing(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resource = await resource_service.cancel_processing(db, current_user, resource_id)
    return _serialize_detail(resource)


# ── Serialization helpers ─────────────────────────────────────────────────────

def _serialize_list_item(r) -> dict:
    profile = getattr(r, "_uploader_profile", None)
    return {
        "id": r.id,
        "vault_id": r.vault_id,
        "title": r.title,
        "file_name": r.file_name,
        "file_type": r.file_type,
        "file_size_bytes": r.file_size_bytes,
        "mime_type": r.mime_type,
        "processing_status": r.processing_status,
        "processing_stage": r.processing_stage,
        "is_ai_ready": r.is_ai_ready,
        "uploader": _profile_dict(profile),
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _serialize_detail(r) -> dict:
    profile = getattr(r, "_uploader_profile", None)
    return {
        "id": r.id,
        "vault_id": r.vault_id,
        "title": r.title,
        "file_name": r.file_name,
        "file_url": r.file_url,
        "file_type": r.file_type,
        "file_size_bytes": r.file_size_bytes,
        "mime_type": r.mime_type,
        "processing_status": r.processing_status,
        "processing_stage": r.processing_stage,
        "is_ai_ready": r.is_ai_ready,
        "processing_error": r.processing_error,
        "processed_at": r.processed_at,
        "uploader": _profile_dict(profile),
        "metadata_record": r.metadata_record,
        "processing_jobs": r.processing_jobs or [],
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _profile_dict(profile) -> dict | None:
    if not profile:
        return None
    return {
        "id": profile.id,
        "display_name": profile.display_name,
        "full_name": profile.full_name,
        "avatar_url": profile.avatar_url,
    }


@router.get("/resources/{resource_id}/download-url")
async def get_download_url(
    resource_id: UUID,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate a temporary signed download URL for the resource file."""
    resource = await resource_service.get_resource(db, current_user, resource_id)
    from app.services import storage_service
    url = await storage_service.generate_signed_download_url(resource.file_url)
    return {"download_url": url}

