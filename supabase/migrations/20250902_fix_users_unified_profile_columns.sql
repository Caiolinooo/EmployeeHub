-- Fix users_unified table structure for profile functionality
-- Add missing columns needed for profile system

-- Add missing columns for profile data and photo management
ALTER TABLE IF EXISTS users_unified
  ADD COLUMN IF NOT EXISTS profile_data JSONB,
  ADD COLUMN IF NOT EXISTS drive_photo_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Add helpful indexes for profile queries
CREATE INDEX IF NOT EXISTS idx_users_unified_drive_photo_id ON users_unified(drive_photo_id);
CREATE INDEX IF NOT EXISTS idx_users_unified_tax_id ON users_unified(tax_id);

-- Add comments for documentation
COMMENT ON COLUMN users_unified.profile_data IS 'Additional profile data stored as JSON';
COMMENT ON COLUMN users_unified.drive_photo_id IS 'Google Drive file ID for profile photo';
COMMENT ON COLUMN users_unified.drive_photo_url IS 'Google Drive public URL for profile photo';
COMMENT ON COLUMN users_unified.tax_id IS 'User tax identification number (CPF/CNPJ)';

-- Ensure the password_hash column exists (should already exist from previous migration)
-- This is a safety check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users_unified' 
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users_unified ADD COLUMN password_hash TEXT;
    END IF;
END $$;
