import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to create the 'comprovantes' bucket in Supabase storage
 * This is needed for storing reimbursement attachments
 */
export async function POST(request: NextRequest) {
  try {
    console.log('✅ Verificando bucket comprovantes...');

    // Check if the bucket already exists
    try {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

      if (!listError && buckets) {
        // Check if the comprovantes bucket already exists
        const comprovantesBucket = buckets?.find(bucket => bucket.name === 'comprovantes');

        if (comprovantesBucket) {
          return NextResponse.json({
            success: true,
            message: 'Bucket already exists',
            bucket: comprovantesBucket
          });
        }
      }
    } catch (listError) {
      // Continue with bucket creation attempt even if listing fails
    }

    // Create the bucket with simplified options
    try {
      console.log('Attempting to create comprovantes bucket...');

      const { data, error } = await supabaseAdmin.storage.createBucket('comprovantes', {
        public: true // Make the bucket public so files can be accessed without authentication
      });

      if (error) {
        console.error('Error creating bucket with basic options:', error);

        // Try again with minimal options
        console.log('Retrying with minimal options...');
        const retryResult = await supabaseAdmin.storage.createBucket('comprovantes');

        if (retryResult.error) {
          console.error('Error creating bucket with minimal options:', retryResult.error);
          return NextResponse.json({
            success: false,
            error: `Error creating bucket: ${retryResult.error.message}`,
            details: retryResult.error,
            suggestion: 'Please create the bucket manually in the Supabase dashboard'
          }, { status: 500 });
        }

        console.log('Bucket created successfully with minimal options');
        return NextResponse.json({
          success: true,
          message: 'Bucket created successfully with minimal options',
          bucket: retryResult.data
        });
      }

      console.log('Comprovantes bucket created successfully');
      return NextResponse.json({
        success: true,
        message: 'Bucket created successfully',
        bucket: data
      });
    } catch (createError) {
      console.error('Exception creating bucket:', createError);
      return NextResponse.json({
        success: false,
        error: 'Exception creating bucket',
        details: String(createError),
        suggestion: 'Please create the bucket manually in the Supabase dashboard'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Top-level exception creating bucket:', error);
    return NextResponse.json({
      success: false,
      error: 'Top-level exception creating bucket',
      details: String(error),
      suggestion: 'Please create the bucket manually in the Supabase dashboard'
    }, { status: 500 });
  }
}
