-- Add tax_id column to users_unified table for CPF/CNPJ storage
-- This migration is safe to run multiple times

BEGIN;

-- Add tax_id column if it doesn't exist
ALTER TABLE IF EXISTS users_unified
  ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Add index for tax_id for better performance on searches
CREATE INDEX IF NOT EXISTS idx_users_unified_tax_id ON users_unified(tax_id);

-- Add comment to document the column purpose
COMMENT ON COLUMN users_unified.tax_id IS 'CPF/CNPJ or other tax identification number';

COMMIT;
