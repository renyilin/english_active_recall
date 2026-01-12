from uuid import UUID

from sqlmodel import Session, select

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import Token


class AuthService:
    """Authentication service handling registration, login, and token refresh."""

    def __init__(self, session: Session):
        self.session = session

    def get_user_by_email(self, email: str) -> User | None:
        """Retrieve user by email."""
        statement = select(User).where(User.email == email)
        return self.session.exec(statement).first()

    def get_user_by_id(self, user_id: UUID) -> User | None:
        """Retrieve user by ID."""
        return self.session.get(User, user_id)

    def create_user(self, email: str, password: str) -> User:
        """Create a new user with hashed password."""
        hashed_password = get_password_hash(password)
        user = User(email=email, hashed_password=hashed_password)
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def authenticate_user(self, email: str, password: str) -> User | None:
        """Authenticate user by email and password."""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def create_tokens(self, user: User) -> Token:
        """Create access and refresh tokens for a user."""
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    def refresh_tokens(self, refresh_token: str) -> Token | None:
        """Refresh tokens using a valid refresh token."""
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None

        try:
            uuid_id = UUID(user_id)
        except ValueError:
            return None

        user = self.get_user_by_id(uuid_id)
        if user is None or not user.is_active:
            return None

        return self.create_tokens(user)
