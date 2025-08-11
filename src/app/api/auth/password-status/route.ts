import { NextRequest, NextResponse } from 'next/server';
import { isPasswordExpired, verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.log('Token inválido ou expirado');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('Verificando status da senha para usuário:', payload.userId);

    // Verificar se estamos usando Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      // Usar Supabase
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Buscar o usuário no Supabase
      const { data: userData, error } = await supabase
        .from('users_unified')
        .select('password, password_hash, password_last_changed, role')
        .eq('id', payload.userId)
        .single();

      if (error) {
        console.error('Erro ao buscar usuário no Supabase:', error);
        return NextResponse.json({ error: 'Erro ao verificar senha' }, { status: 500 });
      }

      // Se o usuário tem senha na coluna password mas não em password_hash, copiar para password_hash
      if (userData.password && !userData.password_hash) {
        console.log('Copiando senha da coluna password para password_hash');
        const { error: updateError } = await supabase
          .from('users_unified')
          .update({ password_hash: userData.password })
          .eq('id', payload.userId);

        if (updateError) {
          console.error('Erro ao atualizar password_hash:', updateError);
        }
      }

      // Verificar se a senha expirou
      const expired = isPasswordExpired(userData.password_last_changed, userData.role);

      return NextResponse.json({
        expired,
        passwordLastChanged: userData.password_last_changed,
        expiryDays: parseInt(process.env.PASSWORD_EXPIRY_DAYS || '365')
      });
    } else {
      return NextResponse.json(
        { error: 'Configuração de banco de dados não encontrada' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao verificar status da senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
