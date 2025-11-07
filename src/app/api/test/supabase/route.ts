import { NextRequest, NextResponse } from 'next/server';
import { supabase, checkSupabaseConnection } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('=== API TEST SUPABASE ROUTE DEBUG ===');
  console.log('Recebida requisição de teste do Supabase');
  
  try {
    // Verificar a conexão com o Supabase
    const isConnected = await checkSupabaseConnection();
    
    if (!isConnected) {
      return NextResponse.json({
        status: 'error',
        message: 'Erro ao conectar com o Supabase',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // Tentar fazer uma consulta simples
    const { data: usersCount, error: usersError } = await supabase
      .from('users')
      .select('count');
    
    if (usersError) {
      return NextResponse.json({
        status: 'error',
        message: 'Erro ao consultar usuários',
        error: usersError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // Verificar as tabelas disponíveis
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');
    
    // Verificar a versão do Supabase
    const { data: version, error: versionError } = await supabase
      .rpc('get_server_version');
    
    return NextResponse.json({
      status: 'ok',
      message: 'Conexão com Supabase estabelecida com sucesso',
      usersCount,
      tables: tables || 'Não foi possível obter a lista de tabelas',
      version: version || 'Não foi possível obter a versão do servidor',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao testar conexão com Supabase:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao testar conexão com Supabase',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
