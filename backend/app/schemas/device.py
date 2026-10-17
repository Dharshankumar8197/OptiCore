"""Device schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DeviceCreate(BaseModel):
    """Create device request."""

    device_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=255)
    device_type: str = Field(...)  # mobile, camera, pi, sensor, bluetooth
    connection_type: str = Field(...)  # wifi, bluetooth, usb, local
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None


class DeviceResponse(BaseModel):
    """Device response model."""

    id: str
    device_id: str
    name: str
    device_type: str
    connection_type: str
    status: str
    ip_address: Optional[str]
    mac_address: Optional[str]
    last_seen: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CameraSourceCreate(BaseModel):
    """Create camera source request."""

    name: str = Field(..., min_length=1)
    source_type: str = Field(...)  # local, usb, rtsp, http
    resolution: Optional[str] = None
    fps: int = Field(default=30, ge=1, le=120)


class CameraSourceResponse(BaseModel):
    """Camera source response model."""

    id: str
    device_id: str
    name: str
    source_type: str
    resolution: Optional[str]
    fps: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
