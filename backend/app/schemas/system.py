"""System status and camera enumeration schemas."""

from pydantic import BaseModel
from typing import Optional, List
from app.schemas.device import CameraSourceResponse


class SystemStatusResponse(BaseModel):
    """Full system status response — all optional fields may be null on unsupported hardware."""

    backend: str
    cpu: dict
    memory: dict
    disk: dict
    cpu_temp: Optional[float] = None

    # Wi-Fi
    wifi_connected: bool = False
    wifi_ssid: Optional[str] = None
    wifi_ip: Optional[str] = None
    wifi_interface: Optional[str] = None
    wifi_signal_dbm: Optional[int] = None

    # USB
    usb_device_count: int = 0

    # Bluetooth adapter
    bluetooth_adapter_available: bool = False

    # Power / battery
    battery_percent: Optional[float] = None
    battery_plugged: Optional[bool] = None


class CameraEnumerationResponse(BaseModel):
    """Camera enumeration response."""

    cameras: List[CameraSourceResponse]
