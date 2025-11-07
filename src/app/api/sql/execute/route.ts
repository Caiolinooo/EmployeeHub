import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to execute SQL directly in the Supabase database
 * This is a utility endpoint for administrative operations
 * SECURITY WARNING: This endpoint should be properly secured in production
 */
export async function POST(request: NextRequest) {
  try {
    // Check if the request is authenticated (you should implement proper authentication)
    // This is a placeholder for actual authentication logic
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the SQL query from the request body
    const body = await request.json();
    const { sql } = body;

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json(
        { error: 'Invalid SQL query' },
        { status: 400 }
      );
    }

    console.log('Executing SQL query:', sql);

    // Use the Supabase REST API to execute SQL directly
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`
      },
      body: JSON.stringify({
        query: sql
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error executing SQL query:', errorText);
      return NextResponse.json(
        { error: 'Failed to execute SQL query', details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log('SQL query executed successfully');

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Exception executing SQL query:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
