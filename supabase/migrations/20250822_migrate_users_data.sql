-- Migrate existing data from users table to users_unified table
-- We'll use a temporary table to map old user IDs to new user IDs
CREATE TEMP TABLE user_id_mapping (
  old_user_id UUID,
  new_user_id UUID
);

-- Insert all existing users into users_unified table
-- We'll preserve the original UUIDs to maintain referential integrity
INSERT INTO users_unified (
  id,
  email,
  first_name,
  last_name,
  phone_number,
  role,
  position,
  department,
  avatar,
  active,
  password_last_changed,
  created_at,
  updated_at
)
SELECT 
  id,
  email,
  first_name,
  last_name,
  phone_number,
  role,
  position,
  department,
  avatar,
  active,
  password_last_changed,
  created_at,
  updated_at
FROM users
ON CONFLICT (id) DO NOTHING;

-- Populate the mapping table with old and new user IDs
-- Since we're preserving the UUIDs, the mapping is 1:1
INSERT INTO user_id_mapping (old_user_id, new_user_id)
SELECT id, id FROM users;

-- Update user_permissions to use the new user_unified_id column
-- Since we preserved the UUIDs, we can directly map old user_id to user_unified_id
UPDATE user_permissions 
SET user_unified_id = user_id 
WHERE user_unified_id IS NULL;

-- Update the user_id column in user_permissions to reference users_unified
-- This maintains backward compatibility while we transition
UPDATE user_permissions 
SET user_id = user_unified_id;

-- Remove the old foreign key constraint if it still exists
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

-- Add the foreign key constraint to reference users_unified
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users_unified(id) ON DELETE CASCADE;

-- Drop the temporary mapping table
DROP TABLE IF EXISTS user_id_mapping;

-- Add a note that the old users table can be archived or removed in a future migration
-- This is just a comment, not an actual SQL command
-- COMMENT: The users table is now deprecated. Please use users_unified instead.