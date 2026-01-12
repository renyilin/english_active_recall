from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class CardType(str, Enum):
    """Card type enumeration."""

    PHRASE = "phrase"
    SENTENCE = "sentence"


class CardBase(BaseModel):
    """Base card schema with common fields."""

    type: CardType
    target_text: str = Field(max_length=500)
    target_meaning: str = Field(max_length=500)
    context_sentence: str = Field(max_length=1000)
    context_translation: str = Field(max_length=1000)
    cloze_sentence: str = Field(max_length=1000)


class CardCreate(CardBase):
    """Schema for creating a new card."""

    pass


class CardUpdate(BaseModel):
    """Schema for updating a card. All fields are optional."""

    type: CardType | None = None
    target_text: str | None = Field(default=None, max_length=500)
    target_meaning: str | None = Field(default=None, max_length=500)
    context_sentence: str | None = Field(default=None, max_length=1000)
    context_translation: str | None = Field(default=None, max_length=1000)
    cloze_sentence: str | None = Field(default=None, max_length=1000)


class CardRead(CardBase):
    """Schema for reading a card (response)."""

    id: UUID
    user_id: UUID
    interval: int
    ease_factor: float
    next_review: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CardList(BaseModel):
    """Schema for paginated card list response."""

    items: list[CardRead]
    total: int
    page: int
    page_size: int
