/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- script legado CommonJS executado direto pelo node */
// Script to setup the modular system database tables
require('dotenv').config();
const { Pool } = require('pg');

// Config
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is not defined. Please configure the environment variable.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const sql = `
  -- Enable UUID extension if not exists
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Table: sys_modules
  CREATE TABLE IF NOT EXISTS sys_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    table_name TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{"read": ["admin", "manager", "user"], "write": ["admin", "manager"]}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Table: sys_fields
  CREATE TABLE IF NOT EXISTS sys_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES sys_modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'date', 'boolean', 'select', 'file', 'relation', 'rich_text')),
    required BOOLEAN DEFAULT FALSE,
    options JSONB,
    "order" INTEGER DEFAULT 0,
    is_list_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(module_id, name)
  );

  -- Table: sys_dynamic_records
  CREATE TABLE IF NOT EXISTS sys_dynamic_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES sys_modules(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_sys_dynamic_records_module_id ON sys_dynamic_records(module_id);
  CREATE INDEX IF NOT EXISTS idx_sys_dynamic_records_data ON sys_dynamic_records USING gin (data);

  -- Function to update updated_at timestamp
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  -- Triggers
  DROP TRIGGER IF EXISTS update_sys_modules_updated_at ON sys_modules;
  CREATE TRIGGER update_sys_modules_updated_at
  BEFORE UPDATE ON sys_modules
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

  DROP TRIGGER IF EXISTS update_sys_fields_updated_at ON sys_fields;
  CREATE TRIGGER update_sys_fields_updated_at
  BEFORE UPDATE ON sys_fields
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

  DROP TRIGGER IF EXISTS update_sys_dynamic_records_updated_at ON sys_dynamic_records;
  CREATE TRIGGER update_sys_dynamic_records_updated_at
  BEFORE UPDATE ON sys_dynamic_records
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
`;

async function setup() {
    const client = await pool.connect();
    try {
        console.log('Starting modular system setup...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Modular system tables created successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error setting up modular system:', error);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

setup();
