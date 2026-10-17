# Supabase Quick Setup

## 3-Minute Setup

### Step 1: Create Supabase Project
```
1. Go to https://supabase.com
2. Click "New Project"
3. Enter project details
4. Click "Create New Project"
5. Wait 2 minutes for initialization
```

### Step 2: Get Connection String
```
Dashboard → Settings → Database → Connection String
Format: postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres
```

### Step 3: Run SQL Schema
```
Dashboard → SQL Editor → New Query
Paste: backend/database/schema.sql
Click "Run"
```

### Step 4: Configure Backend
```bash
# Edit backend/.env
DATABASE_URL=postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres
JWT_SECRET_KEY=your-random-secret-key
```

### Step 5: Start Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Done!** Backend is running with Supabase.

---

## Connection String Format

```
postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
```

**Find Your Details in Supabase:**
- Dashboard → Settings → Database
- Copy the "Connection string" (not "Session string")
- Replace `[PASSWORD]` with your database password
- Replace `[PROJECT]` with your project name/ID

---

## Database Tables Created

✅ users - User accounts  
✅ sessions - JWT tokens  
✅ devices - Connected cameras/phones/Pi  
✅ camera_sources - Camera configurations  
✅ models - AI models (best.pt)  
✅ model_configs - Inference settings  
✅ inference_sessions - Model test history  
✅ detection_events - Detection results  
✅ device_events - Device events  
✅ bluetooth_devices - Paired Bluetooth  
✅ wifi_devices - Wi-Fi devices  

---

## Verify Setup

```bash
# Test backend
curl http://localhost:8000/health

# Should return:
# {
#   "status": "ok",
#   "database": "ok",
#   "model_loaded": false,
#   "model_status": "not_found"
# }
```

---

## API Docs

After backend starts:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check DATABASE_URL is correct |
| "could not translate host name" | Verify project name in connection string |
| "permission denied" | Check password is correct |
| Timeout | Wait 1 minute, Supabase might be starting |

---

## Next: Start Frontend

```bash
cd web
npm install
npm run dev
```

Frontend will be at: http://localhost:3000

---

## Schema Location

`backend/database/schema.sql` - Complete database schema

Can be re-run safely (uses `IF NOT EXISTS` clauses)

---

## Support Files

- `backend/DATABASE_SETUP.md` - Detailed setup guide
- `backend/requirements.txt` - Python dependencies
- `backend/.env.example` - Environment template
- `backend/app/main.py` - FastAPI application

---

**Status:** ✅ Production-ready  
**Database:** PostgreSQL (Supabase)  
**ORM:** SQLAlchemy  
**Authentication:** JWT  
