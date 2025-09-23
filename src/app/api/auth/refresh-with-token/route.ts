import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken, generateRefreshToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para renovar access token usando refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token não fornecido' },
        { status: 400 }
      );
    }

    console.log('Tentando renovar token com refresh token...');

    // Buscar o refresh token na tabela de refresh tokens
    const { data: refreshTokenData, error: refreshTokenError } = await supabaseAdmin
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .eq('is_active', true)
      .single();

    if (refreshTokenError || !refreshTokenData) {
      console.error('Refresh token não encontrado ou inválido:', refreshTokenError);
      return NextResponse.json(
        { success: false, error: 'Refresh token inválido' },
        { status: 401 }
      );
    }

    // Verificar se o refresh token não expirou
    const now = new Date();
    const expiresAt = new Date(refreshTokenData.expires_at);
    
    if (expiresAt < now) {
      console.error('Refresh token expirado');
      
      // Marcar o refresh token como inativo
      await supabaseAdmin
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('id', refreshTokenData.id);

      return NextResponse.json(
        { success: false, error: 'Refresh token expirado' },
        { status: 401 }
      );
    }

    // Buscar o usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', refreshTokenData.user_id)
      .single();

    if (userError || !userData) {
      console.error('Usuário não encontrado:', userError);
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário está ativo
    if (!userData.active) {
      console.error('Usuário inativo');
      return NextResponse.json(
        { success: false, error: 'Usuário inativo' },
        { status: 403 }
      );
    }

    // Gerar novo access token
    const rememberMe = refreshTokenData.remember_me || false;
    const newAccessToken = generateToken(userData, rememberMe);

    // Gerar novo refresh token (rotação de refresh token para segurança)
    const newRefreshTokenData = generateRefreshToken(userData, rememberMe);

    // Marcar o refresh token antigo como inativo
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ is_active: false })
      .eq('id', refreshTokenData.id);

    // Salvar o novo refresh token
    const { error: insertError } = await supabaseAdmin
      .from('refresh_tokens')
      .insert({
        user_id: userData.id,
        token: newRefreshTokenData.token,
        expires_at: newRefreshTokenData.expiresAt.toISOString(),
        remember_me: rememberMe,
        is_active: true,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Erro ao salvar novo refresh token:', insertError);
      return NextResponse.json(
        { success: false, error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    console.log('Token renovado com sucesso para usuário:', userData.id);

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenData.token,
      expiresInSeconds: newRefreshTokenData.expiresInSeconds,
      user: {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        phone_number: userData.phone_number
      }
    });

  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
