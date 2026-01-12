import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.card import Card


class CardTag(SQLModel, table=True):
    """Association table for Card-Tag many-to-many relationship."""

    __tablename__ = "card_tags"

    card_id: uuid.UUID = Field(
        foreign_key="cards.id",
        primary_key=True,
    )
    tag_id: uuid.UUID = Field(
        foreign_key="tags.id",
        primary_key=True,
    )


class Tag(SQLModel, table=True):
    """Tag database model for categorizing cards."""

    __tablename__ = "tags"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        index=True,
    )
    name: str = Field(max_length=100, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship to cards through the association table
    cards: list["Card"] = Relationship(
        back_populates="tags",
        link_model=CardTag,
    )

