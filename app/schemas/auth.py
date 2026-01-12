from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    """Token response schema."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """JWT token payload."""

    sub: str
    exp: int
    type: str


class UserRegister(BaseModel):
    """User registration request."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class UserLogin(BaseModel):
    """User login request."""

    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""

    refresh_token: str
