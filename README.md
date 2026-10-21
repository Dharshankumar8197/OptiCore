# OptiCore

**OptiCore** is an AI-powered vision intelligence platform combining a custom-trained **YOLO26s (`best.pt`)** real-time detection engine, persistent ByteTrack obstacle tracking, and a glassmorphism Vision Studio interface.

[![Repository](https://img.shields.io/badge/GitHub-OptiCore-8A2BE2?logo=github)](https://github.com/Dharshankumar8197/OptiCore)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20PyTorch-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Web-Next.js%2016%20%7C%20React%2019-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Desktop-2496ED?logo=docker)](https://www.docker.com/)

---

## 🪟 Windows-First Portable AI Server Runner

Turn any Windows computer (Windows 10/11 x64 or **Snapdragon X Plus ARM64**) into an OptiCore AI inference server with **zero Python, PyTorch, CUDA, or Docker installed on client devices**:

### ⚡ 1-Line PowerShell Installation:
```powershell
irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/scripts/install-portable-server.ps1 | iex
```

### 🪄 What the Installer Does Automatically:
1. **Asks for Installation Folder**: Prompts for your desired location (press Enter for default `C:\Users\<user>`).
2. **Auto-Extracts on its Own**: Automatically creates and extracts cleanly into a dedicated **`portable_server`** folder.
3. **Cleans Up After Itself**: Automatically deletes the downloaded `.zip` archive upon completion.
4. **Interactive Control Center**: Instantly launches the control menu with live 3D visualizer, animated progress bars, and `.env` configuration helpers.

---

### 📦 What's Included in `portable_server/`:

* **Zero Client Setup**: No Python, PyTorch, or CUDA required on client devices (iPhone, Android, iPad, laptops).
* **Genuine Trained YOLO26s Model**: Runs your Kaggle-trained checkpoint `best.pt` with 20 specialized mobility classes:
  `person, car, bus, truck, motorcycle, bicycle, animal, door, stairs, pothole, crack, manhole, traffic_light, traffic_sign, pole, tree, bench, chair, waste_container, obstacle`
* **Interactive PowerShell Control Center (`menu.bat` / `run.bat`)**:
  * **System Status Card**: Real-time status of Docker Desktop, AI Backend, YOLO26s engine, ngrok tunnel, and host hardware.
  * **Animated Load Bars**: Real-time progress bars (`[████████░░░░] 65%`) during Docker startup, health polling, and container shutdown.
  * **1-Click Toggles**: Start/Stop, Restart, toggle Ngrok HTTPS tunnel `[ON/OFF]`, cycle detection sensitivity (`0.35` / `0.50` / `0.70`).
  * **Interactive `.env` Editor**: Opens `.env` in Notepad with variable explanations and auto-prompts to restart containers.
  * **Live 3D Neural Brain Visualizer**: 30 FPS in-memory C# ASCII rotating neural point cloud.
* **Embedded Vision Studio UI**: Embedded HTML5/Canvas studio served directly at `http://localhost:8000/` and over your public ngrok HTTPS tunnel.
* **On-Device Speech Advisory (TTS)**: Spoken directional warnings for road hazards and approaching obstacles with a 4-second cooldown.

---

### 🛠️ Portable Server Commands & Launchers

Inside your extracted `portable_server` folder:

| Launcher | Command | Description |
| :--- | :--- | :--- |
| **`menu.bat` / `run.bat`** | `.\menu.bat` | **Interactive Control Center** with live status dashboard, animated progress bars, 1-click toggles, and `.env` editor. |
| **`brain.bat`** | `.\brain.bat` | 1-Click launcher for the in-memory **3D Neural Brain Visualizer** (30 FPS ASCII screensaver). |
| **`start.bat`** | `.\start.bat` | Starts Docker containers, validates health with progress bar, and outputs live public HTTPS URLs. |
| **`stop.bat`** | `.\stop.bat` | Gracefully shuts down server containers and ngrok tunnel with progress bar. |
| **`status.bat`** | `.\status.bat` | Displays container state, memory/CPU diagnostics, and active tunnel status. |
| **`update.bat`** | `.\update.bat` | Pulls latest Docker image from GHCR while strictly preserving your `.env` configuration. |
| **`uninstall.bat`** | `.\uninstall.bat` | Cleans up containers, volumes, and virtual networks with optional data purge. |
| **`scripts\verify.ps1`** | `.\scripts\verify.ps1` | Runs the automated 17-point verification suite. |

---

### ⚙️ Quick Console Commands to Open `.env`

From your PowerShell terminal inside `portable_server`:

```powershell
# Open and edit .env in Notepad:
notepad .env

# Open and edit .env in VS Code:
code .env

# Check active configuration:
Get-Content .env
```

---

## 📱 Testing from Android, iPhone & Remote Laptops

1. Start your server with `.\start.bat` or select `[1]` in `menu.bat`.
2. Copy the **Public HTTPS URL** printed in the console (e.g. `https://xxxx.ngrok-free.app`).
3. Open this HTTPS URL directly in **Safari (iOS)** or **Chrome (Android)** on your phone.
4. Allow camera permissions to immediately start real-time hazard detection with persistent ByteTrack bounding boxes!
5. Toggle **"🔊 Speech Synthesis Alerts"** to hear spoken hazard warnings from your phone speaker or earbuds.

---

## ⚡ 1-Line Remote Backend Deployment (Cloud VPS / Linux / Docker)

For Linux servers, macOS, or cloud VPS instances:

### Linux / macOS / Cloud VPS:
```bash
curl -sSL https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/deploy_backend.sh | bash -s -- --authtoken YOUR_NGROK_AUTHTOKEN
```

### Windows (Direct Docker Deploy):
```powershell
irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/deploy_backend.ps1 | iex
```

### Direct Docker Run:
```bash
docker run -d \
  --name opticore-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -p 4040:4040 \
  -e NGROK_AUTHTOKEN="your_token_here" \
  -v opticore_data:/app/data \
  ghcr.io/dharshankumar8197/opticore-backend:latest
```

---

## 🚀 Deploy React Web App to Vercel

The full Vision Studio web application is built with **React 19 & Next.js 16** in the [`web/`](web/) folder:

1. Import repository `https://github.com/Dharshankumar8197/OptiCore` on [Vercel](https://vercel.com/new).
2. Set **Root Directory** to: `web`.
3. Add Environment Variable:
   * **`NEXT_PUBLIC_API_URL`**: Your public Ngrok HTTPS URL.
4. Click **Deploy**!

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

## 📁 Repository Structure

```
OptiCore/
├── portable_server/           # Windows Portable AI Server release package
│   ├── menu.bat               # Interactive Control Center launcher
│   ├── run.bat                # Quick menu launcher alias
│   ├── brain.bat              # 1-Click 3D Neural Brain Visualizer
│   ├── start.bat              # Start AI server & Ngrok tunnel
│   ├── stop.bat               # Stop server containers
│   ├── status.bat             # Live diagnostics report
│   ├── update.bat             # Update image while keeping .env
│   ├── uninstall.bat          # Clean teardown
│   ├── docker-compose.yml     # Multi-arch container orchestration
│   ├── .env.example           # Configuration template
│   └── scripts/               # PowerShell management & test scripts
├── backend/                   # FastAPI inference engine & SQLite database
│   ├── app/                   # REST routers, YOLO26s inference, ByteTrack
│   ├── models/best.pt         # Kaggle-trained YOLO26s weights (20 classes)
│   ├── Dockerfile             # Multi-arch PyTorch CPU container
│   └── Dockerfile.standalone  # Container with bundled Ngrok supervisor
├── web/                       # React 19 + Next.js 16 Vision Studio
│   └── src/                   # CameraViewport, Framer Motion UI, WebSockets
├── scripts/
│   └── install-portable-server.ps1 # 1-line Windows installer
├── build_portable_server.ps1  # Automated package builder & checksum generator
└── README.md                  # Main documentation
```

---

## 📄 License & Copyright
MIT License — Copyright © 2026 **OptiCore Team** ([Dharshankumar8197](https://github.com/Dharshankumar8197)). All rights reserved.
