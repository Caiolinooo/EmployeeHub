import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Obter URLs e chaves para informações de debug
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// GET - Obter informações de debug
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar informações de debug.' },
        { status: 403 }
      );
    }

    // Obter informações sobre a tabela de usuários
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'users' });

    if (tableError) {
      console.error('Erro ao obter informações da tabela:', tableError);

      // Tentar obter informações de outra forma
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (usersError) {
        return NextResponse.json(
          { error: 'Erro ao obter informações da tabela de usuários' },
          { status: 500 }
        );
      }

      // Retornar a estrutura baseada no primeiro usuário
      return NextResponse.json({
        table: 'users',
        columns: users && users.length > 0 ? Object.keys(users[0]) : [],
        sample: users && users.length > 0 ? users[0] : null
      });
    }

    // Obter contagem de usuários
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Obter informações sobre a tabela de autorizações
    const { data: authUsers, error: authError } = await supabase
      .from('authorized_users')
      .select('*')
      .limit(1);

    return NextResponse.json({
      tableInfo,
      userCount: count,
      countError: countError ? countError.message : null,
      authTableExists: !authError,
      authTableSample: authUsers && authUsers.length > 0 ? authUsers[0] : null,
      supabaseUrl,
      serviceKeyFirstChars: supabaseServiceKey.substring(0, 5) + '...'
    });
  } catch (error) {
    console.error('Erro ao obter informações de debug:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
