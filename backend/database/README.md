# Database Schema

## schema.sql

This is the **complete database schema for OptiCore**.

### What It Does

Runs a single SQL script that creates:
- ✅ 11 PostgreSQL tables
- ✅ 30+ performance indexes
- ✅ Foreign key constraints
- ✅ Automatic timestamp triggers
- ✅ Default data (model entry)
- ✅ Validation constraints

### How to Use It

#### Option A: Supabase UI (Easiest)
```
1. Supabase Dashboard
2. SQL Editor → New Query
3. Copy entire contents of schema.sql
4. Paste into editor
5. Click "Run"
```

#### Option B: Command Line (psql)
```bash
psql "postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres" < schema.sql
```

#### Option C: Backend Auto-Create
The backend can auto-create tables on startup using SQLAlchemy if needed.

---

## Tables Created

| Table | Purpose |
|-------|---------|
| users | User accounts & authentication |
| sessions | JWT token tracking |
| devices | Connected devices (cameras, phones, etc) |
| camera_sources | Camera configurations |
| models | AI models (best.pt, etc) |
| model_configs | Inference settings |
| inference_sessions | Model testing history |
| detection_events | Detection results |
| device_events | Device connection events |
| bluetooth_devices | Paired Bluetooth devices |
| wifi_devices | Wi-Fi connected devices |

---

## Features

✅ **UUID Primary Keys** - Globally unique identifiers
✅ **Foreign Keys** - Referential integrity
✅ **Cascading Deletes** - Clean deletion
✅ **Indexes** - Query performance
✅ **Triggers** - Auto-update timestamps
✅ **Constraints** - Data validation
✅ **Default Values** - Sensible defaults

---

## Safety

✅ Uses `CREATE TABLE IF NOT EXISTS` - Safe to run multiple times
✅ No data loss - Won't drop existing tables
✅ Proper constraints - Prevents invalid data
✅ Triggers - Automatic maintenance

---

## Next Steps

1. Run this schema in Supabase
2. Verify all 11 tables are created
3. Configure `backend/.env` with connection string
4. Start the backend
5. Build the web frontend

---

**Total lines:** 400+
**PostgreSQL compatible:** Yes
**Supabase compatible:** Yes
**Production ready:** Yes
