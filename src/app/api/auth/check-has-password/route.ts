import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);

    if (!payload) {
      console.log('Token inválido');
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    console.log('Verificando se usuário tem senha definida:', payload.userId);

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
        .select('password, password_hash, password_last_changed')
        .eq('id', payload.userId)
        .single();

      if (error) {
        console.error('Erro ao buscar usuário no Supabase:', error);
        return NextResponse.json({ error: 'Erro ao verificar senha' }, { status: 500 });
      }

      // Verificar se o usuário tem senha definida (verificar tanto password quanto password_hash)
      const hasPassword = !!userData.password_hash || !!userData.password;
      console.log('Usuário tem senha definida:', hasPassword);
      console.log('Detalhes da senha:', {
        hasPasswordField: !!userData.password,
        hasPasswordHashField: !!userData.password_hash,
        passwordLastChanged: userData.password_last_changed
      });

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

      // Se o usuário tem senha na coluna password_hash mas não em password, copiar para password
      if (!userData.password && userData.password_hash) {
        console.log('Copiando senha da coluna password_hash para password');
        const { error: updateError } = await supabase
          .from('users_unified')
          .update({ password: userData.password_hash })
          .eq('id', payload.userId);

        if (updateError) {
          console.error('Erro ao atualizar password:', updateError);
        }
      }

      // Verificar se o usuário é administrador e forçar hasPassword = true
      const { data: userRole, error: roleError } = await supabase
        .from('users_unified')
        .select('role')
        .eq('id', payload.userId)
        .single();

      if (!roleError && userRole && userRole.role === 'ADMIN') {
        console.log('Usuário é administrador, garantindo acesso sem verificação de senha');
        // Para administradores, sempre considerar que tem senha
        return NextResponse.json({
          hasPassword: true,
          passwordLastChanged: userData.password_last_changed,
          isAdmin: true
        });
      }

      return NextResponse.json({
        hasPassword,
        passwordLastChanged: userData.password_last_changed
      });
    } else {
      console.log('Configuração do Supabase não encontrada');
      return NextResponse.json({
        error: 'Configuração de banco de dados não encontrada'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
