import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Obter variáveis de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    console.log('=== API SUPABASE STATUS ===');
    console.log('URL do Supabase:', supabaseUrl);
    console.log('Chave de serviço presente:', supabaseServiceKey ? 'Sim' : 'Não');
    console.log('Comprimento da chave de serviço:', supabaseServiceKey ? supabaseServiceKey.length : 0);
    console.log('Primeiros 10 caracteres da chave de serviço:', supabaseServiceKey ? supabaseServiceKey.substring(0, 10) : 'N/A');

    // Verificar se as variáveis de ambiente estão definidas
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Configurações do Supabase não encontradas',
        config: {
          supabaseUrl: supabaseUrl ? 'Definido' : 'Não definido',
          supabaseServiceKey: supabaseServiceKey ? 'Definido (primeiros 10 caracteres): ' + supabaseServiceKey.substring(0, 10) + '...' : 'Não definido'
        }
      }, { status: 500 });
    }

    // Usar o cliente supabaseAdmin já inicializado em lib/supabase.ts
    console.log('Usando cliente supabaseAdmin pré-inicializado');

    // Testar conexão com o Supabase
    console.log('Testando conexão com o Supabase...');
    try {
      const { data, error } = await supabaseAdmin
        .from('User')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Erro ao conectar ao Supabase:', error);
        return NextResponse.json({
          status: 'error',
          message: 'Erro ao conectar ao Supabase',
          error: error.message,
          details: error
        }, { status: 500 });
      }

      console.log('Conexão com o Supabase estabelecida com sucesso!');
      console.log('Dados recebidos:', data);

      // Testar conexão com a tabela de usuários
      console.log('Testando conexão com a tabela de usuários...');
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('User')
        .select('id, firstName, lastName, email')
        .limit(5);

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
      } else {
        console.log('Usuários encontrados:', usersData ? usersData.length : 0);
      }

      return NextResponse.json({
        status: 'success',
        message: 'Conexão com o Supabase estabelecida com sucesso',
        count: data,
        users: usersData,
        usersError: usersError ? {
          message: usersError.message,
          details: usersError
        } : null,
        env: {
          supabaseUrl,
          serviceKeyLength: supabaseServiceKey.length,
          serviceKeyPrefix: supabaseServiceKey.substring(0, 10)
        }
      });
    } catch (innerError) {
      console.error('Erro ao testar conexão com o Supabase:', innerError);
      return NextResponse.json({
        status: 'error',
        message: 'Erro ao testar conexão com o Supabase',
        error: innerError instanceof Error ? innerError.message : String(innerError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao verificar status do Supabase:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Erro interno ao verificar status do Supabase',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
