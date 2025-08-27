-- Add missing auth/invite related columns used by the app into users_unified
ALTER TABLE IF EXISTS users_unified
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS authorization_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS authorization_max_uses INTEGER,
  ADD COLUMN IF NOT EXISTS authorization_uses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authorized_by TEXT,
  ADD COLUMN IF NOT EXISTS authorization_notes JSONB;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_unified_invite_code ON users_unified(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_unified_authorization_expires_at ON users_unified(authorization_expires_at);
