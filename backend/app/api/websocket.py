"""WebSocket inference stream endpoint."""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/inference")
async def inference_websocket(websocket: WebSocket):
    """Stream real-time inference metrics to the frontend.

    - When inference is running: emit full metrics JSON at ~1 Hz
    - When inference is idle:   emit {running: false} keepalive every 5 s
    """
    await websocket.accept()
    logger.info("WebSocket client connected: %s", websocket.client)

    try:
        from app.inference import inference_state, get_model
    except ImportError:
        # Module not ready yet — send idle and close
        await websocket.send_text(json.dumps({"running": False}))
        return

    try:
        while True:
            state = inference_state

            if state.running:
                payload = {
                    "running": True,
                    "fps": round(state.fps, 1),
                    "latency": round(state.latency_ms, 1),
                    "detection_count": state.detection_count,
                    "confidence_threshold": state.confidence,
                    "iou_threshold": state.iou,
                }
                await websocket.send_text(json.dumps(payload))
                await asyncio.sleep(1.0)          # ≥1 Hz while running
            else:
                await websocket.send_text(json.dumps({"running": False}))
                await asyncio.sleep(5.0)          # keepalive every 5 s

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", websocket.client)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
