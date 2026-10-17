"""Wi-Fi scanning and connection API routes."""

import platform
import subprocess
import re
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wifi", tags=["wifi"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WiFiNetwork(BaseModel):
    ssid: str
    bssid: Optional[str] = None
    signal: Optional[int] = None      # percentage 0-100
    signal_dbm: Optional[int] = None  # dBm
    security: Optional[str] = None    # WPA2, WPA3, Open, etc.
    frequency: Optional[str] = None   # 2.4GHz / 5GHz
    connected: bool = False


class WiFiConnectRequest(BaseModel):
    ssid: str
    password: Optional[str] = None


class WiFiConnectResponse(BaseModel):
    status: str        # "connected" | "failed" | "connecting"
    ssid: str
    message: str


# ── OS-level scan helpers ─────────────────────────────────────────────────────

def _scan_windows() -> List[WiFiNetwork]:
    """Use netsh to list available networks on Windows."""
    networks: List[WiFiNetwork] = []
    try:
        # Get current SSID so we can mark it as connected
        current_out = subprocess.check_output(
            ["netsh", "wlan", "show", "interfaces"],
            timeout=5, stderr=subprocess.DEVNULL
        ).decode(errors="replace")
        current_ssid_match = re.search(r"^\s+SSID\s+:\s+(.+)$", current_out, re.MULTILINE)
        current_ssid = current_ssid_match.group(1).strip() if current_ssid_match else None

        out = subprocess.check_output(
            ["netsh", "wlan", "show", "networks", "mode=bssid"],
            timeout=8, stderr=subprocess.DEVNULL
        ).decode(errors="replace")

        # Parse blocks separated by blank lines
        blocks = re.split(r"\n(?=SSID \d+)", out)
        for block in blocks:
            ssid_m    = re.search(r"^SSID \d+\s+:\s+(.+)$", block, re.MULTILINE)
            bssid_m   = re.search(r"BSSID \d+\s+:\s+([0-9a-f:]+)", block, re.IGNORECASE)
            signal_m  = re.search(r"Signal\s+:\s+(\d+)%", block)
            auth_m    = re.search(r"Authentication\s+:\s+(.+)$", block, re.MULTILINE)

            if not ssid_m:
                continue

            ssid = ssid_m.group(1).strip()
            if not ssid:
                continue

            signal_pct = int(signal_m.group(1)) if signal_m else None
            signal_dbm = int(-100 + (signal_pct / 2)) if signal_pct is not None else None

            networks.append(WiFiNetwork(
                ssid=ssid,
                bssid=bssid_m.group(1).strip() if bssid_m else None,
                signal=signal_pct,
                signal_dbm=signal_dbm,
                security=auth_m.group(1).strip() if auth_m else None,
                connected=(ssid == current_ssid),
            ))
    except subprocess.TimeoutExpired:
        logger.warning("netsh timed out during Wi-Fi scan")
    except Exception as exc:
        logger.error("Windows Wi-Fi scan error: %s", exc)
    return networks


def _scan_linux() -> List[WiFiNetwork]:
    """Use nmcli to list available networks on Linux."""
    networks: List[WiFiNetwork] = []
    try:
        out = subprocess.check_output(
            ["nmcli", "-t", "-f", "SSID,BSSID,SIGNAL,SECURITY,FREQ,IN-USE", "dev", "wifi", "list"],
            timeout=8, stderr=subprocess.DEVNULL
        ).decode(errors="replace")

        for line in out.strip().splitlines():
            parts = line.split(":")
            if len(parts) < 5:
                continue
            ssid     = parts[0].strip()
            bssid    = parts[1].strip() if len(parts) > 1 else None
            signal   = int(parts[2]) if len(parts) > 2 and parts[2].strip().isdigit() else None
            security = parts[3].strip() if len(parts) > 3 else None
            freq     = parts[4].strip() if len(parts) > 4 else None
            in_use   = parts[5].strip() == "*" if len(parts) > 5 else False

            if not ssid:
                continue

            signal_dbm = int(-100 + (signal / 2)) if signal is not None else None

            networks.append(WiFiNetwork(
                ssid=ssid,
                bssid=bssid,
                signal=signal,
                signal_dbm=signal_dbm,
                security=security if security else "Open",
                frequency="5GHz" if freq and "5" in freq else "2.4GHz",
                connected=in_use,
            ))
    except FileNotFoundError:
        # nmcli not available, try iwlist
        try:
            out = subprocess.check_output(
                ["sudo", "iwlist", "scan"], timeout=8, stderr=subprocess.DEVNULL
            ).decode(errors="replace")
            cells = re.split(r"Cell \d+", out)
            for cell in cells[1:]:
                ssid_m   = re.search(r'ESSID:"(.+?)"', cell)
                signal_m = re.search(r"Signal level=(-?\d+)", cell)
                if ssid_m:
                    signal_dbm = int(signal_m.group(1)) if signal_m else None
                    signal_pct = max(0, min(100, 2 * (signal_dbm + 100))) if signal_dbm else None
                    networks.append(WiFiNetwork(
                        ssid=ssid_m.group(1),
                        signal=signal_pct,
                        signal_dbm=signal_dbm,
                    ))
        except Exception:
            pass
    except Exception as exc:
        logger.error("Linux Wi-Fi scan error: %s", exc)
    return networks


def _scan_macos() -> List[WiFiNetwork]:
    """Use airport utility on macOS."""
    networks: List[WiFiNetwork] = []
    try:
        airport = (
            "/System/Library/PrivateFrameworks/Apple80211.framework"
            "/Versions/Current/Resources/airport"
        )
        out = subprocess.check_output(
            [airport, "-s"], timeout=8, stderr=subprocess.DEVNULL
        ).decode(errors="replace")

        # Get current SSID
        iface_out = subprocess.check_output(
            [airport, "-I"], timeout=3, stderr=subprocess.DEVNULL
        ).decode(errors="replace")
        cur_m = re.search(r"[^B]SSID:\s+(.+)", iface_out)
        current_ssid = cur_m.group(1).strip() if cur_m else None

        lines = out.strip().splitlines()[1:]  # skip header
        for line in lines:
            parts = line.split()
            if len(parts) < 3:
                continue
            ssid = parts[0]
            try:
                signal_dbm = int(parts[2])
                signal_pct = max(0, min(100, 2 * (signal_dbm + 100)))
            except (ValueError, IndexError):
                signal_dbm = None
                signal_pct = None
            security = parts[-1] if len(parts) > 5 else None
            networks.append(WiFiNetwork(
                ssid=ssid,
                signal=signal_pct,
                signal_dbm=signal_dbm,
                security=security,
                connected=(ssid == current_ssid),
            ))
    except Exception as exc:
        logger.error("macOS Wi-Fi scan error: %s", exc)
    return networks


def _scan_networks() -> List[WiFiNetwork]:
    """Dispatch to the correct OS scanner."""
    system = platform.system()
    if system == "Windows":
        return _scan_windows()
    elif system == "Linux":
        return _scan_linux()
    elif system == "Darwin":
        return _scan_macos()
    return []


# ── Connect helpers ───────────────────────────────────────────────────────────

def _connect_windows(ssid: str, password: Optional[str]) -> WiFiConnectResponse:
    """Connect on Windows using netsh."""
    try:
        if password:
            # Create a temporary profile XML and connect
            profile_xml = f"""<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{ssid}</name>
    <SSIDConfig><SSID><name>{ssid}</name></SSID></SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM><security>
        <authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption></authEncryption>
        <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{password}</keyMaterial></sharedKey>
    </security></MSM>
</WLANProfile>"""
            import tempfile, os
            with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as f:
                f.write(profile_xml)
                tmp = f.name
            try:
                subprocess.check_output(["netsh", "wlan", "add", "profile", f"filename={tmp}"], timeout=5, stderr=subprocess.DEVNULL)
                subprocess.check_output(["netsh", "wlan", "connect", f"name={ssid}"], timeout=10, stderr=subprocess.DEVNULL)
            finally:
                os.unlink(tmp)
        else:
            # Connect to open or remembered network
            subprocess.check_output(["netsh", "wlan", "connect", f"name={ssid}"], timeout=10, stderr=subprocess.DEVNULL)

        return WiFiConnectResponse(status="connected", ssid=ssid, message=f"Connected to {ssid}")
    except subprocess.CalledProcessError as exc:
        return WiFiConnectResponse(status="failed", ssid=ssid, message=f"Connection failed: {exc}")
    except Exception as exc:
        return WiFiConnectResponse(status="failed", ssid=ssid, message=str(exc))


def _connect_linux(ssid: str, password: Optional[str]) -> WiFiConnectResponse:
    """Connect on Linux using nmcli."""
    try:
        if password:
            cmd = ["nmcli", "dev", "wifi", "connect", ssid, "password", password]
        else:
            cmd = ["nmcli", "dev", "wifi", "connect", ssid]
        subprocess.check_output(cmd, timeout=20, stderr=subprocess.STDOUT)
        return WiFiConnectResponse(status="connected", ssid=ssid, message=f"Connected to {ssid}")
    except subprocess.CalledProcessError as exc:
        out = exc.output.decode(errors="replace") if exc.output else str(exc)
        return WiFiConnectResponse(status="failed", ssid=ssid, message=out.strip())
    except Exception as exc:
        return WiFiConnectResponse(status="failed", ssid=ssid, message=str(exc))


def _connect_macos(ssid: str, password: Optional[str]) -> WiFiConnectResponse:
    """Connect on macOS using networksetup."""
    try:
        if password:
            subprocess.check_output(
                ["networksetup", "-setairportnetwork", "en0", ssid, password],
                timeout=15, stderr=subprocess.DEVNULL
            )
        else:
            subprocess.check_output(
                ["networksetup", "-setairportnetwork", "en0", ssid],
                timeout=15, stderr=subprocess.DEVNULL
            )
        return WiFiConnectResponse(status="connected", ssid=ssid, message=f"Connected to {ssid}")
    except Exception as exc:
        return WiFiConnectResponse(status="failed", ssid=ssid, message=str(exc))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/scan", response_model=List[WiFiNetwork])
def scan_wifi():
    """Scan for all Wi-Fi networks visible to this machine."""
    networks = _scan_networks()
    # De-duplicate by SSID (keep strongest signal)
    seen: dict[str, WiFiNetwork] = {}
    for net in networks:
        if net.ssid not in seen or (net.signal or 0) > (seen[net.ssid].signal or 0):
            seen[net.ssid] = net
    return sorted(seen.values(), key=lambda n: -(n.signal or 0))


@router.post("/connect", response_model=WiFiConnectResponse)
def connect_wifi(req: WiFiConnectRequest):
    """Connect to a Wi-Fi network by SSID."""
    system = platform.system()
    if system == "Windows":
        result = _connect_windows(req.ssid, req.password)
    elif system == "Linux":
        result = _connect_linux(req.ssid, req.password)
    elif system == "Darwin":
        result = _connect_macos(req.ssid, req.password)
    else:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED,
                            detail=f"Wi-Fi connection not supported on {system}")
    if result.status == "failed":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=result.message)
    return result


@router.post("/disconnect")
def disconnect_wifi():
    """Disconnect from the current Wi-Fi network."""
    system = platform.system()
    try:
        if system == "Windows":
            subprocess.check_output(["netsh", "wlan", "disconnect"], timeout=5, stderr=subprocess.DEVNULL)
        elif system == "Linux":
            subprocess.check_output(["nmcli", "dev", "disconnect", "wlan0"], timeout=5, stderr=subprocess.DEVNULL)
        elif system == "Darwin":
            subprocess.check_output(
                ["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-z"],
                timeout=5, stderr=subprocess.DEVNULL
            )
        return {"status": "disconnected"}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
