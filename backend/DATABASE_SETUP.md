# OptiCore Database Setup Guide

OptiCore uses **Supabase PostgreSQL** for the production database.

## Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to initialize
4. Navigate to **Settings > Database > Connection String**

### 2. Get Your Connection String

Connection string format:
```
postgresql://postgres:[YOUR_PASSWORD]@[YOUR_PROJECT].supabase.co:5432/postgres
```

Where:
- `[YOUR_PASSWORD]` - Password you set when creating the project
- `[YOUR_PROJECT]` - Your project's unique ID

### 3. Run the Schema

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `schema.sql`
4. Paste into the SQL editor
5. Click **Run**

The schema will:
- Create all required tables
- Set up indexes for performance
- Create triggers for automatic `updated_at` timestamps
- Insert the default model (best.pt)

### 4. Configure Backend

Update `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres
JWT_SECRET_KEY=your-secure-random-key
```

### 5. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 6. Run Backend

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will connect to Supabase automatically.

## Database Tables

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `sessions` | JWT session tracking |
| `devices` | Connected devices (cameras, phones, Pi, sensors) |
| `camera_sources` | Camera feed configurations |
| `models` | AI models (best.pt, etc.) |
| `model_configs` | Model inference settings |
| `inference_sessions` | Model testing history |
| `detection_events` | Detection results metadata |
| `device_events` | Device connection/error events |
| `bluetooth_devices` | Paired Bluetooth devices |
| `wifi_devices` | Wi-Fi connected devices |

### Relationships

```
User
  ├── Sessions (1:N)
  ├── Devices (1:N)
  └── Inference Sessions (1:N)

Device
  ├── Camera Sources (1:N)
  ├── Device Events (1:N)
  ├── Inference Sessions (1:N)
  ├── Bluetooth Devices (1:N)
  └── Wi-Fi Devices (1:N)

Model
  ├── Model Configs (1:N)
  └── Inference Sessions (1:N)

Inference Session
  └── Detection Events (1:N)
```

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Devices
```
GET  /api/devices
POST /api/devices
GET  /api/devices/{device_id}
GET  /api/devices/{device_id}/cameras
POST /api/devices/{device_id}/cameras
```

### Model
```
GET  /api/model
GET  /api/model/config
PUT  /api/model/config
GET  /api/model/sessions
```

### System
```
GET  /health
GET  /api/status
GET  /api/cameras
GET  /api/bluetooth/devices
POST /api/bluetooth/scan
GET  /api/wifi/devices
```

## Supabase Features to Use

### 1. Row Level Security (Optional)

Enable RLS to restrict user access to their own data:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_sessions ENABLE ROW LEVEL SECURITY;

-- User can only see their own devices
CREATE POLICY "Users can view own devices"
  ON devices FOR SELECT
  USING (user_id = auth.uid());
```

### 2. Backups

Supabase automatically backs up your database. Access backups in:
**Settings > Backups**

### 3. Database Webhooks

Use Supabase Webhooks to trigger functions on data changes:
**Database > Webhooks**

Example: Notify frontend when a device comes online

### 4. Authentication

You can optionally use Supabase Auth instead of JWT:
**Settings > Authentication**

However, the current implementation uses JWT tokens stored in `sessions`.

## Troubleshooting

### Connection Error: "could not translate host name"
- Check your connection string
- Ensure you're using the correct project ID
- Try the "Connection string" from Supabase (not "Session string")

### Timeout on First Run
- Supabase might be spinning up the database
- Wait 30 seconds and retry
- Check Supabase dashboard status

### Schema Already Exists
- The SQL includes `IF NOT EXISTS` clauses
- Safe to run multiple times
- Will skip creation of existing tables

### Need to Clear Database
```sql
DROP TABLE IF EXISTS wifi_devices CASCADE;
DROP TABLE IF EXISTS bluetooth_devices CASCADE;
DROP TABLE IF EXISTS device_events CASCADE;
DROP TABLE IF EXISTS detection_events CASCADE;
DROP TABLE IF EXISTS inference_sessions CASCADE;
DROP TABLE IF EXISTS model_configs CASCADE;
DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS camera_sources CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Then re-run `schema.sql` to recreate all tables.

## Performance Tips

1. **Indexes**: Schema includes optimal indexes for common queries
2. **Connection Pooling**: Use PgBouncer in Supabase for high concurrency
3. **Backup**: Enable Point-in-Time Recovery (PITR) in Settings

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run schema.sql
3. ✅ Configure .env
4. ✅ Start backend
5. ⬜ Register first user
6. ⬜ Build web frontend
7. ⬜ Connect mobile app
