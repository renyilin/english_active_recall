from datetime import datetime, timedelta
from uuid import UUID

from sqlmodel import Session, func, select, or_

from app.models.card import Card
from app.models.tag import CardTag, Tag
from app.schemas.card import CardCreate, CardUpdate, ReviewRating


class CardService:
    """Service for Card CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def _get_tags_by_ids(self, user_id: UUID, tag_ids: list[UUID]) -> list[Tag]:
        """Get tags by IDs, scoped to user."""
        if not tag_ids:
            return []
        statement = select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == user_id)
        return list(self.session.exec(statement).all())

    def create(self, user_id: UUID, card_data: CardCreate) -> Card:
        """Create a new card for a user."""
        # Get tags if provided
        tags = self._get_tags_by_ids(user_id, card_data.tag_ids)
        
        card = Card(
            user_id=user_id,
            type=card_data.type.value,
            target_text=card_data.target_text,
            target_meaning=card_data.target_meaning,
            context_sentence=card_data.context_sentence,
            context_translation=card_data.context_translation,
            cloze_sentence=card_data.cloze_sentence,
            tags=tags,
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
        tag_id: UUID | None = None,
        search_query: str | None = None,
    ) -> tuple[list[Card], int]:
        """Get all cards for a user with pagination."""
        statement = select(Card).where(Card.user_id == user_id)

        if card_type:
            statement = statement.where(Card.type == card_type)

        if search_query:
            search_filter = or_(
                Card.target_text.contains(search_query),
                Card.target_meaning.contains(search_query)
            )
            statement = statement.where(search_filter)

        # Get total count
        count_statement = select(func.count()).select_from(Card).where(Card.user_id == user_id)
        if card_type:
            count_statement = count_statement.where(Card.type == card_type)
        if search_query:
            count_statement = count_statement.where(
                or_(
                    Card.target_text.contains(search_query),
                    Card.target_meaning.contains(search_query)
                )
            )
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
        
        # Handle tag_ids separately
        tag_ids = update_data.pop("tag_ids", None)
        if tag_ids is not None:
            card.tags = self._get_tags_by_ids(user_id, tag_ids)
        
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

    def get_study_cards(
        self,
        user_id: UUID,
        limit: int = 50,
        strategy: str = "hardest",
        tag_ids: list[UUID] | None = None,
    ) -> list[Card]:
        """
        Get cards for study mode based on selection strategy.

        Args:
            user_id: The user's UUID
            limit: Maximum number of cards to return (default 50)
            strategy: Selection strategy - "hardest", "random", or "tag"
            tag_ids: List of tag UUIDs for tag-based selection

        Returns:
            List of Card objects based on the strategy
        """
        statement = select(Card).where(Card.user_id == user_id)

        if strategy == "hardest":
            # Order by ease_factor (lowest first = most difficult cards)
            statement = statement.order_by(Card.ease_factor, Card.interval)
        elif strategy == "random":
            statement = statement.order_by(func.random())
        elif strategy == "tag" and tag_ids:
            # Join with card_tags and filter by tag IDs
            statement = (
                statement
                .join(CardTag, Card.id == CardTag.card_id)
                .where(CardTag.tag_id.in_(tag_ids))
            )

        statement = statement.limit(limit)
        return list(self.session.exec(statement).all())

    def review(self, user_id: UUID, card_id: UUID, rating: ReviewRating) -> Card | None:
        """
        Review a card and update SRS metadata.

        Simplified SM-2 algorithm:
        - Forgot: Reset interval to 0, review in < 10 minutes
        - Hard: Interval = Current * 1.2
        - Remembered: Interval = Current * 2.5
        """
        card = self.get_by_id(user_id, card_id)
        if not card:
            return None

        now = datetime.utcnow()

        if rating == ReviewRating.FORGOT:
            # Reset progress, review again soon (10 minutes)
            card.interval = 0
            card.next_review = now + timedelta(minutes=10)
            # Decrease ease factor slightly (min 1.3)
            card.ease_factor = max(1.3, card.ease_factor - 0.2)
        elif rating == ReviewRating.HARD:
            # Small increase
            if card.interval == 0:
                card.interval = 1
            else:
                card.interval = max(1, int(card.interval * 1.2))
            card.next_review = now + timedelta(days=card.interval)
            # Slight ease factor decrease (min 1.3)
            card.ease_factor = max(1.3, card.ease_factor - 0.1)
        else:  # REMEMBERED
            # Large increase
            if card.interval == 0:
                card.interval = 1
            else:
                card.interval = int(card.interval * card.ease_factor)
            card.next_review = now + timedelta(days=card.interval)
            # Increase ease factor slightly (max 3.0)
            card.ease_factor = min(3.0, card.ease_factor + 0.1)

        card.updated_at = now
        self.session.add(card)
        self.session.commit()
        self.session.refresh(card)
        return card

