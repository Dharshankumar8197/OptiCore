# OptiCore

**OptiCore** is an AI-powered vision intelligence platform combining real-time object detection (`best.pt`), cross-device peer discovery, and an ultra-smooth glassmorphism Vision Studio interface.

[![Repository](https://img.shields.io/badge/GitHub-OptiCore-8A2BE2?logo=github)](https://github.com/Dharshankumar8197/OptiCore)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20PyTorch-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Web-Next.js%2016-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Desktop-2496ED?logo=docker)](https://www.docker.com/)

---

## ⚡ 1-Line Remote Backend Deployment (Any System)

Run this single command on **any machine** (Windows, Linux, macOS, or Cloud VPS) to automatically pull or build the OptiCore Backend container, mount storage, and expose a secure public HTTPS Ngrok tunnel:

### Linux / macOS / Cloud VPS:
```bash
curl -sSL https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/deploy_backend.sh | bash -s -- --authtoken YOUR_NGROK_AUTHTOKEN
```

### Windows (PowerShell):
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

> **Public Access**: When started with `NGROK_AUTHTOKEN`, the container prints your live HTTPS URL (e.g. `https://xxxx.ngrok-free.app`), allowing mobile and remote devices to securely stream camera feeds and access the model.

---

## 🚀 Deploy Web App to Vercel

The Vision Studio web app is built with **Next.js 16** and deploys to **Vercel** seamlessly:

1. Go to [Vercel](https://vercel.com/new) and import your repository: `https://github.com/Dharshankumar8197/OptiCore`
2. In Project Settings, set **Root Directory** to: `web`
3. Add Environment Variable:
   * **`NEXT_PUBLIC_API_URL`**: Your backend URL (e.g. your Ngrok HTTPS tunnel URL)
4. Click **Deploy**!

*(See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for full walkthrough and CLI commands).*

---

## ⚡ Instant 1-Second Startup (Second Time & Beyond)

Your Ngrok Authtoken is **automatically saved** on first entry, so you never have to type it again. To start or resume the backend anytime:

```powershell
.\start_backend.ps1
```
*Starts the backend in ~1 second, prints your active Ngrok HTTPS URL, and automatically pops open the live inference logs window.*

---

## 💾 Zero-Config SQLite Database

**No external database server installation required!**
- OptiCore uses an embedded SQLite database engine (`data/opticore.db`).
- The directory and all database tables (`users`, `devices`, `model_configs`, `telemetry_logs`) are **created automatically** on initial backend startup.
- In Docker, data is persisted across restarts via the volume mount (`./backend/data` or `opticore_data`).

---

## ⚙️ PowerShell Environment Configuration

Easily inspect and edit your environment variables directly from PowerShell:

```powershell
# In your local repository:
.\env.ps1

# Or on ANY computer (even without cloning the repo):
irm https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/open_env.ps1 | iex
```

On any standalone system, persistent settings are stored in **`~/.opticore/.env`** and automatically injected into the Docker container via `--env-file`.

---

## 📜 Live Container Logs

View and stream real-time inference and server logs anytime:

```powershell
# Pop open live logs in a separate dedicated PowerShell window:
.\logs.ps1 -NewWindow

# Or stream logs directly in current terminal:
.\logs.ps1
```

---

## 🐳 Running with Docker Desktop

1. Start **Docker Desktop** on your PC.
2. In the repository root, run:

```powershell
.\run_docker.ps1
```
*Or via Docker Compose:*
```bash
docker compose up --build
```

### Endpoints:
| Service | URL | Purpose |
| :--- | :--- | :--- |
| **Vision Studio Web** | `http://localhost:3000` | Real-time AI Vision Studio & Testing Interface |
| **Backend API** | `http://localhost:8000` | FastAPI Inference & Hardware Gateway |
| **Interactive Docs** | `http://localhost:8000/docs` | Swagger UI for all REST & Detection endpoints |
| **Ngrok Tunnel Inspector** | `http://localhost:4040` | Live public HTTPS tunnel logs & active URLs |

---

## 🔬 Testing the AI Model (`best.pt`)

Open the **MODEL** tab in the web interface:

1. **⚡ 1-Click Presets**: Instant evaluation on curated scenes (*Tech Desk*, *Urban Avenue*, *Road Junction*).
2. **📁 File Upload**: Drag and drop any image or frame for immediate inference.
3. **📹 Live Camera**:
   - Access webcams or mobile cameras (via front/rear lens toggle).
   - Single-shot **Detect Frame** or continuous **Auto-Scan** (1–10 FPS).
   - High-precision telemetry: Preprocess, Inference, and Postprocess latency (ms) with hardware-accelerated, jitter-free bounding box tracking.

---

## 🌐 OptiCore Device Mesh (Peer Discovery)

Navigate to the **CONNECTIVITY** tab:
- **Device Mesh**: Automatically lists other devices running the OptiCore app (Mobile, Pi, edge cameras) connected to the local network or backend.
- **Remote Camera Request**: Handshake camera feeds from peer devices to pipe their video streams into the inference engine.
- **Bluetooth & USB**: Pair peripherals, inspect USB cameras, and run TTS audio checks.

---

## 🛠️ Local Development (Without Docker)

### Backend:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Web App:
```powershell
cd web
npm install
npm run dev
```

---

## 📁 Repository Structure

```
OptiCore/
├── backend/                  # FastAPI inference engine & SQLite database
│   ├── app/                  # REST routers, YOLO inference, auth, and database models
│   ├── models/               # PyTorch model weights (best.pt)
│   ├── Dockerfile            # Standard multi-stage container
│   ├── Dockerfile.standalone # Self-contained container bundled with Ngrok CLI
│   └── entrypoint.sh         # Production container supervisor
├── web/                      # Next.js 16 Vision Studio
│   ├── src/components/       # Glassmorphism UI, CameraViewport, and tab modules
│   └── src/lib/              # API clients and WebSocket streaming handlers
├── deploy_backend.sh         # 1-line Linux/macOS deployment script
├── deploy_backend.ps1        # 1-line Windows PowerShell deployment script
├── run_docker.ps1            # 1-click Docker Desktop launcher
├── open_env.ps1              # Environment configuration helper
└── docker-compose.yml        # Orchestration for Web, Backend, and Ngrok
```

---

## 📄 License
MIT © [Dharshankumar8197](https://github.com/Dharshankumar8197)
