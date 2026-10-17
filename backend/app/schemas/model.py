"""Model and inference schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ModelResponse(BaseModel):
    """Model response."""

    id: str
    name: str
    version: str
    file_name: str
    framework: str
    task: str
    class_count: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ModelConfigResponse(BaseModel):
    """Model configuration response."""

    confidence_threshold: float
    iou_threshold: float
    image_size: int


class ModelConfigUpdate(BaseModel):
    """Update model configuration."""

    confidence_threshold: Optional[float] = Field(None, ge=0, le=1)
    iou_threshold: Optional[float] = Field(None, ge=0, le=1)
    image_size: Optional[int] = Field(None, ge=320, le=1280)


class BoxCoordinates(BaseModel):
    """Bounding box pixel coordinates."""
    x: float
    y: float
    width: float
    height: float


class NormalizedBox(BaseModel):
    """Bounding box percentage coordinates (0-100%)."""
    x: float
    y: float
    width: float
    height: float


class DetectionItem(BaseModel):
    """Single object detection."""
    id: str
    class_id: int
    class_name: str
    confidence: float
    box: BoxCoordinates
    normalized_box: NormalizedBox
    tracking_id: Optional[int] = None


class DetectBase64Request(BaseModel):
    """Request payload for base64 image inference."""
    image_base64: str
    confidence_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None
    image_size: Optional[int] = None
    return_annotated: Optional[bool] = False


class DetectResponse(BaseModel):
    """Comprehensive detection response with latency breakdowns and HUD metrics."""
    inference_time_ms: float
    preprocess_ms: float
    postprocess_ms: float
    total_time_ms: float
    detection_count: int
    image_width: int
    image_height: int
    detections: List[DetectionItem]
    annotated_image_base64: Optional[str] = None
    model_name: str
    is_mock: bool = False


class ModelClassesResponse(BaseModel):
    """Classes recognized by the loaded model."""
    class_count: int
    classes: Dict[int, str]
    model_file: str
    framework: str


class DetectionResponse(BaseModel):
    """Detection result (legacy compatibility)."""

    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float
    tracking_id: Optional[int] = None


class InferenceResultResponse(BaseModel):
    """Inference result response."""

    inference_session_id: str
    detections: List[DetectionResponse]
    fps: float
    latency_ms: float
    frame_count: int


class InferenceSessionResponse(BaseModel):
    """Inference session response."""

    id: str
    user_id: str
    device_id: Optional[str]
    model_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    average_fps: Optional[float]
    average_latency_ms: Optional[float]
    frames_processed: int
    frames_dropped: int

    class Config:
        from_attributes = True
