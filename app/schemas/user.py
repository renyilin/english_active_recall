from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr


class UserCreate(UserBase):
    """User creation schema (internal use)."""

    hashed_password: str


class UserRead(UserBase):
    """User response schema (public)."""

    id: UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """User update schema."""

    email: EmailStr | None = None
    password: str | None = None
