from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.auth import RefreshTokenRequest, Token, UserRegister
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    session: Annotated[Session, Depends(get_session)],
) -> UserRead:
    """
    Register a new user.

    - **email**: Valid email address (unique)
    - **password**: Minimum 8 characters
    """
    auth_service = AuthService(session)

    # Check if user already exists
    existing_user = auth_service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = auth_service.create_user(
        email=user_data.email,
        password=user_data.password,
    )
    return UserRead.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[Session, Depends(get_session)],
) -> Token:
    """
    OAuth2 compatible token login.

    Use `username` field for email address.
    """
    auth_service = AuthService(session)

    user = auth_service.authenticate_user(
        email=form_data.username,  # OAuth2 spec uses 'username'
        password=form_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return auth_service.create_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: RefreshTokenRequest,
    session: Annotated[Session, Depends(get_session)],
) -> Token:
    """
    Refresh access token using a valid refresh token.
    """
    auth_service = AuthService(session)

    tokens = auth_service.refresh_tokens(token_data.refresh_token)
    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return tokens
