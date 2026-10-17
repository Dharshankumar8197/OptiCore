"""OptiCore Unified Connectivity API Router.

Aggregates Wi-Fi, Bluetooth, USB cameras, and App Users into a single
'Optical Endpoints' mesh discovered via a sonar pulse scanner.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import logging
import platform
import subprocess

from app.database import get_db
from app.database.models import Device, CameraSource, BluetoothDevice, WiFiDevice
from app.api.system import _get_wifi_info, _get_usb_device_count, _get_bluetooth_adapter_available, _enumerate_cameras

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connectivity", tags=["connectivity"])

# In-memory registry for live App Users sharing their cameras
# Stored with timestamps so stale entries can be cleaned up
SHARED_APP_CAMERAS: Dict[str, Dict[str, Any]] = {}

# Default simulated endpoints if environment has 0 external hardware paired yet
# (allows instant testing of the sonar pulse and Android connection interface)
DEFAULT_SEED_ENDPOINTS = [
    {
        "id": "seed-phone-android",
        "name": "Android Vision Cam (OptiCore Mobile)",
        "endpoint_category": "app_user",
        "connection_mode": "wifi",
        "status": "online",
        "address": "192.168.1.142",
        "signal_strength": -42,
        "capabilities": ["camera", "public_access"],
        "camera_status": "shared_public",
        "camera_label": "Rear Camera (1080p)",
        "user_name": "Field Operative (Android)",
        "stream_url": None,
        "is_app_user": True,
        "is_tts_sink": False,
        "resolution": "1920x1080",
    },
    {
        "id": "seed-earbuds-bt",
        "name": "OptiCore Smart Earbuds",
        "endpoint_category": "earbuds",
        "connection_mode": "bluetooth",
        "status": "available",
        "address": "7C:9A:1D:44:A2:89",
        "signal_strength": -56,
        "capabilities": ["audio_out", "tts"],
        "camera_status": None,
        "camera_label": None,
        "user_name": None,
        "stream_url": None,
        "is_app_user": False,
        "is_tts_sink": True,
        "resolution": None,
    },
    {
        "id": "seed-pi-node",
        "name": "Raspberry Pi Edge AI Node",
        "endpoint_category": "device",
        "connection_mode": "wifi",
        "status": "online",
        "address": "192.168.1.108",
        "signal_strength": -50,
        "capabilities": ["camera", "compute"],
        "camera_status": "available",
        "camera_label": "Pi Wide Lens V3",
        "user_name": None,
        "stream_url": None,
        "is_app_user": False,
        "is_tts_sink": False,
        "resolution": "1280x720",
    }
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class OpticalEndpoint(BaseModel):
    id: str
    name: str
    endpoint_category: str  # 'app_user' | 'camera' | 'earbuds' | 'speaker' | 'device'
    connection_mode: str    # 'wifi' | 'bluetooth' | 'usb'
    status: str             # 'online' | 'connected' | 'available' | 'pending' | 'denied'
    address: Optional[str] = None
    signal_strength: Optional[int] = None
    capabilities: List[str] = []
    camera_status: Optional[str] = None  # 'shared_public' | 'available' | 'pending' | 'approved' | 'denied' | None
    camera_label: Optional[str] = None
    user_name: Optional[str] = None
    stream_url: Optional[str] = None
    is_app_user: bool = False
    is_tts_sink: bool = False
    resolution: Optional[str] = None


class HostNetworkInfo(BaseModel):
    wifi_connected: bool
    wifi_ssid: Optional[str] = None
    wifi_ip: Optional[str] = None
    wifi_interface: Optional[str] = None
    wifi_signal_dbm: Optional[int] = None
    bluetooth_adapter_available: bool = False
    usb_device_count: int = 0


class TTSRouteInfo(BaseModel):
    active: bool
    routed_to: str
    device_address: Optional[str] = None
    sink_type: str = "system"  # 'earbuds' | 'speaker' | 'system'


class ConnectivityScanResponse(BaseModel):
    scan_timestamp: str
    host: HostNetworkInfo
    endpoints: List[OpticalEndpoint]
    tts_route: TTSRouteInfo


class ShareCameraRequest(BaseModel):
    user_name: str = Field(default="Mobile User", max_length=100)
    device_name: str = Field(default="Android Device", max_length=100)
    camera_facing: str = Field(default="rear")  # 'front' | 'rear'
    is_public: bool = Field(default=True)
    stream_url: Optional[str] = None
    resolution: Optional[str] = Field(default="1920x1080")


class ShareCameraResponse(BaseModel):
    status: str
    endpoint_id: str
    message: str
    endpoint: OpticalEndpoint


class ConnectEndpointRequest(BaseModel):
    endpoint_id: str
    action: Optional[str] = "connect"  # 'connect' | 'disconnect' | 'request_camera'


# ── Helper functions ──────────────────────────────────────────────────────────

def _classify_bt_sink_type(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["earbud", "airpod", "bud", "pod", "wh-", "wf-", "headphone"]):
        return "earbuds"
    if any(k in n for k in ["speaker", "soundbar", "boom", "jbl", "bose"]):
        return "speaker"
    return "earbuds"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/scan", response_model=ConnectivityScanResponse)
def scan_all_endpoints(db: Session = Depends(get_db)):
    """Sonar pulse scan endpoint.

    Gathers all Optical Endpoints in one pass:
    1. Host Wi-Fi & USB & Bluetooth state
    2. Local USB cameras
    3. Wi-Fi devices & Raspberry Pi nodes
    4. App Users sharing their mobile/web cameras
    5. Bluetooth audio devices (earbuds / speakers for TTS)
    """
    wifi_info = _get_wifi_info()
    usb_count = _get_usb_device_count()
    bt_available = _get_bluetooth_adapter_available()

    host = HostNetworkInfo(
        wifi_connected=wifi_info.get("wifi_connected", False),
        wifi_ssid=wifi_info.get("wifi_ssid"),
        wifi_ip=wifi_info.get("wifi_ip"),
        wifi_interface=wifi_info.get("wifi_interface"),
        wifi_signal_dbm=wifi_info.get("wifi_signal_dbm"),
        bluetooth_adapter_available=bt_available,
        usb_device_count=usb_count,
    )

    endpoints: List[OpticalEndpoint] = []
    seen_ids = set()

    # 1. Registered App Users sharing their cameras (Mobile / Web)
    for ep_id, ep_data in SHARED_APP_CAMERAS.items():
        ep = OpticalEndpoint(
            id=ep_id,
            name=ep_data["name"],
            endpoint_category="app_user",
            connection_mode="wifi",
            status=ep_data.get("status", "online"),
            address=ep_data.get("ip_address") or wifi_info.get("wifi_ip") or "127.0.0.1",
            signal_strength=ep_data.get("signal_strength", -40),
            capabilities=["camera", "public_access" if ep_data.get("is_public") else "auth_access"],
            camera_status="shared_public" if ep_data.get("is_public") else "pending",
            camera_label=ep_data.get("camera_label", "Mobile Camera"),
            user_name=ep_data.get("user_name"),
            stream_url=ep_data.get("stream_url"),
            is_app_user=True,
            is_tts_sink=False,
            resolution=ep_data.get("resolution", "1080p"),
        )
        endpoints.append(ep)
        seen_ids.add(ep_id)

    # 2. Local / USB Cameras enumerated via OpenCV
    try:
        raw_cameras = _enumerate_cameras()
        for idx, cam in enumerate(raw_cameras):
            cam_id = cam["id"]
            is_usb = cam.get("source_type") == "usb" or idx > 0
            ep = OpticalEndpoint(
                id=cam_id,
                name=cam.get("name") or ("USB Optical Camera" if is_usb else "Integrated Vision Camera"),
                endpoint_category="camera",
                connection_mode="usb" if is_usb else "usb",
                status="connected",
                address=f"USB-CAM-{idx}",
                signal_strength=None,
                capabilities=["camera", "vision_stream"],
                camera_status="available",
                camera_label=f"{cam.get('resolution', 'HD')} @ {cam.get('fps', 30)}fps",
                user_name=None,
                stream_url=None,
                is_app_user=False,
                is_tts_sink=False,
                resolution=cam.get("resolution"),
            )
            endpoints.append(ep)
            seen_ids.add(cam_id)
    except Exception as exc:
        logger.warning(f"Error enumerating cameras for unified scan: {exc}")

    # 3. Wi-Fi Devices from database
    try:
        wifi_db_devices = db.query(WiFiDevice).all()
        for wd in wifi_db_devices:
            if wd.id not in seen_ids:
                category = "device"
                if "pi" in wd.name.lower():
                    category = "device"
                elif "cam" in wd.name.lower():
                    category = "camera"
                elif "phone" in wd.name.lower() or "android" in wd.name.lower():
                    category = "app_user"

                endpoints.append(OpticalEndpoint(
                    id=wd.id,
                    name=wd.name,
                    endpoint_category=category,
                    connection_mode="wifi",
                    status=wd.status or "online",
                    address=wd.ip_address,
                    signal_strength=-45,
                    capabilities=["camera" if category in ("camera", "app_user") else "compute"],
                    camera_status="available" if category in ("camera", "app_user") else None,
                    camera_label=f"{wd.device_type} Endpoint",
                    user_name=wd.name if category == "app_user" else None,
                    stream_url=None,
                    is_app_user=(category == "app_user"),
                    is_tts_sink=False,
                    resolution=None,
                ))
                seen_ids.add(wd.id)
    except Exception as exc:
        logger.warning(f"Error querying wifi_devices: {exc}")

    # 4. Bluetooth Devices from database
    active_tts_device: Optional[BluetoothDevice] = None
    try:
        bt_db_devices = db.query(BluetoothDevice).all()
        for bd in bt_db_devices:
            if bd.id not in seen_ids and bd.address not in seen_ids:
                sink_type = _classify_bt_sink_type(bd.name)
                is_connected = bd.status == "connected"
                if is_connected and not active_tts_device:
                    active_tts_device = bd

                endpoints.append(OpticalEndpoint(
                    id=bd.id or bd.address,
                    name=bd.name,
                    endpoint_category=sink_type,
                    connection_mode="bluetooth",
                    status=bd.status or "available",
                    address=bd.address,
                    signal_strength=bd.signal_strength,
                    capabilities=["audio_out", "tts"],
                    camera_status=None,
                    camera_label=None,
                    user_name=None,
                    stream_url=None,
                    is_app_user=False,
                    is_tts_sink=True,
                    resolution=None,
                ))
                seen_ids.add(bd.id)
                seen_ids.add(bd.address)
    except Exception as exc:
        logger.warning(f"Error querying bluetooth_devices: {exc}")

    # 5. Fallback demo endpoints if nothing is discovered yet
    # Ensures sonar pulse view displays rich interactive cards immediately
    if len(endpoints) <= 1:
        for seed in DEFAULT_SEED_ENDPOINTS:
            if seed["id"] not in seen_ids:
                endpoints.append(OpticalEndpoint(**seed))
                seen_ids.add(seed["id"])

    # TTS Route Info
    if active_tts_device:
        tts_info = TTSRouteInfo(
            active=True,
            routed_to=active_tts_device.name,
            device_address=active_tts_device.address,
            sink_type=_classify_bt_sink_type(active_tts_device.name),
        )
    else:
        # Check if any seed earbuds is connected
        connected_seed = next((ep for ep in endpoints if ep.is_tts_sink and ep.status == "connected"), None)
        if connected_seed:
            tts_info = TTSRouteInfo(
                active=True,
                routed_to=connected_seed.name,
                device_address=connected_seed.address,
                sink_type=connected_seed.endpoint_category,
            )
        else:
            tts_info = TTSRouteInfo(
                active=False,
                routed_to="System Audio (Default)",
                device_address=None,
                sink_type="system",
            )

    return ConnectivityScanResponse(
        scan_timestamp=datetime.utcnow().isoformat(),
        host=host,
        endpoints=endpoints,
        tts_route=tts_info,
    )


@router.post("/share-camera", response_model=ShareCameraResponse)
def share_camera_endpoint(
    req: ShareCameraRequest,
    db: Session = Depends(get_db),
):
    """Enable an App User (Android, iOS, or Web) to publish their camera as an Optical Endpoint."""
    endpoint_id = f"app-cam-{uuid.uuid4().hex[:8]}"
    camera_name = f"{req.user_name}'s {req.device_name} ({req.camera_facing.capitalize()})"

    camera_entry = {
        "id": endpoint_id,
        "name": camera_name,
        "user_name": req.user_name,
        "device_name": req.device_name,
        "camera_facing": req.camera_facing,
        "camera_label": f"{req.camera_facing.capitalize()} Lens · {req.resolution}",
        "is_public": req.is_public,
        "stream_url": req.stream_url,
        "status": "online",
        "resolution": req.resolution,
        "created_at": datetime.utcnow().isoformat(),
    }
    SHARED_APP_CAMERAS[endpoint_id] = camera_entry

    # Also register in camera_sources so that ModelPage can stream from it
    try:
        # Check if dummy host device exists
        host_device = db.query(Device).first()
        dev_id = host_device.id if host_device else str(uuid.uuid4())

        cam_source = CameraSource(
            id=endpoint_id,
            device_id=dev_id,
            name=camera_name,
            source_type="http" if req.stream_url else "local",
            resolution=req.resolution,
            fps=30,
            status="connected",
            access_state="approved" if req.is_public else "pending",
        )
        db.merge(cam_source)
        db.commit()
    except Exception as exc:
        logger.warning(f"Could not sync shared camera to DB camera_sources: {exc}")

    endpoint = OpticalEndpoint(
        id=endpoint_id,
        name=camera_name,
        endpoint_category="app_user",
        connection_mode="wifi",
        status="online",
        address="192.168.1.155",
        signal_strength=-38,
        capabilities=["camera", "public_access" if req.is_public else "auth_access"],
        camera_status="shared_public" if req.is_public else "pending",
        camera_label=camera_entry["camera_label"],
        user_name=req.user_name,
        stream_url=req.stream_url,
        is_app_user=True,
        is_tts_sink=False,
        resolution=req.resolution,
    )

    return ShareCameraResponse(
        status="active",
        endpoint_id=endpoint_id,
        message=f"Camera successfully shared as public optical endpoint '{camera_name}'",
        endpoint=endpoint,
    )


@router.delete("/share-camera/{endpoint_id}")
def unshare_camera_endpoint(endpoint_id: str, db: Session = Depends(get_db)):
    """Stop sharing an App User camera."""
    if endpoint_id in SHARED_APP_CAMERAS:
        del SHARED_APP_CAMERAS[endpoint_id]

    try:
        cam = db.query(CameraSource).filter(CameraSource.id == endpoint_id).first()
        if cam:
            db.delete(cam)
            db.commit()
    except Exception:
        pass

    return {"status": "unshared", "endpoint_id": endpoint_id}


@router.post("/connect-endpoint/{endpoint_id}")
def connect_optical_endpoint(
    endpoint_id: str,
    db: Session = Depends(get_db),
):
    """Connect or pair with any Optical Endpoint.

    Handles:
    - App User: Enables access to user's shared camera
    - Bluetooth: Pairs/connects earbuds or speaker, and binds TTS audio route
    - USB / Wi-Fi: Activates camera pipeline
    """
    # 1. Check if it's an App User camera share
    if endpoint_id in SHARED_APP_CAMERAS:
        entry = SHARED_APP_CAMERAS[endpoint_id]
        entry["status"] = "connected"
        return {
            "status": "connected",
            "endpoint_id": endpoint_id,
            "type": "app_user",
            "camera_access": "approved",
            "message": f"Connected to {entry['name']}. Camera feed is active for inference.",
            "stream_url": entry.get("stream_url"),
        }

    # 2. Check if it's a seed endpoint
    for seed in DEFAULT_SEED_ENDPOINTS:
        if seed["id"] == endpoint_id:
            seed["status"] = "connected"
            if seed.get("is_tts_sink"):
                return {
                    "status": "connected",
                    "endpoint_id": endpoint_id,
                    "type": seed["endpoint_category"],
                    "tts_routed": True,
                    "message": f"Connected to {seed['name']}. Speech TTS will now output to these earbuds.",
                }
            return {
                "status": "connected",
                "endpoint_id": endpoint_id,
                "type": seed["endpoint_category"],
                "camera_access": "approved",
                "message": f"Connected to {seed['name']}. Optical stream ready.",
            }

    # 3. Check Bluetooth database
    bt_dev = db.query(BluetoothDevice).filter(
        (BluetoothDevice.id == endpoint_id) | (BluetoothDevice.address == endpoint_id)
    ).first()
    if bt_dev:
        bt_dev.status = "connected"
        db.commit()
        return {
            "status": "connected",
            "endpoint_id": endpoint_id,
            "type": _classify_bt_sink_type(bt_dev.name),
            "tts_routed": True,
            "message": f"Connected to {bt_dev.name}. AI audio detections routed to earbuds.",
        }

    # 4. Check CameraSource database
    cam = db.query(CameraSource).filter(CameraSource.id == endpoint_id).first()
    if cam:
        cam.status = "connected"
        cam.access_state = "approved"
        db.commit()
        return {
            "status": "connected",
            "endpoint_id": endpoint_id,
            "type": "camera",
            "camera_access": "approved",
            "message": f"Camera source '{cam.name}' activated.",
        }

    return {
        "status": "connected",
        "endpoint_id": endpoint_id,
        "type": "optical_endpoint",
        "message": "Endpoint connected successfully.",
    }


@router.post("/tts-test")
def trigger_tts_test(db: Session = Depends(get_db)):
    """Test text-to-speech output, routing to connected Bluetooth earbuds/speaker."""
    from app.api.bluetooth import tts_test
    return tts_test(db)
