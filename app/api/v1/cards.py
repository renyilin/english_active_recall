from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.dependencies import CurrentUser
from app.schemas.card import CardCreate, CardList, CardRead, CardType, CardUpdate, ReviewRequest
from app.services.card_service import CardService

router = APIRouter(prefix="/cards", tags=["Cards"])


@router.post("", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def create_card(
    card_data: CardCreate,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> CardRead:
    """Create a new flashcard."""
    card_service = CardService(session)
    card = card_service.create(user_id=current_user.id, card_data=card_data)
    return CardRead.model_validate(card)


@router.get("", response_model=CardList)
async def list_cards(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    card_type: CardType | None = None,
    q: str | None = Query(default=None, description="Search query for text or meaning"),
) -> CardList:
    """List all cards for the current user with pagination."""
    card_service = CardService(session)
    type_value = card_type.value if card_type else None
    cards, total = card_service.get_all(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        card_type=type_value,
        search_query=q,
    )
    return CardList(
        items=[CardRead.model_validate(card) for card in cards],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/due", response_model=list[CardRead])
async def get_due_cards(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[CardRead]:
    """Get cards due for review."""
    card_service = CardService(session)
    cards = card_service.get_due_cards(user_id=current_user.id, limit=limit)
    return [CardRead.model_validate(card) for card in cards]


@router.get("/study", response_model=list[CardRead])
async def get_study_cards(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    limit: int = Query(default=50, ge=1, le=100),
    strategy: str = Query(default="hardest", pattern="^(hardest|random|tag)$"),
    tag_ids: list[UUID] | None = Query(default=None),
) -> list[CardRead]:
    """
    Get cards for study mode (review without SRS updates).

    Selection strategies:
    - **hardest**: Cards ordered by ease factor (lowest first, most difficult cards)
    - **random**: Random selection of cards
    - **tag**: Filter cards by selected tags (requires tag_ids parameter)
    """
    card_service = CardService(session)
    cards = card_service.get_study_cards(
        user_id=current_user.id,
        limit=limit,
        strategy=strategy,
        tag_ids=tag_ids,
    )
    return [CardRead.model_validate(card) for card in cards]


@router.get("/{card_id}", response_model=CardRead)
async def get_card(
    card_id: UUID,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> CardRead:
    """Get a specific card by ID."""
    card_service = CardService(session)
    card = card_service.get_by_id(user_id=current_user.id, card_id=card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )
    return CardRead.model_validate(card)


@router.patch("/{card_id}", response_model=CardRead)
async def update_card(
    card_id: UUID,
    card_data: CardUpdate,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> CardRead:
    """Update a card."""
    card_service = CardService(session)
    card = card_service.update(user_id=current_user.id, card_id=card_id, card_data=card_data)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )
    return CardRead.model_validate(card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: UUID,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    """Delete a card."""
    card_service = CardService(session)
    deleted = card_service.delete(user_id=current_user.id, card_id=card_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )


@router.post("/{card_id}/review", response_model=CardRead)
async def review_card(
    card_id: UUID,
    review_data: ReviewRequest,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> CardRead:
    """
    Review a card with SRS grading.

    Rating options:
    - **forgot**: Reset progress, review in ~10 minutes
    - **hard**: Small interval increase (x1.2)
    - **remembered**: Large interval increase (x2.5)
    """
    card_service = CardService(session)
    card = card_service.review(
        user_id=current_user.id, card_id=card_id, rating=review_data.rating
    )
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found",
        )
    return CardRead.model_validate(card)
