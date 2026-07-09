"""Supabase Storage integration — signed URLs, verification, deletion."""

import httpx
import structlog
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.config import settings

logger = structlog.get_logger()

BUCKET = settings.SUPABASE_STORAGE_BUCKET
STORAGE_BASE = f"{settings.SUPABASE_URL}/storage/v1"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }


def build_storage_path(squad_id: UUID, vault_id: UUID, resource_id: UUID, filename: str) -> str:
    """Canonical path: uploads/{squad_id}/{vault_id}/{resource_id}/{filename}"""
    return f"uploads/{squad_id}/{vault_id}/{resource_id}/{filename}"


async def generate_signed_upload_url(
    path: str,
    expires_in: int = 600,
) -> str:
    """Generate a signed URL for direct client-to-storage upload."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{STORAGE_BASE}/object/upload/sign/{BUCKET}/{path}",
            headers=_headers(),
            json={"expiresIn": expires_in},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        url_path = data.get("url") or data.get("signedUrl") or data.get("signedURL")
        if not url_path:
            raise ValueError(f"Unexpected storage response: {data}")
        # Return full signed upload URL
        if url_path.startswith("http"):
            return url_path
        if not url_path.startswith("/"):
            url_path = "/" + url_path
        return f"{settings.SUPABASE_URL}/storage/v1{url_path}"


async def generate_signed_download_url(
    path: str,
    expires_in: int = 3600,
) -> str:
    """Generate a temporary signed download URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{STORAGE_BASE}/object/sign/{BUCKET}/{path}",
            headers=_headers(),
            json={"expiresIn": expires_in},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        signed = data.get("signedURL") or data.get("signedUrl") or data.get("url")
        if not signed:
            raise ValueError(f"Unexpected storage response: {data}")
        if signed.startswith("http"):
            return signed
        return f"{settings.SUPABASE_URL}{signed}"


async def verify_object_exists(path: str) -> bool:
    """Check if an object exists in the bucket (head request)."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.head(
                f"{STORAGE_BASE}/object/{BUCKET}/{path}",
                headers=_headers(),
                timeout=10.0,
            )
            return resp.status_code == 200
        except Exception as e:
            logger.warning("storage.verify_failed", path=path, error=str(e))
            return False


async def download_object(path: str) -> bytes:
    """Download raw bytes of an object from storage."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{STORAGE_BASE}/object/{BUCKET}/{path}",
            headers=_headers(),
            timeout=60.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
        return resp.content


async def delete_object(path: str) -> bool:
    """Delete an object from the bucket. Returns True if successful."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"{STORAGE_BASE}/object/{BUCKET}/{path}",
                headers=_headers(),
                timeout=10.0,
            )
            return resp.status_code in (200, 204)
        except Exception as e:
            logger.error("storage.delete_failed", path=path, error=str(e))
            return False
