# 🚀 START HERE - Supabase Setup

## You have the SQL schema file ready to go!

**File:** `database/schema.sql`

This file contains the complete database schema for OptiCore - all 11 tables with proper indexes, constraints, and default data.

---

## QUICK SETUP (5 minutes)

### 1. Create Supabase Project
Go to https://supabase.com and create a new project

### 2. Get Your Connection String
```
Dashboard → Settings → Database → Connection String (PostgreSQL tab)
Copy: postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
```

### 3. Run the SQL Schema
```
Dashboard → SQL Editor → New Query
Copy entire contents of: database/schema.sql
Paste into editor
Click "Run"
```

### 4. Update Backend Config
Edit file: `.env`
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres
```

### 5. Start Backend
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

✅ Done! Backend is running

---

## FULL DOCUMENTATION

### Choose your learning style:

**⏱️ 3 Minutes?**
→ Read: `../SUPABASE_QUICKSTART.md`

**📋 10 Minutes?**
→ Read: `SUPABASE_STEPS.md`

**📚 Complete Reference?**
→ Read: `DATABASE_SETUP.md`

---

## FILES IN THIS DIRECTORY

```
backend/
├── database/
│   └── schema.sql              ← RUN THIS IN SUPABASE
├── START_HERE.md               ← You are here
├── SUPABASE_STEPS.md           ← Detailed walkthrough
├── DATABASE_SETUP.md           ← Complete reference
├── requirements.txt            ← pip install this
├── .env                        ← Configure this
└── app/
    ├── main.py                 ← FastAPI app
    ├── config.py               ← Settings
    ├── auth/                   ← Authentication
    ├── api/                    ← API endpoints
    ├── database/               ← Database models
    └── schemas/                ← Data validation
```

---

## WHAT YOU'RE GETTING

✅ **11 Database Tables**
- users, sessions, devices, cameras
- models, model configs, inference sessions
- detection events, device events
- bluetooth devices, wifi devices

✅ **20+ API Endpoints**
- User registration & login
- Device management
- Model inference
- System status

✅ **Security Built-In**
- Argon2 password hashing
- JWT authentication
- Session tracking
- Input validation

---

## VERIFY IT WORKS

After backend starts:

```bash
# Test health endpoint
curl http://localhost:8000/health

# View API documentation
# Open browser: http://localhost:8000/docs
```

---

## NEXT PHASE: WEB FRONTEND

Once backend is confirmed working:

```bash
cd web
npm install
npm run dev
```

Frontend (Next.js + glassmorphism design) will be at: http://localhost:3000

---

## NEED HELP?

1. **Can't connect to Supabase?**
   → Check DATABASE_URL in .env
   → Verify password is correct
   → See DATABASE_SETUP.md → Troubleshooting

2. **SQL won't run?**
   → Schema uses standard PostgreSQL
   → Just copy-paste the entire schema.sql file
   → Click "Run" - it will handle dependencies

3. **Backend won't start?**
   → Make sure venv is activated
   → Run: pip install -r requirements.txt
   → Check port 8000 is available

---

## TL;DR - 3 Steps

1. **Copy:** `database/schema.sql` → paste in Supabase SQL Editor → Run
2. **Configure:** `backend/.env` with your Supabase connection string
3. **Start:** `python -m uvicorn app.main:app --port 8000`

That's it! Backend is ready.

---

**Everything is built. Time to deploy!** 🚀
