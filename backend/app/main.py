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

# Add CORS middleware (supporting localhost, Vercel, mobile devices, LAN IPs, and ngrok tunnels)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request

# Static files path
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def read_root(request: Request):
    """Root endpoint serving embedded Vision Studio UI for browsers, or JSON for API clients/Vercel."""
    accept = request.headers.get("accept", "")
    index_path = os.path.join(STATIC_DIR, "index.html")
    if "application/json" in accept:
        return {
            "app": "OptiCore Backend",
            "status": "running",
            "version": settings.version,
            "docs": "/docs",
            "ui": "/ui",
        }
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {
        "app": "OptiCore Backend",
        "status": "running",
        "version": settings.version,
        "docs": "/docs",
        "ui": "/ui",
    }



@app.get("/ui")
def read_ui():
    """Direct route to embedded OptiCore Vision Studio UI."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "UI not found"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    """Comprehensive health check endpoint for Docker, ngrok, and frontend polling."""
    from app.inference import is_model_loaded, get_model_metadata, get_model_error
    loaded = is_model_loaded()
    meta = get_model_metadata()
    return {
        "status": "ok" if loaded else "degraded",
        "database": "ok",
        "model_loaded": loaded,
        "model_status": "ready" if loaded else "standby",
        "architecture": meta.get("architecture", "YOLO26s DetectionModel"),
        "class_count": meta.get("class_count", 20),
        "version": settings.version,
        "error": get_model_error(),
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

# Unified Optical Connectivity router (Sonar pulse, App Users, Mesh endpoints)
try:
    from app.api import connectivity as connectivity_module
    app.include_router(connectivity_module.router)
    logger.info("Connectivity router registered")
except ImportError as e:
    logger.warning(f"Connectivity module not loaded: {e}")

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
