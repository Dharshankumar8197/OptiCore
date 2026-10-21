"""Model management and inference API routes."""

import os
import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import User, Model, ModelConfig, InferenceSession
from app.auth.dependencies import get_current_active_user
from app.schemas.model import (
    ModelResponse,
    ModelConfigResponse,
    ModelConfigUpdate,
    InferenceSessionResponse,
    DetectResponse,
    DetectBase64Request,
    ModelClassesResponse,
    TrackRequest,
    ExplainRequest,
    ExplainResponse,
    OCRResponse,
)
from app.config import settings
from app.inference import (
    run_detection,
    get_model_classes,
    is_model_loaded,
    get_model,
    get_model_metadata,
    get_model_error,
    explain_scene_with_groq,
    run_ocr_on_image,
)

router = APIRouter(prefix="/api/model", tags=["model"])


import uuid


def get_or_create_default_model(db: Session) -> Optional[Model]:
    """Get or create the default best.pt model."""
    existing = db.query(Model).filter(Model.file_name == "best.pt").first()
    if existing:
        return existing

    model_path = os.path.join(settings.model_path)
    if not os.path.exists(model_path):
        return None

    classes = get_model_classes()
    class_count = len(classes) if classes else 80

    model_id = str(uuid.uuid4())
    model = Model(
        id=model_id,
        name="OptiCore YOLO",
        version="v1",
        file_name="best.pt",
        framework="Ultralytics",
        task="object_detection",
        class_count=class_count,
        status="available",
    )
    db.add(model)
    db.flush()

    config = ModelConfig(
        id=str(uuid.uuid4()),
        model_id=model_id,
        confidence_threshold=settings.confidence_threshold,
        iou_threshold=settings.iou_threshold,
        image_size=settings.image_size,
    )
    db.add(config)
    db.commit()
    db.refresh(model)

    return model


@router.get("", response_model=Optional[ModelResponse])
def get_model_status(db: Session = Depends(get_db)):
    """Get the current model status and metadata."""
    model = get_or_create_default_model(db)
    if not model:
        return None
    return model


@router.get("/classes", response_model=ModelClassesResponse)
def get_classes():
    """Get list of object classes recognizable by the loaded model."""
    classes = get_model_classes()
    return ModelClassesResponse(
        class_count=len(classes),
        classes=classes,
        model_file=os.path.basename(settings.model_path),
        framework="Ultralytics YOLOv8",
    )


@router.get("/config", response_model=Optional[ModelConfigResponse])
def get_model_config(db: Session = Depends(get_db)):
    """Get current model inference configuration."""
    model = get_or_create_default_model(db)
    if not model:
        return ModelConfigResponse(
            confidence_threshold=settings.confidence_threshold,
            iou_threshold=settings.iou_threshold,
            image_size=settings.image_size,
        )

    config = db.query(ModelConfig).filter(ModelConfig.model_id == model.id).first()
    if not config:
        return ModelConfigResponse(
            confidence_threshold=settings.confidence_threshold,
            iou_threshold=settings.iou_threshold,
            image_size=settings.image_size,
        )

    return config


@router.put("/config", response_model=ModelConfigResponse)
def update_model_config(
    config_update: ModelConfigUpdate,
    db: Session = Depends(get_db),
):
    """Update model inference configuration (thresholds, image size)."""
    model = get_or_create_default_model(db)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )

    config = db.query(ModelConfig).filter(ModelConfig.model_id == model.id).first()
    if not config:
        config = ModelConfig(model_id=model.id)
        db.add(config)

    if config_update.confidence_threshold is not None:
        config.confidence_threshold = config_update.confidence_threshold
    if config_update.iou_threshold is not None:
        config.iou_threshold = config_update.iou_threshold
    if config_update.image_size is not None:
        config.image_size = config_update.image_size

    db.commit()
    db.refresh(config)
    return config


@router.get("/health")
def get_model_health():
    """Get model readiness and hardware acceleration status."""
    loaded = is_model_loaded()
    meta = get_model_metadata()
    error = get_model_error()
    return {
        "status": "ready" if loaded else "degraded",
        "model_loaded": loaded,
        "model_path": settings.model_path,
        "architecture": meta.get("architecture", "YOLO26s DetectionModel"),
        "class_count": meta.get("class_count", 20),
        "task": meta.get("task", "detect"),
        "error": error,
        "classes_verified": loaded and meta.get("class_count") == 20,
    }


@router.post("/detect", response_model=DetectResponse)
async def detect_from_file(
    file: UploadFile = File(...),
    confidence_threshold: Optional[float] = Form(None),
    iou_threshold: Optional[float] = Form(None),
    image_size: Optional[int] = Form(None),
    return_annotated: Optional[bool] = Form(False),
    session_id: Optional[str] = Form(None),
):
    """Run object detection and optional ByteTrack tracking on an uploaded image file."""
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty image file received")

        result = run_detection(
            image_bytes=contents,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold,
            image_size=image_size,
            return_annotated=return_annotated or False,
            session_id=session_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


@router.post("/detect/base64", response_model=DetectResponse)
async def detect_from_base64(payload: DetectBase64Request):
    """Run object detection on a base64 encoded image frame (from camera canvas)."""
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(raw_b64)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")

        result = run_detection(
            image_bytes=image_bytes,
            confidence_threshold=payload.confidence_threshold,
            iou_threshold=payload.iou_threshold,
            image_size=payload.image_size,
            return_annotated=payload.return_annotated or False,
            session_id=payload.session_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


@router.post("/track", response_model=DetectResponse)
async def track_video_frame(payload: TrackRequest):
    """Run ByteTrack tracking on an incoming video frame with isolated session tracking."""
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(raw_b64)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")

        result = run_detection(
            image_bytes=image_bytes,
            confidence_threshold=payload.confidence_threshold,
            iou_threshold=payload.iou_threshold,
            image_size=payload.image_size,
            session_id=payload.session_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tracking error: {str(e)}")


@router.post("/explain", response_model=ExplainResponse)
async def explain_detections(payload: ExplainRequest):
    """Generate contextual guidance for detections using Groq or local rule engine."""
    try:
        det_dicts = [d.model_dump() for d in payload.detections]
        alert_dicts = [a.model_dump() for a in payload.safety_alerts] if payload.safety_alerts else []
        res = await explain_scene_with_groq(det_dicts, alert_dicts)
        return ExplainResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation error: {str(e)}")


@router.post("/ocr", response_model=OCRResponse)
async def run_ocr_endpoint(file: UploadFile = File(...)):
    """Run on-demand PaddleOCR if available, returning graceful notice if not installed."""
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty image file received")
        res = run_ocr_on_image(contents)
        return OCRResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR error: {str(e)}")


@router.get("/sessions", response_model=List[InferenceSessionResponse])
def list_inference_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    limit: int = 10,
):
    """List recent inference sessions for the user."""
    sessions = (
        db.query(InferenceSession)
        .filter(InferenceSession.user_id == current_user.id)
        .order_by(InferenceSession.started_at.desc())
        .limit(limit)
        .all()
    )
    return sessions

