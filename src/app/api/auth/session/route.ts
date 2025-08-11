import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get the current session
 * This endpoint returns the current session information
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Session request received');
    
    // Try to get token from authorization header
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      // Verify token
      const payload = verifyToken(token);
      if (payload) {
        console.log('Valid token found in authorization header');
        return NextResponse.json({
          data: {
            session: {
              access_token: token,
              user: {
                id: payload.userId,
                role: payload.role
              }
            }
          }
        });
      }
    }
    
    // If no valid token in header, try to get from Supabase
    const { data: { session } } = await supabaseAdmin.auth.getSession();
    
    if (session) {
      console.log('Session found in Supabase');
      return NextResponse.json({
        data: {
          session: {
            access_token: session.access_token,
            user: {
              id: session.user.id,
              role: 'user' // Default role, will be overridden by client-side checks
            }
          }
        }
      });
    }
    
    // No session found
    console.log('No session found');
    return NextResponse.json({
      data: {
        session: null
      }
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Error getting session' },
      { status: 500 }
    );
  }
}
