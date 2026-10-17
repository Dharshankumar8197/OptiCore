"""Application configuration."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Application
    app_name: str = "OptiCore"
    environment: str = "development"
    version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "sqlite:///./data/opticore.db"

    # JWT Authentication
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Model Configuration
    model_path: str = "./models/best.pt"
    confidence_threshold: float = 0.50
    iou_threshold: float = 0.45
    image_size: int = 640

    # Features
    enable_bluetooth: bool = True
    enable_wifi_discovery: bool = True
    enable_webrtc: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
