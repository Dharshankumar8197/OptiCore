# Database Setup Summary

## 📋 You Have Multiple Setup Options

### ⚡ Option 1: Automated Setup (RECOMMENDED)

**Windows:**
```powershell
cd backend
.\setup_local.ps1
```

**macOS/Linux:**
```bash
cd backend
bash setup_local.sh
```

This script automatically:
- ✅ Creates `data/` directory
- ✅ Sets up Python virtual environment
- ✅ Installs all dependencies
- ✅ Creates SQLite database
- ✅ Creates all 11 tables

**Time: ~5 minutes**

---

### 📝 Option 2: Manual Setup

```bash
cd backend

# Step 1: Create data directory
mkdir data

# Step 2: Create virtual environment
python -m venv venv

# Step 3: Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Step 4: Install dependencies
pip install -r requirements.txt

# Step 5: Create database tables
python << 'EOF'
from app.database import Base, engine
from app.database.models import (
    User, Device, Model, CameraSource, Session, 
    ModelConfig, InferenceSession, DetectionEvent, 
    DeviceEvent, BluetoothDevice, WiFiDevice
)
Base.metadata.create_all(bind=engine)
print("✓ Database created!")
EOF
```

**Time: ~10 minutes**

---

### 🌐 Option 3: Use Supabase (Cloud)

See: `SUPABASE_QUICKSTART.md` or `SUPABASE_STEPS.md`

**Time: ~15 minutes**

---

## ✅ Verify Setup is Complete

```bash
cd backend

# Check if database file exists
ls -la data/
# Should show: opticore.db

# Test the database connection
python -c "from app.database import engine; engine.connect(); print('✓ Database connected!')"
```

---

## 🚀 Start the Backend

```bash
cd backend

# Activate virtual environment (if not already active)
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Start the backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

---

## ✨ Verify Backend Works

In a new terminal:

```bash
# Test health endpoint
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "ok",
  "database": "ok",
  "model_loaded": false,
  "model_status": "available"
}
```

Or open in browser:
- **API Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## 📊 Database Contents

### 11 Tables Created:
1. **users** - User accounts
2. **sessions** - JWT token tracking
3. **devices** - Connected devices
4. **camera_sources** - Camera configurations
5. **models** - AI models
6. **model_configs** - Model settings
7. **inference_sessions** - Test history
8. **detection_events** - Detection results
9. **device_events** - Device events
10. **bluetooth_devices** - BT pairing
11. **wifi_devices** - Wi-Fi devices

### Database File:
```
backend/data/opticore.db
```

Size: ~1 MB (SQLite is lightweight!)

---

## 🔧 Configuration

**File:** `backend/.env`

Current settings:
```env
DATABASE_URL=sqlite:///./data/opticore.db
JWT_SECRET_KEY=opticore-dev-secret-key-change-in-production-12345
PORT=8000
```

### To Switch to Supabase:
```env
DATABASE_URL=postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres
```

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"No such file: venv"** | Run: `python -m venv venv` |
| **"No module named venv"** | Install: `pip install virtualenv` then `python -m venv venv` |
| **"Port 8000 in use"** | Use different port: `--port 8001` |
| **"No such table: users"** | Re-run the table creation script |
| **"Module not found"** | Activate venv: `venv\Scripts\activate` |
| **Connection string error** | Check .env DATABASE_URL is correct |

---

## 📁 Files Used

- **`setup_local.ps1`** - PowerShell setup script
- **`setup_local.sh`** - Bash setup script
- **`requirements.txt`** - Python dependencies
- **`.env`** - Configuration file
- **`schema.sql`** - Database schema (for Supabase)
- **`fix_schema.sql`** - Fix missing columns

---

## 🎯 Next Steps

1. ✅ Setup database (using one of the options above)
2. ✅ Start backend
3. ⬜ Start frontend:
   ```bash
   cd web
   npm install
   npm run dev
   ```
4. ⬜ Open http://localhost:3000

---

## 💡 Pro Tips

1. **Keep venv activated** - You'll need it for all backend commands
2. **Check port 8000** - If in use, try --port 8001
3. **Save your .env** - Don't commit it to git!
4. **Test with /docs** - Interactive API testing at localhost:8000/docs
5. **Use SQLite first** - Easy to test locally, switch to Supabase later

---

## 📞 Quick Reference

| Command | Purpose |
|---------|---------|
| `.\setup_local.ps1` | Auto-setup (Windows) |
| `bash setup_local.sh` | Auto-setup (Unix) |
| `python -m venv venv` | Create environment |
| `venv\Scripts\activate` | Activate (Windows) |
| `source venv/bin/activate` | Activate (Unix) |
| `pip install -r requirements.txt` | Install packages |
| `python -m uvicorn app.main:app --port 8000` | Start backend |
| `curl http://localhost:8000/health` | Test backend |
| `http://localhost:8000/docs` | API documentation |

---

**Recommended: Use the automated setup script!** ⚡

It handles everything in ~5 minutes.
