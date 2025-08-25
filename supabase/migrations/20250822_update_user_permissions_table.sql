-- Add a new column for referencing users_unified
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS user_unified_id UUID;

-- Update the new column with the existing user_id values
-- (We'll update these to point to the users_unified table in the data migration script)
UPDATE user_permissions SET user_unified_id = user_id WHERE user_unified_id IS NULL;

-- Drop the old foreign key constraint
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

-- Add the new foreign key constraint referencing users_unified
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_unified_id_fkey 
  FOREIGN KEY (user_unified_id) REFERENCES users_unified(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_unified_id ON user_permissions(user_unified_id);