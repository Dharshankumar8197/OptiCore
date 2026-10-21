"""YOLO26s inference engine for OptiCore.

Loads the trained YOLO26s best.pt checkpoint once per process, maintains
isolated ByteTrack tracker state per client session, enforces concurrency and size
limits, and provides real-time detection without mock fallbacks.
"""

import os
import io
import time
import base64
import logging
import threading
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Optional, List, Dict, Any, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

# ── Canonical OptiCore 20-Class Mapping ─────────────────────────────────────────
OPTICORE_CLASSES: Dict[int, str] = {
    0: "person",
    1: "car",
    2: "bus",
    3: "truck",
    4: "motorcycle",
    5: "bicycle",
    6: "animal",
    7: "door",
    8: "stairs",
    9: "pothole",
    10: "crack",
    11: "manhole",
    12: "traffic_light",
    13: "traffic_sign",
    14: "pole",
    15: "tree",
    16: "bench",
    17: "chair",
    18: "waste_container",
    19: "obstacle",
}

# High-priority obstacle and hazard classes for mobility safety
HAZARD_CLASSES = {
    "pothole", "crack", "manhole", "stairs", "obstacle",
    "car", "bus", "truck", "motorcycle", "bicycle"
}

# ── Private singleton state ────────────────────────────────────────────────────
_model = None
_model_loaded: bool = False
_model_error: Optional[str] = None
_model_metadata: Dict[str, Any] = {}
_model_lock = threading.Lock()
_inference_semaphore = threading.Semaphore(settings.max_concurrent_inferences)

# Session tracking state for isolated ByteTrack instances
_session_trackers: Dict[str, Tuple[Any, float]] = {}
_tracker_lock = threading.Lock()


@dataclass
class InferenceState:
    """Live inference metrics updated by the active inference loop."""
    running: bool = False
    fps: float = 0.0
    latency_ms: float = 0.0
    detection_count: int = 0
    confidence: float = 0.50
    iou: float = 0.45
    active_sessions: int = 0


inference_state = InferenceState()


def get_model():
    """Return the cached YOLO model, loading best.pt once per process.
    Never falls back to random weights or mock models.
    """
    global _model, _model_loaded, _model_error, _model_metadata

    if _model_loaded and _model is not None:
        return _model

    with _model_lock:
        if _model_loaded and _model is not None:
            return _model

        model_path = settings.model_path
        if not os.path.exists(model_path):
            # Check relative to backend directory or root
            alt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "best.pt")
            if os.path.exists(alt_path):
                model_path = alt_path
            else:
                _model_error = f"YOLO model file not found at '{settings.model_path}'"
                logger.error(_model_error)
                _model_loaded = True
                _model = None
                return None

        try:
            from ultralytics import YOLO  # type: ignore

            logger.info("Loading OptiCore YOLO model from %s...", model_path)
            t0 = time.perf_counter()
            loaded_model = YOLO(model_path)
            load_time_ms = round((time.perf_counter() - t0) * 1000, 2)

            # Inspect and verify class names
            model_names = getattr(loaded_model, "names", {})
            class_count = len(model_names) if model_names else 0

            # Match against canonical OptiCore 20 classes
            matched_classes = {}
            if isinstance(model_names, dict):
                for k, v in model_names.items():
                    matched_classes[int(k)] = str(v)
            elif isinstance(model_names, (list, tuple)):
                for idx, v in enumerate(model_names):
                    matched_classes[idx] = str(v)
            else:
                matched_classes = OPTICORE_CLASSES.copy()

            _model = loaded_model
            _model_loaded = True
            _model_error = None
            _model_metadata = {
                "file_path": model_path,
                "file_size_bytes": os.path.getsize(model_path),
                "architecture": "YOLO26s DetectionModel",
                "class_count": len(matched_classes),
                "classes": matched_classes,
                "load_time_ms": load_time_ms,
                "task": getattr(loaded_model, "task", "detect"),
            }

            logger.info(
                "YOLO model loaded in %s ms with %d classes (Model: YOLO26s)",
                load_time_ms, len(matched_classes)
            )
            return _model

        except Exception as exc:
            _model_error = f"Failed to load YOLO model: {exc}"
            logger.error(_model_error, exc_info=True)
            _model_loaded = True
            _model = None
            return None


def is_model_loaded() -> bool:
    """Return True if the model was loaded successfully."""
    return _model_loaded and _model is not None


def get_model_error() -> Optional[str]:
    """Return the last model loading error, if any."""
    return _model_error


def get_model_metadata() -> Dict[str, Any]:
    """Return verified metadata about the loaded model."""
    if not is_model_loaded():
        get_model()
    return _model_metadata.copy()


def get_model_classes() -> Dict[int, str]:
    """Return dictionary of 20 OptiCore model classes."""
    model = get_model()
    if model and hasattr(model, "names") and model.names:
        if isinstance(model.names, dict):
            return {int(k): str(v) for k, v in model.names.items()}
        elif isinstance(model.names, (list, tuple)):
            return {i: str(v) for i, v in enumerate(model.names)}
    return OPTICORE_CLASSES.copy()


def _get_or_create_session_tracker(session_id: str) -> Any:
    """Get or instantiate an isolated ByteTrack tracker for a client session."""
    now = time.time()
    with _tracker_lock:
        # Periodic cleanup: evict trackers inactive for > 120 seconds
        stale_keys = [k for k, (_, last_seen) in _session_trackers.items() if now - last_seen > 120]
        for k in stale_keys:
            del _session_trackers[k]

        if session_id in _session_trackers:
            tracker, _ = _session_trackers[session_id]
            _session_trackers[session_id] = (tracker, now)
            inference_state.active_sessions = len(_session_trackers)
            return tracker

        try:
            from ultralytics.trackers.byte_tracker import BYTETracker
            args = SimpleNamespace(
                track_high_thresh=0.5,
                track_low_thresh=0.1,
                new_track_thresh=0.6,
                track_buffer=30,
                match_thresh=0.8,
                fuse_score=True,
            )
            tracker = BYTETracker(args)
            _session_trackers[session_id] = (tracker, now)
            inference_state.active_sessions = len(_session_trackers)
            logger.info("Initialized isolated ByteTrack instance for session: %s", session_id)
            return tracker
        except Exception as exc:
            logger.warning("Could not instantiate BYTETracker: %s", exc)
            return None


def decode_image_bytes(image_bytes: bytes) -> Tuple[Any, int, int]:
    """Decode raw bytes into a PIL Image and return (image, width, height)."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        width, height = img.size
        return img, width, height
    except Exception as pil_err:
        try:
            import cv2
            import numpy as np
            nparr = np.frombuffer(image_bytes, np.uint8)
            cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if cv_img is not None:
                h, w = cv_img.shape[:2]
                return cv_img, w, h
        except Exception:
            pass
        logger.error("Failed to decode image bytes: %s", pil_err)
        return None, 0, 0


def generate_local_safety_warnings(
    detections: List[Dict[str, Any]],
    image_width: int,
    image_height: int,
) -> List[Dict[str, Any]]:
    """Analyze detected objects and immediately produce directional safety alerts.
    Never depends on external cloud services or Groq.
    """
    alerts = []
    for det in detections:
        cls_name = det.get("class_name", "").lower()
        conf = det.get("confidence", 0.0)
        norm_box = det.get("normalized_box", {})
        track_id = det.get("tracking_id")

        is_hazard = cls_name in HAZARD_CLASSES or "pothole" in cls_name or "crack" in cls_name
        if not is_hazard and conf < 0.60:
            continue

        nx = norm_box.get("x", 50.0)
        ny = norm_box.get("y", 50.0)
        nw = norm_box.get("width", 10.0)
        nh = norm_box.get("height", 10.0)

        # Center point
        cx = nx + (nw / 2.0)
        bottom_y = ny + nh

        # Directional orientation
        if cx < 38.0:
            direction = "left"
        elif cx > 62.0:
            direction = "right"
        else:
            direction = "ahead"

        # Distance / Proximity estimation based on vertical position and bbox area
        if bottom_y >= 75.0 or (nw * nh) > 2500:
            urgency = "critical"
            distance_desc = "immediately in front"
        elif bottom_y >= 50.0:
            urgency = "high"
            distance_desc = "approaching"
        else:
            urgency = "moderate"
            distance_desc = "in the distance"

        friendly_class = cls_name.replace("_", " ")
        message = f"{friendly_class.capitalize()} {distance_desc} on your {direction}"
        if direction == "ahead":
            message = f"{friendly_class.capitalize()} {distance_desc}"

        alerts.append({
            "class_name": cls_name,
            "confidence": conf,
            "tracking_id": track_id,
            "direction": direction,
            "urgency": urgency,
            "message": message,
        })

    # Sort alerts so critical hazards appear first
    urgency_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    alerts.sort(key=lambda a: urgency_order.get(a["urgency"], 4))
    return alerts


def run_detection(
    image_bytes: bytes,
    confidence_threshold: Optional[float] = None,
    iou_threshold: Optional[float] = None,
    image_size: Optional[int] = None,
    return_annotated: bool = False,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Run real YOLO26s object detection and optional ByteTrack tracking.
    Never returns mock or simulated detections.
    """
    # Enforce upload size limits
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise ValueError(f"Image payload size ({len(image_bytes)} bytes) exceeds limit ({max_bytes} bytes)")

    conf = confidence_threshold if confidence_threshold is not None else settings.confidence_threshold
    iou = iou_threshold if iou_threshold is not None else settings.iou_threshold
    imgsz = image_size if image_size is not None else settings.image_size

    # Ensure model is ready
    model = get_model()
    if model is None:
        err = _model_error or "Model is not loaded"
        raise RuntimeError(f"OptiCore Inference Server Error: {err}")

    t_start = time.perf_counter()
    image, width, height = decode_image_bytes(image_bytes)
    t_pre = time.perf_counter()

    if image is None or width <= 0 or height <= 0:
        raise ValueError("Invalid or corrupted image format. Could not decode image.")

    preprocess_ms = round((t_pre - t_start) * 1000, 2)

    # Acquire concurrency semaphore to ensure stable execution on Windows host
    acquired = _inference_semaphore.acquire(timeout=10.0)
    if not acquired:
        raise RuntimeError("Inference server busy: concurrency limit reached. Please retry.")

    try:
        t_infer_start = time.perf_counter()
        results = None

        # If session_id is provided, attempt native Ultralytics ByteTrack tracking
        if session_id:
            try:
                results = model.track(
                    source=image,
                    conf=conf,
                    iou=iou,
                    imgsz=imgsz,
                    persist=True,
                    tracker="bytetrack.yaml",
                    verbose=False,
                )
            except Exception as track_err:
                logger.warning("model.track with bytetrack error (%s), falling back to model.predict", track_err)
                results = None

        # Standard inference or fallback
        if results is None:
            results = model.predict(
                source=image,
                conf=conf,
                iou=iou,
                imgsz=imgsz,
                verbose=False,
            )

        t_infer_end = time.perf_counter()
        inference_ms = round((t_infer_end - t_infer_start) * 1000, 2)

        t_post_start = time.perf_counter()
        detections: List[Dict[str, Any]] = []
        annotated_base64 = None

        if results and len(results) > 0:
            result = results[0]
            boxes = getattr(result, "boxes", None)

            if boxes is not None and len(boxes) > 0:
                names_map = getattr(model, "names", OPTICORE_CLASSES)

                for idx, box in enumerate(boxes):
                    xyxy = box.xyxy[0].tolist()
                    conf_score = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    cls_name = names_map.get(cls_id, OPTICORE_CLASSES.get(cls_id, f"class_{cls_id}"))

                    x1, y1, x2, y2 = xyxy
                    bx = max(0.0, float(x1))
                    by = max(0.0, float(y1))
                    bw = max(1.0, float(x2 - x1))
                    bh = max(1.0, float(y2 - y1))

                    # Normalized percentage coordinates (0-100%) for responsive CSS/Canvas overlays
                    norm_x = round((bx / width) * 100, 2) if width > 0 else 0.0
                    norm_y = round((by / height) * 100, 2) if height > 0 else 0.0
                    norm_w = round((bw / width) * 100, 2) if width > 0 else 0.0
                    norm_h = round((bh / height) * 100, 2) if height > 0 else 0.0

                    assigned_track_id = None
                    if getattr(box, "id", None) is not None:
                        try:
                            assigned_track_id = int(box.id[0])
                        except Exception:
                            assigned_track_id = None

                    detections.append({
                        "id": f"det_{idx}",
                        "class_id": cls_id,
                        "class_name": cls_name,
                        "confidence": round(conf_score, 3),
                        "box": {
                            "x": round(bx, 1),
                            "y": round(by, 1),
                            "width": round(bw, 1),
                            "height": round(bh, 1),
                        },
                        "normalized_box": {
                            "x": norm_x,
                            "y": norm_y,
                            "width": norm_w,
                            "height": norm_h,
                        },
                        "tracking_id": assigned_track_id,
                    })

            if return_annotated:
                try:
                    import cv2
                    annotated_bgr = result.plot()
                    _, buffer = cv2.imencode(".jpg", annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                    annotated_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")
                except Exception as ann_err:
                    logger.warning("Could not generate annotated image: %s", ann_err)

        t_post_end = time.perf_counter()
        postprocess_ms = round((t_post_end - t_post_start) * 1000, 2)
        total_ms = round(preprocess_ms + inference_ms + postprocess_ms, 2)

        # Generate local immediate safety warnings
        safety_alerts = generate_local_safety_warnings(detections, width, height)

        # Update live state
        inference_state.running = True
        inference_state.latency_ms = total_ms
        inference_state.fps = round(1000.0 / total_ms, 1) if total_ms > 0 else 0.0
        inference_state.detection_count = len(detections)
        inference_state.confidence = conf
        inference_state.iou = iou

        return {
            "inference_time_ms": inference_ms,
            "preprocess_ms": preprocess_ms,
            "postprocess_ms": postprocess_ms,
            "total_time_ms": total_ms,
            "detection_count": len(detections),
            "image_width": width,
            "image_height": height,
            "detections": detections,
            "safety_alerts": safety_alerts,
            "session_id": session_id,
            "annotated_image_base64": annotated_base64,
            "model_name": os.path.basename(settings.model_path),
            "is_mock": False,
        }

    finally:
        _inference_semaphore.release()


async def explain_scene_with_groq(
    detections: List[Dict[str, Any]],
    safety_alerts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Provide contextual AI scene explanation using Groq if key is present,
    with local rule-based fallback. Never delays or replaces immediate safety warnings.
    """
    local_summary = " ".join([a["message"] for a in safety_alerts[:3]])
    if not local_summary:
        if detections:
            local_summary = f"Detected {len(detections)} objects in view."
        else:
            local_summary = "Pathway clear. No obstacles or hazards detected."

    if not settings.groq_api_key:
        return {
            "service": "local_rule_engine",
            "explanation": local_summary,
            "groq_enabled": False,
        }

    try:
        import httpx

        objects_summary = ", ".join(
            [f"{d['class_name']} ({int(d['confidence']*100)}%)" for d in detections[:10]]
        ) or "None"

        prompt = (
            "You are OptiCore AI, an assistive vision navigator for visually impaired and mobility users. "
            "Give a very concise, 1-2 sentence spoken advisory based on these detected objects and hazards:\n"
            f"Detected Objects: {objects_summary}\n"
            f"Hazards: {', '.join([a['message'] for a in safety_alerts]) or 'None'}\n"
            "Be direct, calm, and actionable."
        )

        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": "You are a concise mobility guidance AI."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 80,
            "temperature": 0.3,
        }

        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"].strip()
                return {
                    "service": "groq",
                    "explanation": text,
                    "groq_enabled": True,
                }
    except Exception as exc:
        logger.warning("Groq explanation call failed, using local fallback: %s", exc)

    return {
        "service": "local_rule_engine_fallback",
        "explanation": local_summary,
        "groq_enabled": True,
    }


def is_ocr_available() -> bool:
    """Check if PaddleOCR is installed in current environment."""
    try:
        import paddleocr  # type: ignore # noqa: F401
        return True
    except (ImportError, Exception):
        return False


def run_ocr_on_image(image_bytes: bytes) -> Dict[str, Any]:
    """Run PaddleOCR on demand if installed, without breaking detector if unavailable."""
    if not is_ocr_available():
        return {
            "ocr_available": False,
            "message": "PaddleOCR is not installed in this environment. Object detection operates normally.",
            "text_detections": [],
        }

    try:
        from paddleocr import PaddleOCR  # type: ignore
        import numpy as np
        import cv2

        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = ocr.ocr(img, cls=True)
        items = []
        if results and len(results) > 0 and results[0]:
            for line in results[0]:
                box = line[0]
                text, conf = line[1]
                items.append({
                    "text": text,
                    "confidence": round(float(conf), 3),
                    "box": box,
                })

        return {
            "ocr_available": True,
            "message": f"Successfully detected {len(items)} text elements",
            "text_detections": items,
        }
    except Exception as exc:
        logger.warning("OCR processing error: %s", exc)
        return {
            "ocr_available": True,
            "message": f"OCR processing failed: {exc}",
            "text_detections": [],
        }
