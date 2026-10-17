"""Bluetooth device schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BluetoothDeviceResponse(BaseModel):
    """Bluetooth device response."""

    id: str
    device_id: str
    name: str
    address: str
    device_type: str
    status: str
    signal_strength: Optional[int] = None
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class BluetoothScanResult(BaseModel):
    """Single device discovered during a BT scan."""

    address: str
    name: str
    device_type: str
    rssi: Optional[int] = None
    status: str = "available"


class BluetoothConnectRequest(BaseModel):
    """Request body for connect / disconnect."""

    address: str


class TTSTestResponse(BaseModel):
    """Response from the TTS test endpoint."""

    status: str
    routed_to: str
