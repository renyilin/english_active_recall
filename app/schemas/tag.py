from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TagBase(BaseModel):
    """Base tag schema."""

    name: str = Field(max_length=100)


class TagCreate(TagBase):
    """Schema for creating a new tag."""

    pass


class TagRead(TagBase):
    """Schema for reading a tag (response)."""

    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TagList(BaseModel):
    """Schema for list of tags."""

    items: list[TagRead]
    total: int
