-- Quick Fix: Add missing is_active column to users table
-- Run this in Supabase SQL Editor if the schema didn't fully apply

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Verify the column exists
SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='is_active';
