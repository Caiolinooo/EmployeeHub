-- Add auth and verification related columns to users_unified
ALTER TABLE IF EXISTS users_unified
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS authorization_status TEXT NOT NULL DEFAULT 'pending' CHECK (authorization_status IN ('active','pending','rejected')),
  ADD COLUMN IF NOT EXISTS access_permissions JSONB,
  ADD COLUMN IF NOT EXISTS access_history JSONB;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_unified_email_verified ON users_unified(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_unified_phone_verified ON users_unified(phone_verified);
CREATE INDEX IF NOT EXISTS idx_users_unified_authorization_status ON users_unified(authorization_status);

-- Ensure updated_at continues to auto-update via trigger (created elsewhere)
-- No action needed if trigger already exists as per schema.sql
