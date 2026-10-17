"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.database.models import User, Session as SessionModel
from app.auth import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_active_user
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create new user
    user = User(
        full_name=request.full_name,
        email=request.email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user and return JWT token."""
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.jwt_expiration_hours
    )
    session = SessionModel(
        user_id=user.id,
        token_id=access_token,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_expiration_hours * 3600,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Logout user."""
    # Invalidate all sessions for this user
    db.query(SessionModel).filter(SessionModel.user_id == current_user.id).delete()
    db.commit()

    return {"message": "Successfully logged out"}
