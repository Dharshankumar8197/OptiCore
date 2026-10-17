"""System and health check API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import psutil
import os
import platform
import subprocess
import re
import logging

from app.database import get_db
from app.database.models import Model
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])


# ── Wi-Fi helpers ─────────────────────────────────────────────────────────────

def _get_wifi_info() -> dict:
    """Detect current Wi-Fi state using platform-appropriate methods.
    Returns dict with all five wifi fields; all default to None/False on failure.
    """
    base = {
        "wifi_connected": False,
        "wifi_ssid": None,
        "wifi_ip": None,
        "wifi_interface": None,
        "wifi_signal_dbm": None,
    }
    try:
        system = platform.system()
        ssid: str | None = None

        if system == "Linux":
            try:
                ssid = subprocess.check_output(
                    ["iwgetid", "-r"], timeout=2, stderr=subprocess.DEVNULL
                ).decode().strip() or None
            except Exception:
                pass

        elif system == "Darwin":
            try:
                airport = (
                    "/System/Library/PrivateFrameworks/Apple80211.framework"
                    "/Versions/Current/Resources/airport"
                )
                out = subprocess.check_output([airport, "-I"], timeout=2, stderr=subprocess.DEVNULL).decode()
                m = re.search(r"[^B]SSID:\s+(.+)", out)
                ssid = m.group(1).strip() if m else None
            except Exception:
                pass

        elif system == "Windows":
            try:
                out = subprocess.check_output(
                    ["netsh", "wlan", "show", "interfaces"],
                    timeout=3, stderr=subprocess.DEVNULL
                ).decode(errors="replace")
                m = re.search(r"^\s+SSID\s+:\s+(.+)$", out, re.MULTILINE)
                ssid = m.group(1).strip() if m else None
                # Signal strength on Windows
                ms = re.search(r"Signal\s+:\s+(\d+)%", out)
                if ms:
                    pct = int(ms.group(1))
                    base["wifi_signal_dbm"] = int(-100 + (pct / 2))  # approx dBm
            except Exception:
                pass

        # IP / interface from psutil
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
        wifi_iface_names = {"wi-fi", "wlan", "wlp", "wlan0", "en0", "wifi"}

        for iface, iface_stats in stats.items():
            if not iface_stats.isup:
                continue
            # Match common Wi-Fi interface name patterns
            lower = iface.lower()
            if not any(lower.startswith(w) or lower == w for w in wifi_iface_names):
                continue
            for addr in addrs.get(iface, []):
                import socket
                if addr.family == socket.AF_INET and addr.address and not addr.address.startswith("169."):
                    base["wifi_connected"] = True
                    base["wifi_ip"] = addr.address
                    base["wifi_interface"] = iface
                    if ssid:
                        base["wifi_ssid"] = ssid
                    return base

        # Fallback: if we have an SSID we definitely have a connection even if iface name is unusual
        if ssid:
            for iface, iface_addrs in addrs.items():
                for addr in iface_addrs:
                    import socket
                    if addr.family == socket.AF_INET and addr.address and not addr.address.startswith("127.") and not addr.address.startswith("169."):
                        base["wifi_connected"] = True
                        base["wifi_ssid"] = ssid
                        base["wifi_ip"] = addr.address
                        base["wifi_interface"] = iface
                        return base

    except Exception as exc:
        logger.debug("wifi_info failed: %s", exc)

    return base


def _get_usb_device_count() -> int:
    """Count USB-connected devices safely without invoking OpenCV VideoCapture."""
    try:
        system = platform.system()
        if system == "Linux":
            usb_sys = "/sys/bus/usb/devices"
            if os.path.exists(usb_sys):
                devs = [d for d in os.listdir(usb_sys) if ":" not in d and not d.startswith("usb")]
                if devs:
                    return len(devs)
            import glob
            return len(glob.glob("/dev/video*"))
        elif system == "Windows":
            out = subprocess.check_output(
                ["powershell", "-Command",
                 "Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'USB*' } | Measure-Object | Select-Object -ExpandProperty Count"],
                timeout=3, stderr=subprocess.DEVNULL
            ).decode().strip()
            return int(out) if out.isdigit() else 0
    except Exception:
        pass
    return 0


def _get_bluetooth_adapter_available() -> bool:
    """Check whether a Bluetooth adapter is present and powered on."""
    try:
        system = platform.system()
        if system == "Linux":
            out = subprocess.check_output(
                ["hciconfig"], timeout=2, stderr=subprocess.DEVNULL
            ).decode()
            return "UP RUNNING" in out or "hci" in out
        elif system == "Darwin":
            out = subprocess.check_output(
                ["system_profiler", "SPBluetoothDataType"], timeout=3, stderr=subprocess.DEVNULL
            ).decode()
            return "Bluetooth Power: On" in out or "State: On" in out
        elif system == "Windows":
            out = subprocess.check_output(
                ["powershell", "-Command",
                 "Get-PnpDevice -Class Bluetooth -Status OK | Measure-Object | Select-Object -ExpandProperty Count"],
                timeout=4, stderr=subprocess.DEVNULL
            ).decode().strip()
            return int(out) > 0 if out.isdigit() else False
    except Exception:
        pass
    # Last resort: try bleak
    try:
        import bleak  # noqa: F401  type: ignore
        return True
    except ImportError:
        pass
    return False


def _enumerate_cameras() -> list:
    """Probe VideoCapture indices safely to discover real hardware cameras without logging errors."""
    cameras = []
    system = platform.system()
    try:
        # In Linux/Docker, check if /dev/video* devices exist before calling OpenCV
        if system == "Linux":
            import glob
            dev_nodes = sorted(glob.glob("/dev/video*"))
            if not dev_nodes:
                return []
            indices_to_check = []
            for node in dev_nodes:
                num = "".join(filter(str.isdigit, os.path.basename(node)))
                if num.isdigit():
                    indices_to_check.append(int(num))
        else:
            indices_to_check = [0, 1]

        import cv2  # type: ignore
        try:
            cv2.setLogLevel(0)  # Silence OpenCV C++ driver loggers
        except Exception:
            pass

        for index in indices_to_check:
            cap = cv2.VideoCapture(index)
            if not cap.isOpened():
                cap.release()
                continue
            fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()

            cam_type = "local" if index == 0 else "usb"
            name = "Built-in Camera" if index == 0 else f"USB Camera {index}"
            resolution = f"{w}x{h}" if w and h else None

            cameras.append({
                "id": f"camera_{index}",
                "device_id": "local",
                "name": name,
                "source_type": cam_type,
                "resolution": resolution,
                "fps": fps,
                "status": "connected",
            })
    except Exception as exc:
        logger.debug("OpenCV camera enumeration failed: %s", exc)

    # OS-level hardware discovery if OpenCV is headless / not installed
    if not cameras and system == "Windows":
        try:
            cmd = [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-PnpDevice -Class Camera -PresentOnly -ErrorAction SilentlyContinue | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"
            ]
            out = subprocess.check_output(cmd, timeout=3, stderr=subprocess.DEVNULL).decode("utf-8", errors="replace").strip()
            if out:
                import json
                data = json.loads(out)
                if isinstance(data, dict):
                    data = [data]
                for idx, item in enumerate(data):
                    name = item.get("FriendlyName") or f"Camera {idx}"
                    iid = item.get("InstanceId") or ""
                    is_usb = "USB" in iid.upper()
                    cameras.append({
                        "id": f"camera_{idx}",
                        "device_id": "local",
                        "name": name,
                        "source_type": "usb" if is_usb else "local",
                        "resolution": "1080p",
                        "fps": 30,
                        "status": "connected" if item.get("Status") == "OK" else "available",
                    })
        except Exception as exc:
            logger.debug("Windows PnP camera discovery error: %s", exc)

    return cameras


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.api_route("/health", methods=["GET", "HEAD"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    try:
        db.execute("SELECT 1")
        db_status = "ok"
    except Exception:
        db_status = "error"

    model_loaded = os.path.exists(settings.model_path)
    try:
        model_obj = db.query(Model).filter(Model.file_name == "best.pt").first()
        model_status = model_obj.status if model_obj else "not_found"
    except Exception:
        model_status = "error"

    # Check inference singleton
    try:
        from app.inference import is_model_loaded
        model_loaded = model_loaded and is_model_loaded()
    except Exception:
        pass

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "model_loaded": model_loaded,
        "model_status": model_status,
        "version": settings.version,
    }


@router.get("/api/status")
def system_status():
    """Get full system status including Wi-Fi, BT, USB, and battery metrics."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    try:
        temp = psutil.sensors_temperatures()
        cpu_temp = temp.get("coretemp", [{}])[0].get("current", None) if temp else None
    except Exception:
        cpu_temp = None

    wifi_info = _get_wifi_info()
    usb_count = _get_usb_device_count()
    bt_available = _get_bluetooth_adapter_available()

    battery = None
    battery_percent = None
    battery_plugged = None
    try:
        battery = psutil.sensors_battery()
        if battery is not None:
            battery_percent = round(battery.percent, 1)
            battery_plugged = battery.power_plugged
    except Exception:
        pass

    return {
        "backend": "online",
        "cpu": {
            "percent": cpu_percent,
            "count": psutil.cpu_count(),
        },
        "memory": {
            "percent": memory.percent,
            "used_mb": round(memory.used / (1024 * 1024), 1),
            "total_mb": round(memory.total / (1024 * 1024), 1),
        },
        "disk": {
            "percent": disk.percent,
            "used_gb": round(disk.used / (1024 * 1024 * 1024), 2),
            "total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
        },
        "cpu_temp": cpu_temp,
        # Wi-Fi
        "wifi_connected": wifi_info["wifi_connected"],
        "wifi_ssid": wifi_info["wifi_ssid"],
        "wifi_ip": wifi_info["wifi_ip"],
        "wifi_interface": wifi_info["wifi_interface"],
        "wifi_signal_dbm": wifi_info["wifi_signal_dbm"],
        # USB
        "usb_device_count": usb_count,
        # Bluetooth
        "bluetooth_adapter_available": bt_available,
        # Power
        "battery_percent": battery_percent,
        "battery_plugged": battery_plugged,
    }


@router.get("/api/cameras")
def list_cameras():
    """List cameras actually detected by the OS via OpenCV probe."""
    cameras = _enumerate_cameras()
    return {"cameras": cameras}


@router.get("/api/wifi/devices")
def list_wifi_devices(db: Session = Depends(get_db)):
    """List Wi-Fi devices registered in the wifi_devices table."""
    from app.database.models import WiFiDevice
    devices = db.query(WiFiDevice).all()
    return {
        "devices": [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "ip_address": d.ip_address,
                "port": d.port,
                "device_type": d.device_type,
                "status": d.status,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            }
            for d in devices
        ]
    }


@router.get("/api/system/tunnel")
def get_public_tunnel():
    """Get the active public Ngrok tunnel URL if running in tunnel mode."""
    url_file = os.path.join("data", "ngrok_url.txt")
    if os.path.exists(url_file):
        try:
            with open(url_file, "r") as f:
                tunnel_url = f.read().strip()
                if tunnel_url:
                    return {"status": "active", "tunnel_url": tunnel_url}
        except Exception:
            pass

    # Query local ngrok API if running
    try:
        import urllib.request
        import json
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels")
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            data = json.loads(resp.read().decode())
            tunnels = data.get("tunnels", [])
            for t in tunnels:
                if t.get("proto") == "https":
                    return {"status": "active", "tunnel_url": t.get("public_url")}
            if tunnels:
                return {"status": "active", "tunnel_url": tunnels[0].get("public_url")}
    except Exception:
        pass

    return {"status": "offline", "tunnel_url": None}

