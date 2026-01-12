from fastapi import APIRouter

from app.dependencies import CurrentUser
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def get_current_user_info(current_user: CurrentUser) -> UserRead:
    """
    Get current authenticated user's information.
    """
    return UserRead.model_validate(current_user)
