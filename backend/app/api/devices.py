"""Device management API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.database.models import User, Device, CameraSource
from app.auth.dependencies import get_current_active_user
from app.schemas.device import (
    DeviceCreate,
    DeviceResponse,
    CameraSourceCreate,
    CameraSourceResponse,
)

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=List[DeviceResponse])
def list_devices(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all user's devices."""
    devices = db.query(Device).filter(Device.user_id == current_user.id).all()
    return devices


@router.post("", response_model=DeviceResponse)
def create_device(
    device_create: DeviceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Register a new device."""
    # Check if device already exists
    existing = db.query(Device).filter(Device.device_id == device_create.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Device already registered",
        )

    device = Device(
        device_id=device_create.device_id,
        user_id=current_user.id,
        name=device_create.name,
        device_type=device_create.device_type,
        connection_type=device_create.connection_type,
        ip_address=device_create.ip_address,
        mac_address=device_create.mac_address,
        status="online",
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get device details."""
    device = db.query(Device).filter(
        Device.device_id == device_id,
        Device.user_id == current_user.id,
    ).first()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return device


@router.get("/{device_id}/cameras", response_model=List[CameraSourceResponse])
def list_cameras(
    device_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List cameras for a device."""
    device = db.query(Device).filter(
        Device.device_id == device_id,
        Device.user_id == current_user.id,
    ).first()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    cameras = db.query(CameraSource).filter(CameraSource.device_id == device.id).all()
    return cameras


@router.post("/{device_id}/cameras", response_model=CameraSourceResponse)
def create_camera(
    device_id: str,
    camera_create: CameraSourceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Add a camera source to a device."""
    device = db.query(Device).filter(
        Device.device_id == device_id,
        Device.user_id == current_user.id,
    ).first()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    camera = CameraSource(
        device_id=device.id,
        name=camera_create.name,
        source_type=camera_create.source_type,
        resolution=camera_create.resolution,
        fps=camera_create.fps,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


# ── Camera access authorization ───────────────────────────────────────────────

@router.post("/cameras/{camera_source_id}/request-access")
def request_camera_access(
    camera_source_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Request camera access from a remote Wi-Fi device.

    Sets the camera_source.access_state to 'pending' and returns that status.
    The actual approval/denial comes back via the /ws/inference WebSocket channel
    when the remote device responds.
    """
    camera = db.query(CameraSource).filter(CameraSource.id == camera_source_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera source not found",
        )

    camera.access_state = "pending"
    db.commit()

    # TODO: relay request to remote device WebSocket when connection manager is implemented
    return {"status": "pending", "camera_source_id": camera_source_id}


@router.post("/cameras/{camera_source_id}/approve-access")
def approve_camera_access(
    camera_source_id: str,
    approved: bool = True,
    db: Session = Depends(get_db),
):
    """Remote device approves or denies a camera access request.

    In production this would be called by the remote OptiCore device.
    """
    camera = db.query(CameraSource).filter(CameraSource.id == camera_source_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera source not found",
        )

    camera.access_state = "approved" if approved else "denied"
    db.commit()
    return {"status": camera.access_state, "camera_source_id": camera_source_id}
