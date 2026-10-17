# Supabase Setup - Step by Step

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click **"New Project"**
3. Enter:
   - **Name:** OptiCore
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
4. Click **"Create new project"**
5. Wait 1-2 minutes for the database to initialize

## Step 2: Get Connection String

1. Go to **Settings** (bottom left) → **Database**
2. Look for **"Connection String"** section
3. Click the **"Postgresql"** tab
4. Click **Copy** button (or manually copy the string)

Format will be:
```
postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
```

**Save this somewhere safe - you'll need it next**

## Step 3: Run the SQL Schema

### Method A: SQL Editor (Easiest)

1. Go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open file: `backend/database/schema.sql`
4. Copy **entire contents**
5. Paste into the SQL editor window
6. Click **"Run"** (or Ctrl+Enter)
7. Wait for green checkmark ✓

### Method B: Using psql (if you have it installed)

```bash
# Replace PASSWORD and PROJECT with your actual values
psql "postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres" < backend/database/schema.sql
```

## Step 4: Verify Tables Created

1. Go to **Table Editor** (left sidebar)
2. You should see these tables:
   - ✓ users
   - ✓ sessions
   - ✓ devices
   - ✓ camera_sources
   - ✓ models
   - ✓ model_configs
   - ✓ inference_sessions
   - ✓ detection_events
   - ✓ device_events
   - ✓ bluetooth_devices
   - ✓ wifi_devices

If all 11 tables appear → Success! ✅

## Step 5: Configure Backend

1. Edit file: `backend/.env`
2. Update DATABASE_URL:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres
```

Example:
```env
DATABASE_URL=postgresql://postgres:my_secure_password@opticore-xyz.supabase.co:5432/postgres
```

3. Keep JWT_SECRET_KEY as is (or change for production)

## Step 6: Install Python Dependencies

```bash
cd backend

# Create virtual environment (if not done)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

Takes ~2 minutes for first install

## Step 7: Test Connection

```bash
cd backend

# Activate venv (if not already active)
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Run a quick Python test
python << EOF
from app.database import engine, SessionLocal
from app.database.models import User

# Test connection
try:
    connection = engine.connect()
    connection.close()
    print("✅ Connected to Supabase successfully!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
EOF
```

Should print: `✅ Connected to Supabase successfully!`

## Step 8: Start Backend Server

```bash
cd backend

# Activate venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Start server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Output will be:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

## Step 9: Test Backend

In a new terminal:

```bash
# Test health endpoint
curl http://localhost:8000/health

# Should return:
# {
#   "status": "ok",
#   "database": "ok",
#   "model_loaded": false,
#   "model_status": "available"
# }
```

Or open browser:
- **API Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Step 10: Test Registration

Using curl or Postman:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "SecurePassword123"
  }'
```

Should return:
```json
{
  "id": "uuid-here",
  "full_name": "Test User",
  "email": "test@example.com",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00",
  "last_login_at": null
}
```

## Step 11: Test Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123"
  }'
```

Should return:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

## Done! ✅

Your OptiCore backend is now:
- ✅ Connected to Supabase PostgreSQL
- ✅ Running on http://localhost:8000
- ✅ Ready to accept API requests
- ✅ Authenticating users with JWT

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Connection refused** | Check DATABASE_URL in .env is correct |
| **psycopg2 error** | `pip install psycopg2-binary` |
| **Module not found** | Make sure venv is activated before pip install |
| **Port 8000 in use** | Use different port: `--port 8001` |
| **401 Unauthorized** | Get new token from login endpoint |

## Next: Start Web Frontend

Once backend is confirmed working:

```bash
cd web
npm install
npm run dev
```

Frontend will be at: http://localhost:3000

---

**Backend is ready!** Proceed to Web Frontend development.
