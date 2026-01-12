from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, text

from app.core.database import get_session

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy"}


@router.get("/health/db")
async def database_health(
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    """Database connectivity health check."""
    try:
        session.exec(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}
