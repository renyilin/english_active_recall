from datetime import datetime
from uuid import UUID

from sqlmodel import Session, func, select

from app.models.card import Card
from app.schemas.card import CardCreate, CardUpdate


class CardService:
    """Service for Card CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id: UUID, card_data: CardCreate) -> Card:
        """Create a new card for a user."""
        card = Card(
            user_id=user_id,
            type=card_data.type.value,
            target_text=card_data.target_text,
            target_meaning=card_data.target_meaning,
            context_sentence=card_data.context_sentence,
            context_translation=card_data.context_translation,
            cloze_sentence=card_data.cloze_sentence,
        )
        self.session.add(card)
        self.session.commit()
        self.session.refresh(card)
        return card

    def get_by_id(self, user_id: UUID, card_id: UUID) -> Card | None:
        """Get a card by ID, scoped to user."""
        statement = select(Card).where(Card.id == card_id, Card.user_id == user_id)
        return self.session.exec(statement).first()

    def get_all(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        card_type: str | None = None,
    ) -> tuple[list[Card], int]:
        """Get all cards for a user with pagination."""
        statement = select(Card).where(Card.user_id == user_id)

        if card_type:
            statement = statement.where(Card.type == card_type)

        # Get total count
        count_statement = select(func.count()).select_from(Card).where(Card.user_id == user_id)
        if card_type:
            count_statement = count_statement.where(Card.type == card_type)
        total = self.session.exec(count_statement).one()

        # Apply pagination
        statement = statement.offset((page - 1) * page_size).limit(page_size)
        statement = statement.order_by(Card.created_at.desc())

        cards = list(self.session.exec(statement).all())
        return cards, total

    def update(self, user_id: UUID, card_id: UUID, card_data: CardUpdate) -> Card | None:
        """Update a card."""
        card = self.get_by_id(user_id, card_id)
        if not card:
            return None

        update_data = card_data.model_dump(exclude_unset=True)
        if "type" in update_data and update_data["type"]:
            update_data["type"] = update_data["type"].value

        for key, value in update_data.items():
            setattr(card, key, value)

        card.updated_at = datetime.utcnow()
        self.session.add(card)
        self.session.commit()
        self.session.refresh(card)
        return card

    def delete(self, user_id: UUID, card_id: UUID) -> bool:
        """Delete a card."""
        card = self.get_by_id(user_id, card_id)
        if not card:
            return False

        self.session.delete(card)
        self.session.commit()
        return True

    def get_due_cards(self, user_id: UUID, limit: int = 20) -> list[Card]:
        """Get cards due for review."""
        statement = (
            select(Card)
            .where(Card.user_id == user_id, Card.next_review <= datetime.utcnow())
            .order_by(Card.next_review)
            .limit(limit)
        )
        return list(self.session.exec(statement).all())
