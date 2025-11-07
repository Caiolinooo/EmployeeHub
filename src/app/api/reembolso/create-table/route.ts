import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Function to check if the Reimbursement table exists
async function checkReimbursementTableExists() {
  try {
    console.log('Checking if Reimbursement table exists...');

    // Check if the Reimbursement table exists
    const { data: tableExists, error } = await supabaseAdmin
      .from('Reimbursement')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Reimbursement table not found:', error);

      // Try with alternative name
      const { data: altTableExists, error: altError } = await supabaseAdmin
        .from('reimbursements')
        .select('id')
        .limit(1);

      if (altError) {
        console.error('reimbursements table also not found:', altError);
        return { exists: false, tableName: null };
      }

      console.log('reimbursements table found');
      return { exists: true, tableName: 'reimbursements' };
    }

    console.log('Reimbursement table found');
    return { exists: true, tableName: 'Reimbursement' };
  } catch (error) {
    console.error('Exception when checking reimbursement table:', error);
    return { exists: false, tableName: null };
  }
}

// SQL to create the Reimbursement table
function getCreateTableSQL() {
  return `
CREATE TABLE IF NOT EXISTS "Reimbursement" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "cargo" TEXT NOT NULL,
  "centro_custo" TEXT NOT NULL,
  "data" TIMESTAMP NOT NULL,
  "tipo_reembolso" TEXT NOT NULL,
  "icone_reembolso" TEXT,
  "descricao" TEXT NOT NULL,
  "valor_total" NUMERIC NOT NULL,
  "moeda" TEXT NOT NULL DEFAULT 'BRL',
  "metodo_pagamento" TEXT NOT NULL,
  "banco" TEXT,
  "agencia" TEXT,
  "conta" TEXT,
  "pix_tipo" TEXT,
  "pix_chave" TEXT,
  "comprovantes" JSONB NOT NULL,
  "observacoes" TEXT,
  "protocolo" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "historico" JSONB NOT NULL,

  CONSTRAINT "Reimbursement_protocolo_key" UNIQUE ("protocolo")
);

-- Add security policies for the table
ALTER TABLE "Reimbursement" ENABLE ROW LEVEL SECURITY;

-- Policy to allow access to all authenticated users
CREATE POLICY "Reimbursement Access Policy"
ON "Reimbursement"
FOR ALL
TO authenticated
USING (true);
  `;
}

// POST - Create the Reimbursement table if it doesn't exist
export async function POST(request: NextRequest) {
  try {
    // Check if the table already exists
    const { exists, tableName } = await checkReimbursementTableExists();

    if (exists) {
      return NextResponse.json({
        success: true,
        message: `Reimbursement table already exists as "${tableName}"`,
        tableName
      });
    }

    // Table doesn't exist, create it
    console.log('Creating Reimbursement table...');

    // Execute the SQL to create the table directly
    try {
      // We can't use RPC functions as they might not exist
      // Instead, we'll create the table directly using the REST API

      // First, create the table with basic structure
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "Reimbursement" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "nome" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "telefone" TEXT NOT NULL,
          "cpf" TEXT NOT NULL,
          "cargo" TEXT NOT NULL,
          "centro_custo" TEXT NOT NULL,
          "data" TIMESTAMP NOT NULL,
          "tipo_reembolso" TEXT NOT NULL,
          "icone_reembolso" TEXT,
          "descricao" TEXT NOT NULL,
          "valor_total" NUMERIC NOT NULL,
          "moeda" TEXT NOT NULL DEFAULT 'BRL',
          "metodo_pagamento" TEXT NOT NULL,
          "banco" TEXT,
          "agencia" TEXT,
          "conta" TEXT,
          "pix_tipo" TEXT,
          "pix_chave" TEXT,
          "comprovantes" JSONB NOT NULL,
          "observacoes" TEXT,
          "protocolo" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pendente',
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "historico" JSONB NOT NULL,
          CONSTRAINT "Reimbursement_protocolo_key" UNIQUE ("protocolo")
        );
      `;

      console.log('Creating Reimbursement table structure...');

      // Use the REST API to create the table
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'X-Client-Info': 'supabase-js/2.0.0',
        },
        body: JSON.stringify({
          cmd: 'project.query',
          query: createTableSQL
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating Reimbursement table:', errorData);
        return NextResponse.json({
          success: false,
          error: 'Failed to create Reimbursement table',
          details: errorData,
          sql: getCreateTableSQL()
        }, { status: 500 });
      }

      console.log('Reimbursement table created successfully, now adding RLS policies...');

      // Add RLS policies
      const rlsSQL = `
        ALTER TABLE "Reimbursement" ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Reimbursement Access Policy"
        ON "Reimbursement"
        FOR ALL
        TO authenticated
        USING (true);
      `;

      const rlsResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'X-Client-Info': 'supabase-js/2.0.0',
        },
        body: JSON.stringify({
          cmd: 'project.query',
          query: rlsSQL
        })
      });

      if (!rlsResponse.ok) {
        const rlsErrorData = await rlsResponse.json();
        console.error('Error adding RLS policies:', rlsErrorData);
        // Continue anyway as the table was created
        console.log('Continuing despite RLS policy error - table was created');
      } else {
        console.log('RLS policies added successfully');
      }
    } catch (error) {
      console.error('Exception when creating Reimbursement table:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create Reimbursement table',
        details: error instanceof Error ? error.message : 'Unknown error',
        sql: getCreateTableSQL()
      }, { status: 500 });
    }

    // Verify the table was created
    const verifyResult = await checkReimbursementTableExists();

    if (verifyResult.exists) {
      return NextResponse.json({
        success: true,
        message: 'Reimbursement table created successfully',
        tableName: verifyResult.tableName
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to verify table creation',
        details: 'The table may have been created but could not be verified. Please check the Supabase dashboard.',
        sql: getCreateTableSQL()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in create-table API route:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      sql: getCreateTableSQL()
    }, { status: 500 });
  }
}

// GET - Check if the Reimbursement table exists
export async function GET(request: NextRequest) {
  try {
    const { exists, tableName } = await checkReimbursementTableExists();

    return NextResponse.json({
      exists,
      tableName,
      sql: exists ? null : getCreateTableSQL()
    });
  } catch (error) {
    console.error('Error checking if Reimbursement table exists:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
