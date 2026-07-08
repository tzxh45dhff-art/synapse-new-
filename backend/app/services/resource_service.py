"""Resource business logic — upload flow, list, rename, delete, retry, cancel."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.profile import Profile
from app.models.resource import Resource, ResourceProcessingJob
from app.models.system import ActivityLog
from app.models.vault import Vault
from app.schemas.auth import CurrentUser
from app.schemas.resource_schema import (
    ALLOWED_MIME_TYPES,
    ResourceStatusResponse,
    ResourceUpdate,
    STAGE_LABELS,
    STAGE_PROGRESS,
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services import storage_service

logger = structlog.get_logger()

MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_active_resource(db: AsyncSession, resource_id: UUID) -> Resource:
    result = await db.execute(
        select(Resource)
        .where(Resource.id == resource_id, Resource.deleted_at.is_(None))
        .options(
            joinedload(Resource.metadata_record),
            selectinload(Resource.processing_jobs),
        )
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource")
    return resource


async def _get_vault_and_assert_member(db: AsyncSession, vault_id: UUID, user_id: UUID) -> Vault:
    result = await db.execute(
        select(Vault).where(Vault.id == vault_id, Vault.deleted_at.is_(None))
    )
    vault = result.scalar_one_or_none()
    if not vault:
        raise NotFoundError("Vault")

    from app.models.squad import SquadMember
    mem = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user_id,
            SquadMember.removed_at.is_(None),
        )
    )
    if not mem.scalar_one_or_none():
        raise ForbiddenError("You are not a member of this squad.")
    return vault


async def _assert_can_manage_resource(db: AsyncSession, resource: Resource, user: CurrentUser) -> None:
    vault_res = await db.execute(
        select(Vault).where(Vault.id == resource.vault_id)
    )
    vault = vault_res.scalar_one_or_none()
    if not vault:
        raise NotFoundError("Vault")

    from app.models.squad import SquadMember
    mem_res = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user.id,
            SquadMember.removed_at.is_(None),
        )
    )
    member = mem_res.scalar_one_or_none()
    if not member:
        raise ForbiddenError("Not a squad member.")
    if member.role not in ("owner", "admin") and resource.uploaded_by != user.id:
        raise ForbiddenError("Only the uploader or admins can manage this resource.")


async def _log(db: AsyncSession, user_id: UUID, action: str, resource_id: UUID, **meta: object) -> None:
    db.add(ActivityLog(
        user_id=user_id,
        action=action,
        entity_type="resource",
        entity_id=resource_id,
        metadata_=meta,
    ))


# ─────────────────────────────────────────────────────────────────────────────
# Upload flow
# ─────────────────────────────────────────────────────────────────────────────

async def generate_upload_url(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    data: UploadUrlRequest,
) -> UploadUrlResponse:
    vault = await _get_vault_and_assert_member(db, vault_id, user.id)

    if vault.is_archived:
        raise ValidationError("Cannot upload to an archived vault.")

    if data.file_size_bytes > MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"File size {data.file_size_bytes} bytes exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit."
        )

    if data.mime_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"Unsupported file type: {data.mime_type}.")

    file_ext = ALLOWED_MIME_TYPES[data.mime_type]

    # Duplicate filename detection within vault
    dup = await db.execute(
        select(Resource).where(
            Resource.vault_id == vault_id,
            Resource.file_name == data.file_name,
            Resource.deleted_at.is_(None),
        )
    )
    if dup.scalar_one_or_none():
        raise ConflictError(f"A file named '{data.file_name}' already exists in this vault.")

    # Create pending resource row
    resource_id = uuid4()
    storage_path = storage_service.build_storage_path(vault.squad_id, vault_id, resource_id, data.file_name)

    resource = Resource(
        id=resource_id,
        vault_id=vault_id,
        uploaded_by=user.id,
        title=data.file_name,  # default title = filename; user can rename later
        file_name=data.file_name,
        file_url=storage_path,
        file_type=file_ext,
        file_size_bytes=data.file_size_bytes,
        mime_type=data.mime_type,
        processing_status="pending",
        processing_stage="uploaded",
    )
    db.add(resource)
    await db.flush()

    # Generate signed upload URL (10 min expiry)
    upload_url = await storage_service.generate_signed_upload_url(storage_path, expires_in=600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=600)

    await _log(db, user.id, "resource.upload_initiated", resource_id,
               vault_id=str(vault_id), file_name=data.file_name)
    await db.commit()

    return UploadUrlResponse(
        resource_id=resource_id,
        upload_url=upload_url,
        storage_path=storage_path,
        expires_at=expires_at,
    )


async def complete_upload(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    data: UploadCompleteRequest,
) -> UploadCompleteResponse:
    """Called by client after successful direct upload. Enqueues processing job."""
    # Fetch the resource we created in generate_upload_url
    result = await db.execute(
        select(Resource).where(
            Resource.id == data.resource_id,
            Resource.vault_id == vault_id,
            Resource.deleted_at.is_(None),
        )
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource")
    if resource.uploaded_by != user.id:
        raise ForbiddenError("Not your upload.")

    resource.file_url = data.storage_path
    await db.flush()

    # Enqueue processing job
    from app.services.processing_service import enqueue_job
    await enqueue_job(db, resource.id, "metadata_extraction")

    await _log(db, user.id, "resource.upload_complete", resource.id,
               vault_id=str(vault_id), storage_path=data.storage_path)
    await db.commit()

    return UploadCompleteResponse(
        resource_id=resource.id,
        processing_stage=resource.processing_stage,
        message="Upload received. Processing has been queued.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# List / Get
# ─────────────────────────────────────────────────────────────────────────────

async def list_resources(
    db: AsyncSession,
    user: CurrentUser,
    vault_id: UUID,
    search: str | None = None,
    file_type: str | None = None,
    stage: str | None = None,
) -> list[Resource]:
    await _get_vault_and_assert_member(db, vault_id, user.id)

    stmt = (
        select(Resource)
        .where(Resource.vault_id == vault_id, Resource.deleted_at.is_(None))
        .options(joinedload(Resource.metadata_record))
        .order_by(Resource.created_at.desc())
    )
    if search:
        stmt = stmt.where(Resource.title.ilike(f"%{search}%"))
    if file_type:
        stmt = stmt.where(Resource.file_type == file_type)
    if stage:
        stmt = stmt.where(Resource.processing_stage == stage)

    result = await db.execute(stmt)
    resources = list(result.scalars().unique().all())

    # Attach uploader profiles
    uploader_ids = {r.uploaded_by for r in resources}
    profiles_res = await db.execute(
        select(Profile).where(Profile.id.in_(uploader_ids))
    )
    profiles = {p.id: p for p in profiles_res.scalars().all()}
    for r in resources:
        r._uploader_profile = profiles.get(r.uploaded_by)  # type: ignore[attr-defined]

    return resources


async def get_resource(db: AsyncSession, user: CurrentUser, resource_id: UUID) -> Resource:
    resource = await _get_active_resource(db, resource_id)
    await _get_vault_and_assert_member(db, resource.vault_id, user.id)
    # Attach uploader profile
    p = await db.execute(select(Profile).where(Profile.id == resource.uploaded_by))
    resource._uploader_profile = p.scalar_one_or_none()  # type: ignore[attr-defined]
    return resource


async def get_resource_status(db: AsyncSession, user: CurrentUser, resource_id: UUID) -> ResourceStatusResponse:
    result = await db.execute(
        select(Resource.id, Resource.processing_status, Resource.processing_stage,
               Resource.processing_error, Resource.is_ai_ready)
        .where(Resource.id == resource_id, Resource.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise NotFoundError("Resource")

    rid, status, stage, error, ai_ready = row
    return ResourceStatusResponse(
        id=rid,
        processing_status=status,
        processing_stage=stage,
        stage_label=STAGE_LABELS.get(stage, stage),
        progress_pct=STAGE_PROGRESS.get(stage, 0),
        error=error,
        is_ai_ready=ai_ready,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Manage
# ─────────────────────────────────────────────────────────────────────────────

async def rename_resource(
    db: AsyncSession, user: CurrentUser, resource_id: UUID, data: ResourceUpdate
) -> Resource:
    resource = await _get_active_resource(db, resource_id)
    await _assert_can_manage_resource(db, resource, user)
    resource.title = data.title.strip()
    await _log(db, user.id, "resource.renamed", resource_id, new_title=data.title)
    await db.commit()
    await db.refresh(resource)
    return resource


async def delete_resource(db: AsyncSession, user: CurrentUser, resource_id: UUID) -> None:
    resource = await _get_active_resource(db, resource_id)
    await _assert_can_manage_resource(db, resource, user)
    resource.deleted_at = datetime.now(timezone.utc)
    # Store storage path for async cleanup (worker can clean up later)
    resource.metadata_["_deleted_storage_path"] = resource.file_url
    await _log(db, user.id, "resource.deleted", resource_id, file_name=resource.file_name)
    await db.commit()


async def retry_processing(db: AsyncSession, user: CurrentUser, resource_id: UUID) -> Resource:
    resource = await _get_active_resource(db, resource_id)
    await _assert_can_manage_resource(db, resource, user)

    if resource.processing_stage not in ("failed", "cancelled"):
        raise ValidationError("Only failed or cancelled resources can be retried.")

    # Resume from the stage that failed — never re-run completed stages.
    # The most recent job's type identifies the stage to restart.
    jobs = sorted(resource.processing_jobs, key=lambda j: j.created_at, reverse=True)
    resume_type = jobs[0].job_type if jobs else "metadata_extraction"
    resume_stage = {
        "metadata_extraction": "uploaded",
        "chunking": "chunking",
        "embedding": "embedding",
    }.get(resume_type, "uploaded")

    resource.processing_stage = resume_stage
    resource.processing_status = "pending"
    resource.processing_error = None

    from app.services.processing_service import enqueue_job
    await enqueue_job(db, resource.id, resume_type)

    await _log(db, user.id, "resource.retry", resource_id, resume_stage=resume_stage)
    await db.commit()
    await db.refresh(resource)
    return resource


async def cancel_processing(db: AsyncSession, user: CurrentUser, resource_id: UUID) -> Resource:
    resource = await _get_active_resource(db, resource_id)
    await _assert_can_manage_resource(db, resource, user)

    if resource.processing_stage in ("complete", "failed", "cancelled"):
        raise ValidationError(f"Cannot cancel a resource in '{resource.processing_stage}' stage.")

    resource.processing_stage = "cancelled"
    resource.processing_status = "cancelled"

    # Cancel any queued/running jobs
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(ResourceProcessingJob)
        .where(
            ResourceProcessingJob.resource_id == resource_id,
            ResourceProcessingJob.status.in_(["queued", "running"]),
        )
        .values(status="cancelled")
    )

    await _log(db, user.id, "resource.cancelled", resource_id)
    await db.commit()
    await db.refresh(resource)
    return resource
