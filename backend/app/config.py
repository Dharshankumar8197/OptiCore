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
    api_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    # Portable Server & Image Reference
    opticore_image: str = "ghcr.io/dharshankumar8197/opticore-server"
    opticore_version: str = "1.0.0"

    # Database
    database_url: str = "sqlite:///./data/opticore.db"

    # Authentication & Security
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    auth_required: bool = False
    cors_allowed_origins: str = "*"
    log_level: str = "info"

    # Model Configuration
    model_path: str = "./models/best.pt"
    confidence_threshold: float = 0.50
    iou_threshold: float = 0.45
    image_size: int = 640
    max_upload_size_mb: int = 15
    max_concurrent_inferences: int = 3

    # Features
    enable_bluetooth: bool = True
    enable_wifi_discovery: bool = True
    enable_webrtc: bool = True

    # Remote Ngrok Tunnel
    ngrok_authtoken: Optional[str] = None
    ngrok_enabled: bool = False

    # Optional AI Context Explainer
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

    def safe_dict(self) -> dict:
        """Return configuration dictionary with sensitive secrets redacted."""
        data = self.model_dump()
        for secret_key in ("jwt_secret_key", "ngrok_authtoken", "groq_api_key"):
            if data.get(secret_key):
                val = str(data[secret_key])
                data[secret_key] = val[:4] + "..." + val[-4:] if len(val) > 8 else "***"
        return data


settings = Settings()

