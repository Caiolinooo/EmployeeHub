-- Widen access_history columns to prevent value too long errors
-- Safe to run multiple times

BEGIN;

-- Some environments may have created these columns as VARCHAR(50). Ensure TEXT.
ALTER TABLE IF EXISTS access_history
  ALTER COLUMN action TYPE TEXT,
  ALTER COLUMN details TYPE TEXT,
  ALTER COLUMN ip_address TYPE TEXT,
  ALTER COLUMN user_agent TYPE TEXT;

COMMIT;
