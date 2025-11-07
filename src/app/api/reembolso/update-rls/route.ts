import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to check the Reimbursement table and provide RLS policy instructions
 * This endpoint no longer attempts to execute SQL directly
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Checking Reimbursement table access...');

    // Check if the Reimbursement table exists and is accessible
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('Reimbursement')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('Error accessing Reimbursement table:', tableError);
      console.log('This might indicate that RLS policies are already restricting access');

      // Return instructions for manually fixing RLS policies
      return NextResponse.json({
        success: false,
        message: 'Cannot access Reimbursement table. This might indicate that RLS policies are already restricting access.',
        suggestion: 'Please manually configure RLS policies in the Supabase dashboard.',
        sql: getManualRLSPolicySQL()
      });
    }

    // Try to insert a test record to see if we have write access
    try {
      const testId = 'test-' + Date.now();
      const { error: insertError } = await supabaseAdmin
        .from('Reimbursement')
        .insert({
          id: testId,
          nome: 'Test User',
          email: 'test@example.com',
          telefone: '123456789',
          cpf: '12345678901',
          cargo: 'Test',
          centro_custo: 'Test',
          data: new Date().toISOString(),
          tipo_reembolso: 'Test',
          descricao: 'Test',
          valor_total: 0,
          moeda: 'BRL',
          metodo_pagamento: 'Test',
          comprovantes: [],
          protocolo: 'TEST-' + Date.now(),
          historico: []
        });

      if (insertError) {
        console.log('Test insert failed, which might indicate RLS policies are already restricting access:', insertError);

        // Return instructions for manually fixing RLS policies
        return NextResponse.json({
          success: false,
          message: 'Cannot insert into Reimbursement table. This might indicate that RLS policies are already restricting access.',
          suggestion: 'Please manually configure RLS policies in the Supabase dashboard.',
          sql: getManualRLSPolicySQL()
        });
      } else {
        console.log('Test insert successful, cleaning up...');

        // Clean up the test record
        const { error: deleteError } = await supabaseAdmin
          .from('Reimbursement')
          .delete()
          .eq('id', testId);

        if (deleteError) {
          console.error('Failed to clean up test record:', deleteError);
        } else {
          console.log('Test record cleaned up successfully');
        }
      }
    } catch (testError) {
      console.error('Error during test insert:', testError);

      // Return instructions for manually fixing RLS policies
      return NextResponse.json({
        success: false,
        message: 'Error testing Reimbursement table access.',
        suggestion: 'Please manually configure RLS policies in the Supabase dashboard.',
        sql: getManualRLSPolicySQL()
      });
    }

    // If we got here, we can access the table and insert records
    // This means RLS policies are either not enabled or are configured to allow access
    console.log('Reimbursement table is accessible and writable');

    // Return success with instructions for manually configuring RLS policies
    return NextResponse.json({
      success: true,
      message: 'Reimbursement table is accessible and writable.',
      suggestion: 'For proper security, please manually configure RLS policies in the Supabase dashboard.',
      sql: getManualRLSPolicySQL()
    });
  } catch (error) {
    console.error('Exception checking Reimbursement table access:', error);

    // Return instructions for manually fixing RLS policies
    return NextResponse.json({
      success: false,
      message: 'Error checking Reimbursement table access.',
      suggestion: 'Please manually configure RLS policies in the Supabase dashboard.',
      sql: getManualRLSPolicySQL()
    });
  }
}

// Helper function to get the SQL for manually configuring RLS policies
function getManualRLSPolicySQL() {
  return `
    -- Run this SQL in the Supabase dashboard SQL editor:

    -- First, enable RLS on the Reimbursement table
    ALTER TABLE "Reimbursement" ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Reimbursement Access Policy" ON "Reimbursement";
    DROP POLICY IF EXISTS "Reimbursement Insert Policy" ON "Reimbursement";
    DROP POLICY IF EXISTS "Reimbursement Select Policy" ON "Reimbursement";
    DROP POLICY IF EXISTS "Reimbursement Update Policy" ON "Reimbursement";

    -- Create simplified policies that allow all operations
    -- This ensures the application works while we debug the more complex policies

    -- Policy for SELECT: Allow all authenticated users to see all reimbursements
    CREATE POLICY "Reimbursement Select Policy"
    ON "Reimbursement"
    FOR SELECT
    USING (true);

    -- Policy for INSERT: Allow all authenticated users to insert reimbursements
    CREATE POLICY "Reimbursement Insert Policy"
    ON "Reimbursement"
    FOR INSERT
    WITH CHECK (true);

    -- Policy for UPDATE: Allow all authenticated users to update reimbursements
    CREATE POLICY "Reimbursement Update Policy"
    ON "Reimbursement"
    FOR UPDATE
    USING (true);
  `;
}
