import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Iniciando diagnóstico de autenticação do Supabase');

    // Obter configurações do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    // Verificar configurações
    const configStatus = {
      supabaseUrl: supabaseUrl ? 'Configurado' : 'Não configurado',
      supabaseAnonKey: supabaseAnonKey ? 'Configurado' : 'Não configurado',
      supabaseServiceKey: supabaseServiceKey ? 'Configurado' : 'Não configurado',
    };

    console.log('Status das configurações:', configStatus);

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        message: 'Configurações do Supabase incompletas',
        configStatus
      }, { status: 500 });
    }

    // Usar clientes Supabase já inicializados
    // supabase = cliente com chave anônima
    // supabaseAdmin = cliente com chave de serviço
    console.log('Usando clientes Supabase pré-inicializados');

    // Testar conexão com o Supabase
    console.log('Testando conexão com o Supabase...');

    // Testar autenticação anônima
    const anonAuthTest = await supabase.auth.getSession();
    console.log('Teste de autenticação anônima:', anonAuthTest.error ? 'Falha' : 'Sucesso');

    // Testar acesso à tabela de usuários com chave de serviço
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('count')
      .limit(1);

    console.log('Teste de acesso à tabela users_unified:', usersError ? 'Falha' : 'Sucesso');

    // Verificar se o usuário administrador existe
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users_unified')
      .select('id, email, role, phone_number')
      .eq('email', adminEmail)
      .single();

    console.log('Teste de busca do administrador:', adminError ? 'Falha' : 'Sucesso');

    // Verificar configuração de autenticação
    const { data: authSettings, error: authError } = await supabaseAdmin
      .auth.admin.listUsers();

    console.log('Teste de listagem de usuários auth:', authError ? 'Falha' : 'Sucesso');

    // Retornar resultados
    return NextResponse.json({
      success: true,
      message: 'Diagnóstico de autenticação do Supabase concluído',
      configStatus,
      tests: {
        anonAuth: {
          success: !anonAuthTest.error,
          error: anonAuthTest.error ? anonAuthTest.error.message : null
        },
        usersTable: {
          success: !usersError,
          error: usersError ? usersError.message : null,
          count: usersData ? usersData.length : 0
        },
        adminUser: {
          success: !adminError,
          error: adminError ? adminError.message : null,
          found: !!adminData,
          details: adminData ? {
            id: adminData.id,
            email: adminData.email,
            role: adminData.role,
            phone: adminData.phone_number
          } : null
        },
        authSettings: {
          success: !authError,
          error: authError ? authError.message : null,
          userCount: authSettings ? authSettings.users.length : 0
        }
      }
    });
  } catch (error) {
    console.error('Erro no diagnóstico de autenticação do Supabase:', error);
    return NextResponse.json({
      success: false,
      message: 'Erro ao realizar diagnóstico de autenticação',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
