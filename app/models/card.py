import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.tag import Tag

from app.models.tag import CardTag


class Card(SQLModel, table=True):
    """Flashcard database model with SRS metadata."""

    __tablename__ = "cards"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        index=True,
    )

    # Content fields
    type: str = Field(max_length=20)  # "phrase" or "sentence"
    target_text: str = Field(max_length=500)
    target_meaning: str = Field(max_length=500)
    context_sentence: str = Field(max_length=1000)
    context_translation: str = Field(max_length=1000)
    cloze_sentence: str = Field(max_length=1000)

    # SRS metadata
    interval: int = Field(default=0)  # Days until next review
    ease_factor: float = Field(default=2.5)
    next_review: datetime = Field(default_factory=datetime.utcnow)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship to tags through the association table
    tags: list["Tag"] = Relationship(
        back_populates="cards",
        link_model=CardTag,
    )

