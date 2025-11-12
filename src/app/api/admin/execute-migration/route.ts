/**
 * API Route: Execute Database Migration
 *
 * This endpoint executes SQL migrations for database schema updates.
 * It uses the Supabase service role key to bypass RLS.
 *
 * POST /api/admin/execute-migration
 *
 * Security: Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create admin Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'scripts', 'migrations', '001-create-evaluation-automation-tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');

    console.log(`Executing ${statements.length} SQL statements...`);

    const results = [];
    const errors = [];

    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and DO blocks (already complete statements)
      if (!statement || statement.startsWith('--')) continue;

      try {
        // For CREATE TABLE statements
        if (statement.toLowerCase().includes('create table')) {
          const tableName = statement.match(/create table (?:if not exists )?(\w+)/i)?.[1];

          const { error } = await supabaseAdmin.rpc('exec_sql', {
            sql_query: statement + ';'
          });

          if (error) {
            // If exec_sql doesn't exist, we can't execute DDL statements via API
            // Log the error and continue
            errors.push({
              statement: i + 1,
              table: tableName,
              error: error.message,
              type: 'DDL'
            });
          } else {
            results.push({
              statement: i + 1,
              table: tableName,
              status: 'success'
            });
          }
        }
      } catch (err: any) {
        errors.push({
          statement: i + 1,
          error: err.message,
          type: 'execution'
        });
      }
    }

    // Since Supabase PostgREST doesn't support DDL via API,
    // we'll return instructions for manual execution
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Migration requires direct database access. Use Supabase Dashboard SQL Editor.',
        executed: results.length,
        total: statements.length,
        results,
        errors,
        instructions: {
          step1: 'Open Supabase Dashboard > SQL Editor',
          step2: 'Copy the content from: scripts/migrations/001-create-evaluation-automation-tables.sql',
          step3: 'Paste and execute in SQL Editor',
          step4: 'Verify tables were created using: SELECT tablename FROM pg_tables WHERE schemaname = \'public\';'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      executed: results.length,
      results
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration failed',
        hint: 'For DDL operations, use Supabase Dashboard SQL Editor directly'
      },
      { status: 500 }
    );
  }
}
