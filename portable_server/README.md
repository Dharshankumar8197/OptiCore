# OptiCore — Windows-First Portable AI Inference Server

Turn any Windows 10/11 computer into an **OptiCore AI Inference Server** powered by Docker Desktop, the custom-trained YOLO26s `best.pt` model, and ngrok HTTPS tunneling.

---

## 🌟 Highlights

- **Zero Client Setup**: No Python, PyTorch, CUDA, or Docker required on client devices. Connect instantly from any web browser on **Android, iPhone, iPad, tablets, or laptops**.
- **Real Trained AI Model**: Runs your genuine Kaggle-trained **YOLO26s `best.pt`** model covering 20 specialized mobility and obstacle classes. Never uses fake/mock detections or default COCO replacements.
- **Embedded Vision Studio UI**: Built-in responsive HTML5/Canvas studio served directly at `http://localhost:8000/` and over your public ngrok HTTPS tunnel.
- **ByteTrack Tracking**: Isolated session tracking maintains persistent object IDs across frames without cross-client interference.
- **Public Ngrok HTTPS Tunnel**: Automatic tunnel negotiation with live URL discovery printed directly to your console, providing the secure context required for mobile camera access (`getUserMedia`).
- **On-Device Speech Advisory (TTS)**: Intelligent mobile/browser speech alerts for navigation hazards (potholes, cracks, approaching vehicles) with a 4-second cooldown to prevent repetitive spam.
- **Optional Contextual AI Guidance**: Optional Groq (`openai/gpt-oss-120b`) integration for natural language scene narrations, with automatic fallback to local rule-based safety alerts.
- **Windows-First Multi-Architecture**: Supports native ARM64 on Qualcomm Snapdragon X Plus/Elite Windows Copilot+ PCs as well as conventional Intel/AMD x64 systems via Docker Desktop.

---

## 🎯 20 Trained Object & Hazard Classes

| Category | Classes |
| :--- | :--- |
| **Pedestrians & Animals** | `person`, `animal` |
| **Transit & Vehicles** | `car`, `bus`, `truck`, `motorcycle`, `bicycle` |
| **Road Hazards** | `pothole`, `crack`, `manhole` |
| **Navigation & Obstacles** | `door`, `stairs`, `obstacle`, `bench`, `chair`, `waste_container` |
| **Urban Infrastructure** | `traffic_light`, `traffic_sign`, `pole`, `tree` |

---

## 🚀 Quick Start (Windows)

### Prerequisites
1. **Windows 10 or 11** (x64 or ARM64 / Snapdragon X).
2. **Docker Desktop for Windows** installed and running with the WSL2 Linux engine.
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Installation
Extract `portable_server.zip` into your desired directory (e.g. `D:\OptiCoreServer` or `C:\Users\Public\OptiCoreServer`), or run:

```cmd
install.bat
```

The installer will:
- Validate your destination directory (supporting paths with spaces).
- Auto-generate `.env` from `.env.example` (or preserve an existing `.env` with a timestamped backup).
- Check your Docker Desktop daemon status.

### 2. Interactive Control Center (Recommended)
Double-click `menu.bat` (or `run.bat`):

```cmd
menu.bat
```

The **Interactive Control Center** displays a live system status dashboard and offers 1-click toggles and commands:
- **Live Status Card**: Real-time status of Docker Desktop, OptiCore AI backend, YOLO26s engine, ngrok tunnel, and host hardware architecture.
- **Animated Progress Bars**: Visual progress bars during Docker startup, AI engine health polling, tunnel discovery, and shutdowns.
- **Interactive Toggles**: Toggle Ngrok tunnel ON/OFF, toggle Groq scene guidance, and cycle detection sensitivity (0.35 sensitive / 0.50 balanced / 0.70 strict).
- **Edit Configuration (`.env`)**: Option `[6]` opens `.env` directly in Notepad with setting explanations, and automatically offers to restart containers if running.
- **Direct Ngrok Setup**: Option `[7]` lets you paste your token directly into PowerShell without manual file editing.
- **Open in Browser**: Option `[8]` launches the embedded Vision Studio in your default browser.
- **Quick CLI Commands**: Clearly displays the exact console commands to open `.env` or manage the server from PowerShell or Command Prompt.

### 3. Alternative Direct Launch (start.bat / stop.bat)
You can also launch directly from terminal or double-click:

```cmd
start.bat
```

To edit your `.env` configuration directly from PowerShell or Command Prompt:
```cmd
notepad .env
```

To stop the server at any time:
```cmd
stop.bat
```

When started, the script will:
- Start Docker Desktop if it was sleeping (with progress bar).
- Pull the versioned server image from GitHub Container Registry (or use local build).
- Start the server and ngrok containers via Docker Compose.
- Perform a health check with animated progress bar on `http://localhost:8000/health`.
- Discover and display your verified **public HTTPS URL**:

```
======================================================================
   🚀 OPTICORE AI INFERENCE SERVER IS RUNNING AND READY!
======================================================================
   📡 Local Access:       http://localhost:8000
   🏡 Local LAN Network:  http://192.168.1.50:8000
   📖 Interactive Docs:   http://localhost:8000/docs

   ------------------------------------------------------------------
   [*] PUBLIC HTTPS URL (Android, iPhone, iPad, Remote Laptops):
       https://a1b2-c3d4.ngrok-free.app
   ------------------------------------------------------------------
   >> Open this HTTPS URL directly on your phone's browser (Safari/Chrome)
      to immediately use your phone's camera for real-time AI object detection!
======================================================================
```

---

## 📱 Using OptiCore from Mobile Devices

1. Open the **Public HTTPS URL** printed in the console on your phone's browser (Safari on iOS, Chrome on Android).
2. Allow camera permissions when prompted.
3. Switch between **Front Lens** and **Rear/Environment Lens** using the camera selector.
4. Toggle **"🔄 Start Auto-Scan"** for continuous 2–5 FPS real-time detection overlays with ByteTrack IDs.
5. Enable **"🔊 Speech Synthesis Alerts"** to hear directional hazard warnings spoken directly by your device speaker or Bluetooth earbuds.

---

## 💻 Connecting Existing OptiCore Next.js Web App

If you are running the OptiCore Next.js Vision Studio web app on Vercel or locally on port 3000:
1. Open the Web App Settings page.
2. In the **Inference Server URL** field, enter your public ngrok URL:
   ```
   https://your-tunnel-id.ngrok-free.app
   ```
3. Click **Save & Connect**. The web app will switch from simulated/standby mode to live inference powered by your Windows server!

---

## 🛠️ Management Commands

| Command | Description |
| :--- | :--- |
| `menu.bat` / `run.bat` | Interactive PowerShell Control Center with live status, toggles, progress bars, and `.env` editing. |
| `brain.bat` | 1-Click launcher for the OptiCore AI Server Control Center HUD. |
| `start.bat` | Starts the server, validates health with progress bar, and outputs live URLs. |
| `stop.bat` | Gracefully shuts down server containers and ngrok tunnel with progress bar. |
| `status.bat` | Displays container state, memory/CPU diagnostics, and active tunnel status. |
| `update.bat` | Pulls the latest GHCR Docker image while strictly preserving your `.env` configuration. |
| `uninstall.bat` | Cleans up containers and virtual networks with optional data purge. |
| `scripts\verify.ps1` | Runs the automated 17-point verification suite. |



---

## ⚙️ Configuration Reference (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPTICORE_IMAGE` | `ghcr.io/dharshankumar8197/opticore-backend` | Container image reference |
| `OPTICORE_VERSION` | `latest` | Image tag / version |
| `API_PORT` | `8000` | Host port mapped to backend |
| `MODEL_PATH` | `./models/best.pt` | Model checkpoint path |
| `CONFIDENCE_THRESHOLD` | `0.50` | Detection sensitivity (0.10 – 0.95) |
| `IOU_THRESHOLD` | `0.45` | Non-Maximum Suppression overlap threshold |
| `IMAGE_SIZE` | `640` | Input resolution (320 – 1280) |
| `NGROK_AUTHTOKEN` | *(empty)* | Your ngrok authentication token |
| `NGROK_ENABLED` | `true` | Enable public HTTPS tunnel |
| `GROQ_API_KEY` | *(empty)* | Optional Groq key for contextual scene guidance |
| `MAX_UPLOAD_SIZE_MB` | `15` | Maximum upload size per request |
| `MAX_CONCURRENT_INFERENCES` | `3` | Concurrency semaphore to protect host RAM |

---

## ⚡ Hardware Acceleration & Performance Notes

- **Snapdragon X Plus (Windows ARM64)**: Runs natively in WSL2 Linux `aarch64` without x86 emulation overhead. AI inference executes on 8 high-performance CPU cores.
- **Intel / AMD (Windows x64)**: Runs natively on Linux `x86_64` container engine.
- **Inference Latency**: Typical CPU inference latency for YOLO26s at 640x640 resolution is **40–85 ms per frame** (~12–25 FPS throughput).
- **RAM Footprint**: Under 1.2 GB RAM for the complete inference server and runtime.

---

## 🔒 Security

- All secret tokens (`NGROK_AUTHTOKEN`, `GROQ_API_KEY`, `JWT_SECRET_KEY`) are automatically redacted in logs and diagnostic outputs.
- Administrative settings are never exposed over public endpoints without credentials.
- HTTPS context ensures cryptographic end-to-end security between client devices and your Windows server.

---

## 📄 License & Copyright
MIT License — Copyright © 2026 **OptiCore Team** ([Dharshankumar8197](https://github.com/Dharshankumar8197)). All rights reserved.

