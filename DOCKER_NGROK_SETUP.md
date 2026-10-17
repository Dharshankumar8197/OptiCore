# OptiCore — Docker Desktop & Ngrok Setup Guide

This guide walks you through running OptiCore with **Docker Desktop** and **Ngrok** for public HTTPS testing, mobile camera streaming, and real-time AI model testing.

---

## 🚀 Quick Start (Docker Desktop)

### Prerequisites
1. **Docker Desktop** installed on your machine.
2. Start Docker Desktop from your Windows Start Menu (wait for the whale tray icon to become steady green).

### 1. Launch with One Command
Open PowerShell in the project root and run:

```powershell
.\run_docker.ps1
```

Or manually with Docker Compose:

```bash
docker compose up --build
```

### 2. Access the Applications

| Component | URL | Description |
| :--- | :--- | :--- |
| **OptiCore Web App** | `http://localhost:3000` | Smooth Vision Lab & AI Testing Studio |
| **FastAPI Backend** | `http://localhost:8000` | Inference Engine & Device APIs |
| **API Interactive Docs** | `http://localhost:8000/docs` | Swagger UI for all API endpoints |
| **Ngrok Web Inspector** | `http://localhost:4040` | Live public HTTPS tunnel URLs & request logs |

---

## 🌐 Setting Up Ngrok for Mobile & Public Access

> [!IMPORTANT]
> **Why Ngrok is critical for Camera Testing:**
> Modern mobile browsers (iOS Safari, Android Chrome) strictly block camera access (`navigator.mediaDevices.getUserMedia`) over unencrypted `http://` IP addresses. Ngrok provides trusted **HTTPS URLs** so you can open OptiCore on your phone or external device and immediately access the camera!

### 1. Configure Your Free Ngrok AuthToken
1. Sign up for free at [ngrok.com](https://ngrok.com).
2. Copy your Auth Token from your dashboard.
3. Add it to your `.env` file in the root folder:
   ```env
   NGROK_AUTHTOKEN=your_token_here
   ```
   Or set it in PowerShell:
   ```powershell
   $env:NGROK_AUTHTOKEN="your_token_here"
   ```

### 2. Standalone Host Ngrok (Already Installed on your PC)
Since `ngrok version 3.22.1` is already installed on your machine, you can also run it directly without Docker:

```powershell
.\run_ngrok.ps1
```

This starts dual tunnels:
- **`web`**: Forwards public HTTPS to `localhost:3000`
- **`backend`**: Forwards public HTTPS to `localhost:8000`

Inspect your live public URLs at **`http://127.0.0.1:4040`**.

---

## 🧪 How to Test the AI Model (`best.pt`) in the Web App

Navigate to the **MODEL** page in the top navigation bar. You now have three testing modes:

### Mode 1: 1-Click Instant Presets
- Click the **"⚡ 1-Click Presets"** tab.
- Choose between **Tech Desk**, **Urban Avenue**, or **Road Junction**.
- The model immediately performs inference and displays:
  - Neon bounding boxes with class color coding.
  - Floating confidence percentages.
  - Latency breakdown: Preprocess, Inference, and Postprocess times (ms).
  - Target list with coordinates and copyable **Raw JSON Inspector**.

### Mode 2: Drag & Drop Custom Images
- Click the **"📁 Upload Image"** tab.
- Drag and drop any JPG, PNG, or WEBP file, or click to browse.
- The model runs inference automatically upon upload.

### Mode 3: Live Camera Feed (Webcam or Mobile Phone)
- Click the **"📹 Live Camera Feed"** tab.
- Allow camera permissions in the browser.
- Use **"⚡ Detect Frame"** for single-shot snapshot inference.
- Or toggle **"Start Auto-Scan"** for continuous real-time detection (configurable from 1 to 10 FPS).
- Use the **"↺ Lens"** button to toggle between front and rear lenses (ideal for mobile testing).

---

## ⚙️ Inference Parameter Controls

Adjust parameters on the right sidebar in real-time:
- **Confidence Threshold (10% - 95%)**: Controls detection sensitivity.
- **IoU Threshold (10% - 95%)**: Controls Non-Maximum Suppression overlap threshold.
- **Inference Resolution (320px - 1280px)**: Adjusts image input dimension for speed vs accuracy trade-offs.
- **Auto-Scan Sample Rate (1 - 10 FPS)**: Controls camera frame sampling frequency.

---

## 🛠️ Local Development (Without Docker)

If you prefer running directly in Python and Node:

### 1. Start Backend:
```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Web:
```powershell
cd web
npm run dev
```

### 3. Start Ngrok:
```powershell
.\run_ngrok.ps1
```
