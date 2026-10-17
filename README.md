# OptiCore

OptiCore is an AI-powered assistive computer-vision platform. It combines real-time object detection, device management, and a premium glassmorphism interface for vision intelligence control.

---

## 🌐 1-Line Remote Backend Deployment (Any System)

Run this single command on **any system** (Linux VPS, Ubuntu, Debian, macOS, or Cloud Server) to download, start the OptiCore Backend container with `best.pt`, and instantly expose a public HTTPS Ngrok tunnel:

```bash
curl -sSL https://raw.githubusercontent.com/Dharshankumar8197/OptiiCore/main/deploy_backend.sh | bash -s -- --authtoken YOUR_NGROK_AUTHTOKEN
```

On **Windows PowerShell**:

```powershell
irm https://raw.githubusercontent.com/Dharshankumar8197/OptiiCore/main/deploy_backend.ps1 | iex
```

### Direct Docker Run:

```bash
docker run -d \
  --name opticore-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -p 4040:4040 \
  -e NGROK_AUTHTOKEN="your_token" \
  ghcr.io/dharshankumar8197/optiicore-backend:latest
```

Once running, the container outputs your **Public HTTPS URL** (e.g. `https://xxxx.ngrok-free.app`).

Simply connect your **Web App** (`web/.env.local`) or **Mobile App** to this server:
```env
NEXT_PUBLIC_API_URL=https://xxxx.ngrok-free.app
NEXT_PUBLIC_WS_URL=wss://xxxx.ngrok-free.app
```

---

## Project Structure

```
OptiCore/
│
├── web/                    # Next.js web application (Vision Lab + Device Control)
├── mobile/                 # React Native mobile app (Expo)
├── backend/                # FastAPI backend (inference, auth, database)
└── pi/                     # Raspberry Pi runtime (future development)
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend runs at: `http://localhost:8000`
API Docs: `http://localhost:8000/docs`

### Web Setup

```bash
cd web
npm install
npm run dev
```

Web runs at: `http://localhost:3000`

### Mobile Setup

```bash
cd mobile
npm install
npx expo start
```

## Features

- **Real-time Vision**: Live camera feed with AI object detection
- **Device Management**: Connect and manage cameras, Bluetooth, and Wi-Fi devices
- **Model Testing**: Upload images/videos or test live camera feeds with YOLO inference
- **Premium UI**: Glassmorphism design with frosted glass cards and atmospheric effects
- **Authentication**: Secure JWT-based authentication system
- **Database**: SQLAlchemy ORM with SQLite (development) / PostgreSQL (production)

## Technology Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLAlchemy + Alembic migrations
- **AI/ML**: Ultralytics YOLO
- **Vision**: OpenCV
- **Auth**: JWT + Argon2/bcrypt
- **Bluetooth**: Bleak
- **WebSocket**: FastAPI WebSocket support

### Web
- **Framework**: Next.js
- **UI**: Tailwind CSS + shadcn/ui
- **Animation**: Framer Motion
- **Icons**: Lucide React

### Mobile
- **Framework**: React Native
- **Platform**: Expo
- **Camera**: expo-camera
- **Navigation**: React Navigation

## Database

The database schema includes:

- `users` - User accounts and authentication
- `sessions` - JWT session tracking
- `devices` - Connected devices (cameras, sensors, etc.)
- `camera_sources` - Camera feed definitions
- `models` - AI models (best.pt, etc.)
- `model_configs` - Inference configuration
- `inference_sessions` - Model testing history
- `detection_events` - Detection metadata
- `device_events` - Device connection events
- `bluetooth_devices` - Paired Bluetooth devices
- `wifi_devices` - Wi-Fi connected devices

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Vision & Inference
- `GET /api/model` - Get model status
- `POST /api/inference/image` - Run inference on image
- `POST /api/inference/video` - Run inference on video
- `WS /ws/inference` - WebSocket for live inference stream

### Devices
- `GET /api/devices` - List connected devices
- `GET /api/cameras` - List available camera sources
- `GET /api/bluetooth/devices` - List Bluetooth devices
- `POST /api/bluetooth/scan` - Scan for Bluetooth devices
- `GET /api/wifi/devices` - List Wi-Fi devices

### System
- `GET /health` - Health check
- `GET /api/status` - System status

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
ENVIRONMENT=development
DATABASE_URL=sqlite:///./data/opticore.db
JWT_SECRET_KEY=your-secret-key
MODEL_PATH=./models/best.pt
CONFIDENCE_THRESHOLD=0.50
ENABLE_BLUETOOTH=true
ENABLE_WEBRTC=true
```

## Development

### Running all services locally

Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Terminal 2 - Web:
```bash
cd web
npm run dev
```

Terminal 3 - Mobile:
```bash
cd mobile
npx expo start
```

### Testing

Backend tests:
```bash
cd backend
pytest
```

## Vision Lab Interface

The main web application (`/dashboard`) provides:

- **Vision**: Real-time camera feed with AI detection overlays
- **Camera**: Manage and connect camera sources
- **Devices**: Connected device status and control
- **Bluetooth**: Scan and pair Bluetooth devices
- **Wi-Fi**: Discover OptiCore devices on network
- **Model**: Configure and test YOLO inference
- **Status**: System health and performance metrics
- **Settings**: User preferences and configuration

## Design

The interface uses a premium glassmorphism aesthetic:

- Dark atmospheric background with floating 3D geometric objects
- Frosted glass cards with backdrop blur
- Thin translucent borders
- Soft shadows and subtle reflections
- Purple/blue ambient lighting
- Large elegant typography
- Smooth Framer Motion animations

## Security

- Passwords hashed with Argon2/bcrypt
- JWT-based session authentication
- Input validation and CORS protection
- Protected dashboard routes
- No arbitrary device access

## Future Development

- **Raspberry Pi Runtime**: Optimized inference on Pi Zero/Pi 4
- **Advanced Tracking**: Multi-object tracking with ID persistence
- **Cloud Integration**: Connect multiple devices to cloud backend
- **Mobile Camera**: Phone acts as remote camera via Wi-Fi/Bluetooth
- **Custom Models**: Support for user-uploaded YOLO models
- **Analytics**: Detection statistics and performance monitoring

## License

Proprietary - OptiCore

## Contact

For questions or support, contact the OptiCore development team.
