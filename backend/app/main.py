"""OptiCore Backend Application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.database import engine, Base
from app.api import auth, devices, model, system

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)  # OptiCore FastAPI Engine

# Create database tables (existing tables only — new columns handled by Alembic)
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="OptiCore Backend",
    version=settings.version,
    description="AI-powered vision control platform",
)

# Add CORS middleware (supporting localhost, mobile devices, LAN IPs, and ngrok tunnels)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Root endpoint."""
    return {
        "app": "OptiCore Backend",
        "status": "running",
        "version": settings.version,
        "docs": "/docs",
    }


@app.get("/health")
def health():
    """Health check endpoint for frontend status polling."""
    from app.inference import is_model_loaded
    return {
        "status": "ok",
        "database": "ok",
        "model_loaded": is_model_loaded(),
        "model_status": "ready" if is_model_loaded() else "standby",
        "version": settings.version,
    }


# Include routers
app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(model.router)
app.include_router(system.router)

# Bluetooth and WebSocket routers (added in Phase 2)
try:
    from app.api import bluetooth as bluetooth_module
    app.include_router(bluetooth_module.router)
    logger.info("Bluetooth router registered")
except ImportError:
    logger.warning("Bluetooth module not yet available")

try:
    from app.api import websocket as websocket_module
    app.include_router(websocket_module.router)
    logger.info("WebSocket router registered")
except ImportError:
    logger.warning("WebSocket module not yet available")

# Wi-Fi scan/connect router
try:
    from app.api import wifi as wifi_module
    app.include_router(wifi_module.router)
    logger.info("Wi-Fi router registered")
except ImportError:
    logger.warning("Wi-Fi module not yet available")

# Warm-load YOLO model at startup
try:
    from app import inference as inference_module
    inference_module.get_model()
    logger.info("YOLO model warm-load attempted at startup")
except Exception as e:
    logger.warning(f"YOLO warm-load skipped: {e}")

logger.info("OptiCore Backend initialized v%s", settings.version)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level="info",
    )
