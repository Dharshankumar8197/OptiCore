#!/bin/bash

# OptiCore Backend - Quick Local Setup Script
# This script sets up SQLite database for local development

echo "=== OptiCore Backend Setup ==="
echo ""

# Step 1: Create data directory
echo "Step 1: Creating data directory..."
mkdir -p ./data
echo "✓ Data directory created"
echo ""

# Step 2: Create virtual environment if not exists
echo "Step 2: Setting up Python virtual environment..."
if [ ! -f "./venv/bin/python" ]; then
    echo "Creating new venv..."
    python3 -m venv venv
fi
echo "✓ Virtual environment ready"
echo ""

# Step 3: Install dependencies
echo "Step 3: Installing dependencies..."
echo "(This may take 2-3 minutes on first run)"
source ./venv/bin/activate
pip install -q --upgrade pip setuptools wheel
pip install -q -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "✗ Installation failed"
    exit 1
fi
echo ""

# Step 4: Create database tables
echo "Step 4: Creating database tables..."
python << 'EOF'
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

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Start backend:"
echo "   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "2. In another terminal, test the backend:"
echo "   curl http://localhost:8000/health"
echo ""
echo "3. View API documentation:"
echo "   http://localhost:8000/docs"
echo ""
echo "4. Start frontend (in web/ folder):"
echo "   npm install && npm run dev"
echo ""
