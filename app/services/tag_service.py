from uuid import UUID

from sqlmodel import Session, select

from app.models.tag import Tag
from app.schemas.tag import TagCreate


class TagService:
    """Service for Tag CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id: UUID, tag_data: TagCreate) -> Tag:
        """Create a new tag for a user."""
        tag = Tag(
            user_id=user_id,
            name=tag_data.name,
        )
        self.session.add(tag)
        self.session.commit()
        self.session.refresh(tag)
        return tag

    def get_by_id(self, user_id: UUID, tag_id: UUID) -> Tag | None:
        """Get a tag by ID, scoped to user."""
        statement = select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
        return self.session.exec(statement).first()

    def get_by_name(self, user_id: UUID, name: str) -> Tag | None:
        """Get a tag by name, scoped to user."""
        statement = select(Tag).where(Tag.name == name, Tag.user_id == user_id)
        return self.session.exec(statement).first()

    def get_or_create(self, user_id: UUID, name: str) -> Tag:
        """Get an existing tag or create a new one."""
        tag = self.get_by_name(user_id, name)
        if tag:
            return tag
        return self.create(user_id, TagCreate(name=name))

    def get_all(self, user_id: UUID) -> tuple[list[Tag], int]:
        """Get all tags for a user."""
        statement = select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
        tags = list(self.session.exec(statement).all())
        return tags, len(tags)

    def get_by_ids(self, user_id: UUID, tag_ids: list[UUID]) -> list[Tag]:
        """Get multiple tags by their IDs, scoped to user."""
        if not tag_ids:
            return []
        statement = select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == user_id)
        return list(self.session.exec(statement).all())

    def delete(self, user_id: UUID, tag_id: UUID) -> bool:
        """Delete a tag."""
        tag = self.get_by_id(user_id, tag_id)
        if not tag:
            return False

        self.session.delete(tag)
        self.session.commit()
        return True
