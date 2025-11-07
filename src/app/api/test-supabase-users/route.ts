import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Obter URLs e chaves para informações de debug
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    console.log('Teste de conexão com Supabase iniciado');
    console.log('URL do Supabase:', supabaseUrl);
    console.log('Chave de serviço presente:', supabaseServiceKey ? 'Sim' : 'Não');

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Configurações do Supabase não encontradas',
        config: {
          supabaseUrl: supabaseUrl ? 'Definido' : 'Não definido',
          supabaseServiceKey: supabaseServiceKey ? 'Definido' : 'Não definido'
        }
      }, { status: 500 });
    }

    // Testar conexão com a tabela users_unified
    console.log('Tentando buscar usuários do Supabase...');
    const { data, error } = await supabase
      .from('users_unified')
      .select('id, first_name, last_name, email, phone_number, role')
      .limit(5);

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar usuários',
        details: error
      }, { status: 500 });
    }

    // Verificar se há dados
    if (!data || data.length === 0) {
      console.log('Nenhum usuário encontrado');
      return NextResponse.json({
        success: true,
        message: 'Conexão com Supabase estabelecida, mas nenhum usuário encontrado',
        data: []
      });
    }

    console.log(`${data.length} usuários encontrados`);
    console.log('Estrutura do primeiro usuário:', Object.keys(data[0]));

    // Retornar os dados
    return NextResponse.json({
      success: true,
      message: 'Conexão com Supabase estabelecida com sucesso',
      count: data.length,
      sample: data.slice(0, 2),
      fields: Object.keys(data[0])
    });
  } catch (error) {
    console.error('Erro ao testar conexão com Supabase:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao testar conexão com Supabase',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
