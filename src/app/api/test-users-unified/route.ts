import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Teste de API de usuários unificados iniciado');

    // Verificar se o cliente Supabase está inicializado
    if (!supabaseAdmin) {
      console.error('Cliente Supabase não inicializado');
      return NextResponse.json({
        success: false,
        error: 'Cliente Supabase não inicializado'
      }, { status: 500 });
    }

    // Testar conexão com a tabela users_unified
    console.log('Testando conexão com a tabela users_unified...');
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email, phone_number, role')
      .limit(5);

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar usuários',
        details: usersError.message
      }, { status: 500 });
    }

    console.log(`Encontrados ${users?.length || 0} usuários`);

    // Verificar estrutura da tabela
    if (users && users.length > 0) {
      console.log('Estrutura do primeiro usuário:', Object.keys(users[0]).join(', '));
    }

    // Retornar os dados
    return NextResponse.json({
      success: true,
      message: 'Teste de API de usuários unificados concluído com sucesso',
      count: users?.length || 0,
      sample: users?.slice(0, 2) || [],
      fields: users && users.length > 0 ? Object.keys(users[0]) : []
    });
  } catch (error) {
    console.error('Erro no teste de API de usuários unificados:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro no teste de API de usuários unificados',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
