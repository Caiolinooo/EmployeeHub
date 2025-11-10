import { NextRequest, NextResponse } from 'next/server';
import { isAdminFromRequest } from '@/lib/auth';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Endpoint temporário de diagnóstico para verificar status de admin
 * GET /api/debug/check-admin
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    console.log('=== DEBUG CHECK-ADMIN ===');
    console.log('1. Authorization header present:', !!authHeader);
    console.log('2. Token extracted:', token ? 'YES' : 'NO');

    if (!token) {
      return NextResponse.json({
        success: false,
        stage: 'token_extraction',
        error: 'Token não encontrado no header Authorization',
        authHeaderPresent: !!authHeader,
        authHeaderValue: authHeader ? authHeader.substring(0, 20) + '...' : null
      });
    }

    // Verificar o token
    const payload = verifyToken(token);
    console.log('3. Token payload:', payload);

    if (!payload) {
      return NextResponse.json({
        success: false,
        stage: 'token_verification',
        error: 'Token inválido ou expirado',
        tokenPresent: true
      });
    }

    // Buscar informações do usuário no banco
    let userFromDb = null;
    if (payload.userId && payload.userId !== 'service-account' && payload.userId !== 'supabase-user') {
      const { data, error } = await supabase
        .from('users_unified')
        .select('id, email, phone_number, role, first_name, last_name')
        .eq('id', payload.userId)
        .single();

      console.log('4. User query result:', { data, error });
      userFromDb = data;
    }

    // Chamar isAdminFromRequest
    const adminCheck = await isAdminFromRequest(request);
    console.log('5. Admin check result:', adminCheck);

    return NextResponse.json({
      success: true,
      tokenPayload: payload,
      userFromDatabase: userFromDb,
      adminCheck: adminCheck,
      isAdmin: adminCheck.isAdmin,
      diagnosis: {
        hasToken: true,
        tokenValid: !!payload,
        userExists: !!userFromDb,
        userRole: userFromDb?.role || 'N/A',
        adminCheckPassed: adminCheck.isAdmin,
        userId: payload.userId
      }
    });

  } catch (error) {
    console.error('Erro no debug check-admin:', error);
    return NextResponse.json({
      success: false,
      stage: 'exception',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}
