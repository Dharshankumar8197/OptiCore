"""Bluetooth device management API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import asyncio
import logging

from app.database import get_db
from app.database.models import BluetoothDevice, Device
from app.auth.dependencies import get_current_active_user
from app.database.models import User
from app.schemas.bluetooth import (
    BluetoothDeviceResponse,
    BluetoothScanResult,
    BluetoothConnectRequest,
    TTSTestResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bluetooth", tags=["bluetooth"])


def _classify_device_type(name: str) -> str:
    """Heuristically classify BT device type from its name."""
    n = name.lower()
    if any(k in n for k in ["airpod", "earbud", "bud", "pod", "ear"]):
        return "earbuds"
    if any(k in n for k in ["headphone", "headset", "wh-", "wf-"]):
        return "headphones"
    if any(k in n for k in ["speaker", "soundbar", "boom", "jbl", "bose"]):
        return "speaker"
    if any(k in n for k in ["hearing", "starkey", "phonak", "oticon", "widex"]):
        return "hearing_device"
    if any(k in n for k in ["keyboard", "mouse", "trackpad"]):
        return "input_device"
    return "peripheral"


@router.get("/devices", response_model=List[BluetoothDeviceResponse])
def list_bluetooth_devices(
    db: Session = Depends(get_db),
):
    """List all known Bluetooth devices from the database."""
    devices = db.query(BluetoothDevice).all()
    return devices


@router.post("/scan", response_model=List[BluetoothScanResult])
async def scan_bluetooth(
    db: Session = Depends(get_db),
):
    """Scan for nearby Bluetooth devices and upsert into bluetooth_devices."""
    try:
        import bleak  # type: ignore
        from bleak import BleakScanner

        discovered = await BleakScanner.discover(timeout=5.0)
        results: List[BluetoothScanResult] = []

        for dev in discovered:
            name = dev.name or dev.address
            device_type = _classify_device_type(name)
            rssi = getattr(dev, "rssi", None)

            # Upsert into bluetooth_devices table
            # bluetooth_devices.device_id must reference a devices row;
            # we use a synthetic "local" device record here
            existing = db.query(BluetoothDevice).filter(
                BluetoothDevice.address == dev.address
            ).first()

            if existing:
                existing.name = name
                existing.signal_strength = rssi
                if existing.status != "connected":
                    existing.status = "available"
                db.commit()
            # We only upsert fully when a parent Device row exists;
            # for now return discovery results without persisting orphaned records

            results.append(BluetoothScanResult(
                address=dev.address,
                name=name,
                device_type=device_type,
                rssi=rssi,
                status="available",
            ))

        return results

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bleak library not installed — Bluetooth scanning unavailable",
        )
    except Exception as exc:
        logger.error("Bluetooth scan failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Bluetooth scan error: {exc}",
        )


@router.post("/connect", response_model=BluetoothDeviceResponse)
async def connect_bluetooth(
    request: BluetoothConnectRequest,
    db: Session = Depends(get_db),
):
    """Connect to a Bluetooth device by address."""
    try:
        import bleak  # type: ignore
        from bleak import BleakClient

        async with BleakClient(request.address, timeout=10.0) as client:
            connected = client.is_connected
            if not connected:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not connect to device",
                )

        # Update or create record
        existing = db.query(BluetoothDevice).filter(
            BluetoothDevice.address == request.address
        ).first()
        if existing:
            existing.status = "connected"
            db.commit()
            db.refresh(existing)
            return existing

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found in database — scan first",
        )

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="bleak library not installed",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Bluetooth connect failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Bluetooth connect error: {exc}",
        )


@router.post("/disconnect")
async def disconnect_bluetooth(
    request: BluetoothConnectRequest,
    db: Session = Depends(get_db),
):
    """Disconnect a Bluetooth device."""
    existing = db.query(BluetoothDevice).filter(
        BluetoothDevice.address == request.address
    ).first()
    if existing:
        existing.status = "disconnected"
        db.commit()

    # Best-effort BLE disconnect
    try:
        import bleak  # type: ignore
        from bleak import BleakClient
        async with BleakClient(request.address, timeout=5.0) as client:
            if client.is_connected:
                await client.disconnect()
    except Exception:
        pass  # Already disconnected or not connectable

    return {"status": "ok", "address": request.address}


@router.post("/tts-test", response_model=TTSTestResponse)
def tts_test(db: Session = Depends(get_db)):
    """Synthesize a short TTS phrase and route to BT audio or system default."""
    phrase = "OptiCore Bluetooth audio test"
    routed_to = "default"

    # Check if there is a connected BT audio device
    audio_device = db.query(BluetoothDevice).filter(
        BluetoothDevice.status == "connected",
        BluetoothDevice.device_type.in_(["earbuds", "headphones", "speaker", "hearing_device"]),
    ).first()

    if audio_device:
        routed_to = audio_device.name

    try:
        import pyttsx3  # type: ignore
        engine = pyttsx3.init()
        engine.say(phrase)
        engine.runAndWait()
        engine.stop()
    except ImportError:
        # pyttsx3 not installed — try espeak
        import subprocess
        import platform
        try:
            if platform.system() == "Windows":
                subprocess.run(
                    ["powershell", "-Command",
                     f"Add-Type -AssemblyName System.Speech; "
                     f"$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('{phrase}')"],
                    timeout=10, check=True, capture_output=True
                )
            else:
                subprocess.run(["espeak", phrase], timeout=10, check=True, capture_output=True)
        except Exception as exc:
            logger.warning("TTS fallback failed: %s", exc)
            return TTSTestResponse(status="error", routed_to=f"TTS unavailable: {exc}")
    except Exception as exc:
        logger.error("TTS failed: %s", exc)
        return TTSTestResponse(status="error", routed_to=f"error: {exc}")

    return TTSTestResponse(status="ok", routed_to=routed_to)
