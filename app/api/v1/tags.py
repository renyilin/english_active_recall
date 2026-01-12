from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.database import get_session
from app.dependencies import CurrentUser
from app.schemas.tag import TagCreate, TagList, TagRead
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["Tags"])


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_data: TagCreate,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> TagRead:
    """Create a new tag."""
    tag_service = TagService(session)
    
    # Check if tag with same name already exists
    existing = tag_service.get_by_name(user_id=current_user.id, name=tag_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists",
        )
    
    tag = tag_service.create(user_id=current_user.id, tag_data=tag_data)
    return TagRead.model_validate(tag)


@router.get("", response_model=TagList)
async def list_tags(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> TagList:
    """List all tags for the current user."""
    tag_service = TagService(session)
    tags, total = tag_service.get_all(user_id=current_user.id)
    return TagList(
        items=[TagRead.model_validate(tag) for tag in tags],
        total=total,
    )


@router.get("/{tag_id}", response_model=TagRead)
async def get_tag(
    tag_id: UUID,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> TagRead:
    """Get a specific tag by ID."""
    tag_service = TagService(session)
    tag = tag_service.get_by_id(user_id=current_user.id, tag_id=tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )
    return TagRead.model_validate(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    """Delete a tag."""
    tag_service = TagService(session)
    deleted = tag_service.delete(user_id=current_user.id, tag_id=tag_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )
