"""Authentication dependency injection for FastAPI routes."""

from typing import Annotated
from uuid import UUID

import jwt
from jwt import PyJWKClient
import structlog
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.db.session import get_db
from app.models.squad import SquadMember
from app.models.profile import Profile
from app.schemas.auth import CurrentUser

logger = structlog.get_logger()

security = HTTPBearer(auto_error=False)

SQUAD_ROLES_HIERARCHY = {
    "owner": 4,
    "admin": 3,
    "member": 2,
    "viewer": 1,
}

# JWKS Client to fetch and cache public keys for JWT validation
# Supabase exposes this on the auth endpoint
jwks_url = f"{settings.SUPABASE_URL}/auth/v1/jwks"
jwks_client = PyJWKClient(jwks_url)


# ---------------------------------------------------------------------------
# JWT Verification (uses JWKS)
# ---------------------------------------------------------------------------
async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> CurrentUser | None:
    """
    Verify the Supabase JWT using JWKS if present, else returns None.
    Extracts the authenticated user's UUID.
    """
    if not credentials:
        return None

    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",
        )
        user_id: str = payload.get("sub")
        email: str = payload.get("email", "")
        role: str = payload.get("role", "authenticated")

        if not user_id:
            raise UnauthorizedError("Invalid token: missing subject.")

        return CurrentUser(id=UUID(user_id), email=email, role=role)

    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token has expired.")
    except jwt.PyJWKClientError as e:
        logger.warning("bunker.auth.jwks_error", error=str(e))
        # Fallback to local secret validation if RS256 fails (useful for local dev with simple JWTs)
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return CurrentUser(
                id=UUID(payload["sub"]),
                email=payload.get("email", ""),
                role=payload.get("role", "authenticated"),
            )
        except Exception:
            raise UnauthorizedError("Invalid authentication token (JWKS and fallback failed).")
    except jwt.InvalidTokenError as e:
        logger.warning("bunker.auth.invalid_token", error=str(e))
        raise UnauthorizedError("Invalid authentication token.")


async def get_current_user(
    user: Annotated[CurrentUser | None, Depends(get_optional_user)],
) -> CurrentUser:
    """
    Ensures a valid user exists, otherwise throws Unauthorized.
    """
    if not user:
        raise UnauthorizedError("Authentication required.")
    return user


async def get_current_profile(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Profile:
    """
    Fetches the user's profile from the database.
    """
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise UnauthorizedError("User profile not found.")
        
    return profile


def require_authenticated_user():
    """
    Dependency factory to require authentication.
    """
    async def _require_auth(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        return user
    return _require_auth


# ---------------------------------------------------------------------------
# Squad Role Validation
# ---------------------------------------------------------------------------
def require_squad_role(min_role: str = "member"):
    """
    Factory dependency. Returns a dependency that validates the current user
    has at least `min_role` in the given squad.
    """
    async def _check_role(
        squad_id: UUID,
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> SquadMember:
        result = await db.execute(
            select(SquadMember).where(
                SquadMember.squad_id == squad_id,
                SquadMember.user_id == current_user.id,
                SquadMember.removed_at.is_(None),
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            raise ForbiddenError("You are not a member of this squad.")

        user_level = SQUAD_ROLES_HIERARCHY.get(member.role, 0)
        required_level = SQUAD_ROLES_HIERARCHY.get(min_role, 0)

        if user_level < required_level:
            raise ForbiddenError(
                f"This action requires '{min_role}' role or higher. "
                f"Your role is '{member.role}'."
            )

        return member

    return _check_role


# ---------------------------------------------------------------------------
# Convenience type aliases
# ---------------------------------------------------------------------------
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
ProfileDep = Annotated[Profile, Depends(get_current_profile)]

# Pre-built squad role dependencies
require_squad_member = require_squad_role("member")
require_squad_admin = require_squad_role("admin")
require_squad_owner = require_squad_role("owner")

