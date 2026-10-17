"""Authentication schemas."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class RegisterRequest(BaseModel):
    """User registration request."""

    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=255)
    device_name: Optional[str] = None


class LoginRequest(BaseModel):
    """User login request."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response model."""

    id: str
    full_name: str
    email: str
    is_active: bool
    created_at: str
    last_login_at: Optional[str] = None

    class Config:
        from_attributes = True


class LogoutRequest(BaseModel):
    """Logout request."""

    pass
