from uuid import UUID
from pydantic import BaseModel, EmailStr


class CurrentUser(BaseModel):
    """Represents the authenticated user extracted from the Supabase JWT."""
    id: UUID
    email: str
    role: str  # Supabase role (e.g., 'authenticated', 'service_role')

    model_config = {"from_attributes": True}
