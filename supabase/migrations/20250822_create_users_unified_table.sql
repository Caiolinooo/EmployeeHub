-- Create the users_unified table with the same structure as the users table
CREATE TABLE IF NOT EXISTS users_unified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'MANAGER')),
  position TEXT,
  department TEXT,
  avatar TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  password_last_changed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_unified_email ON users_unified(email);
CREATE INDEX IF NOT EXISTS idx_users_unified_phone ON users_unified(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_unified_role ON users_unified(role);

-- Create trigger for updating the updated_at field
CREATE TRIGGER update_users_unified_updated_at
BEFORE UPDATE ON users_unified
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE users_unified ENABLE ROW LEVEL SECURITY;

-- Create policies for the users_unified table (same as users table)
CREATE POLICY users_unified_select_policy ON users_unified
FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_insert_policy ON users_unified
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_update_policy ON users_unified
FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_delete_policy ON users_unified
FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);