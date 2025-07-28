import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Obter configurações do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Configurações do Supabase não encontradas'
      }, { status: 500 });
    }

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se as tabelas existem
    const tables = ['avaliacoes', 'funcionarios'];
    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        // Tentar buscar um registro da tabela
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          console.error(`Erro ao verificar tabela ${table}:`, error);
          results[table] = {
            exists: false,
            error: error.message
          };
        } else {
          results[table] = {
            exists: true,
            count: data ? data.length : 0
          };
        }
      } catch (err) {
        console.error(`Erro ao verificar tabela ${table}:`, err);
        results[table] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido'
        };
      }
    }

    // Verificar se há registros na tabela avaliacoes
    let avaliacoesCount = 0;
    try {
      const { count, error } = await supabase
        .from('avaliacoes')
        .select('id', { count: 'exact', head: true });

      if (!error) {
        avaliacoesCount = count || 0;
      }
    } catch (err) {
      console.error('Erro ao contar avaliações:', err);
    }

    return NextResponse.json({
      success: true,
      tables: results,
      avaliacoesCount
    });
  } catch (err) {
    console.error('Erro ao verificar tabelas:', err);
    
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
