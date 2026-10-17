# OptiCore Backend - Quick Local Setup Script
# This script sets up SQLite database for local development

Write-Host "=== OptiCore Backend Setup ===" -ForegroundColor Green
Write-Host ""

# Step 1: Create data directory
Write-Host "Step 1: Creating data directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path ".\data" -ErrorAction SilentlyContinue | Out-Null
Write-Host "✓ Data directory created" -ForegroundColor Green
Write-Host ""

# Step 2: Create virtual environment if not exists
Write-Host "Step 2: Setting up Python virtual environment..." -ForegroundColor Cyan
if (!(Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Creating new venv..."
    python -m venv venv
}
Write-Host "✓ Virtual environment ready" -ForegroundColor Green
Write-Host ""

# Step 3: Install dependencies
Write-Host "Step 3: Installing dependencies..." -ForegroundColor Cyan
Write-Host "(This may take 2-3 minutes on first run)"
.\venv\Scripts\python.exe -m pip install -q --upgrade pip setuptools wheel
.\venv\Scripts\python.exe -m pip install -q -r requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Installation failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Create database tables
Write-Host "Step 4: Creating database tables..." -ForegroundColor Cyan
.\venv\Scripts\python.exe << 'EOF'
from app.database import Base, engine
from app.database.models import User, Device, Model, CameraSource, Session, ModelConfig, InferenceSession, DetectionEvent, DeviceEvent, BluetoothDevice, WiFiDevice

try:
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")
    print(f"✓ Database file: data/opticore.db")
except Exception as e:
    print(f"✗ Error creating tables: {e}")
    exit(1)
EOF

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start backend:"
Write-Host "   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor Gray
Write-Host ""
Write-Host "2. In another terminal, test the backend:"
Write-Host "   curl http://localhost:8000/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. View API documentation:"
Write-Host "   http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Start frontend (in web/ folder):"
Write-Host "   npm install && npm run dev" -ForegroundColor Gray
Write-Host ""
