import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Verificar a estrutura do banco de dados
export async function GET(request: NextRequest) {
  try {
    console.log('API de verificação do banco de dados - Iniciando...');

    // Verificar conexão com o banco de dados
    try {
      // Verificar conexão com o Supabase fazendo uma consulta simples
      // Usar uma tabela que sabemos que existe (users)
      const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);

      if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
        throw new Error(`Erro ao conectar ao Supabase: ${error.message}`);
      }

      console.log('Conexão com o banco de dados estabelecida com sucesso');
    } catch (dbError) {
      console.error('Erro ao conectar ao banco de dados:', dbError);

      // Tentar uma abordagem diferente - verificar a conexão diretamente
      try {
        const { data: healthData } = await supabaseAdmin.rpc('get_service_status');
        console.log('Conexão com o banco de dados estabelecida via health check');
        // Se chegou aqui, a conexão está funcionando
      } catch (healthError) {
        return NextResponse.json(
          { error: 'Erro de conexão com o banco de dados', details: String(dbError) },
          { status: 500 }
        );
      }
    }

    // Verificar tabelas existentes
    console.log('Verificando tabelas existentes...');

    // Verificar tabela News
    let newsTableExists = true;
    let newsCount = 0;
    try {
      const { data: newsData, error: newsError } = await supabaseAdmin
        .from('News')
        .select('id', { count: 'exact' });

      if (newsError) {
        throw newsError;
      }

      newsCount = newsData ? newsData.length : 0;
      console.log(`Tabela News existe e contém ${newsCount} registros`);
    } catch (error) {
      newsTableExists = false;
      console.error('Erro ao verificar tabela News:', error);
    }

    // Verificar outras tabelas
    let userTableExists = true;
    let userCount = 0;
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact' });

      if (userError) {
        throw userError;
      }

      userCount = userData ? userData.length : 0;
      console.log(`Tabela users existe e contém ${userCount} registros`);
    } catch (error) {
      userTableExists = false;
      console.error('Erro ao verificar tabela users:', error);
    }

    // Verificar tabela Reimbursement
    let reimbursementTableExists = true;
    let reimbursementCount = 0;
    try {
      const { data: reimbursementData, error: reimbursementError } = await supabaseAdmin
        .from('Reimbursement')
        .select('id', { count: 'exact' });

      if (reimbursementError) {
        throw reimbursementError;
      }

      reimbursementCount = reimbursementData ? reimbursementData.length : 0;
      console.log(`Tabela Reimbursement existe e contém ${reimbursementCount} registros`);
    } catch (error) {
      reimbursementTableExists = false;
      console.error('Erro ao verificar tabela Reimbursement:', error);
    }

    // Verificar estrutura da tabela News
    let newsStructure = null;
    if (newsTableExists) {
      try {
        // Usar a API do Supabase para obter informações da tabela
        const { data, error } = await supabaseAdmin.rpc('get_table_info', {
          table_name: 'News'
        });

        if (error) {
          console.error('Erro ao obter informações da tabela News:', error);
        } else {
          newsStructure = data;
          console.log('Estrutura da tabela News:', data);
        }
      } catch (error) {
        console.error('Erro ao verificar estrutura da tabela News:', error);
      }
    }

    // Retornar resultado
    return NextResponse.json({
      status: 'success',
      database: {
        connected: true,
        tables: {
          news: {
            exists: newsTableExists,
            count: newsCount,
            structure: newsStructure
          },
          user: {
            exists: userTableExists,
            count: userCount
          },
          reimbursement: {
            exists: reimbursementTableExists,
            count: reimbursementCount
          }
        }
      }
    });
  } catch (error) {
    console.error('Erro ao verificar banco de dados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
