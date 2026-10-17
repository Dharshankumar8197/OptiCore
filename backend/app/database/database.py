"""Database configuration and session management."""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings

import os

# Create engine with automatic directory creation for SQLite
if settings.database_url.startswith("sqlite"):
    # Extract path and ensure parent directory exists (e.g. ./data/)
    db_path = settings.database_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
