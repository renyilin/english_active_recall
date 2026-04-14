from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session
from app.dependencies import CurrentUser
from app.models.card import Card
from app.services.export_service import ExportService

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/cards")
async def export_cards(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> StreamingResponse:
    """Export all cards for the current user as a CSV file."""
    statement = (
        select(Card)
        .where(Card.user_id == current_user.id)
        .order_by(Card.created_at.desc())
    )
    cards = list(session.exec(statement).all())

    export_service = ExportService()
    csv_buf = export_service.cards_to_csv(cards)

    return StreamingResponse(
        csv_buf,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=flashcards_export.csv"
        },
    )
