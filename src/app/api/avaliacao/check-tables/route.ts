import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
    const tables = [
      'funcionarios',  // Tabela de funcionários
      'criterios',     // Critérios de avaliação
      'avaliacoes_desempenho', // Avaliações (nome correto)
      'periodos_avaliacao',    // Períodos de avaliação (será criado pela migration)
      'pontuacoes'     // Pontuações das avaliações
    ];
    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        // Tentar buscar um registro da tabela
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.error(`Erro ao verificar tabela ${table}:`, error);
          results[table] = { exists: false, error: error.message };
        } else {
          results[table] = { exists: true, error: null };
        }
      } catch (err) {
        console.error(`Erro ao verificar tabela ${table}:`, err);
        results[table] = { exists: false, error: String(err) };
      }
    }

    // Verificar se há critérios configurados
    let criteriosCount = 0;
    try {
      const { count, error } = await supabase
        .from('criterios')
        .select('id', { count: 'exact', head: true });

      if (!error) {
        criteriosCount = count || 0;
      }
    } catch (err) {
      console.error('Erro ao contar critérios:', err);
    }

    return NextResponse.json({
      success: true,
      tables: results,
      criteriosCount,
      message: 'Verificação de tabelas concluída'
    });
  } catch (err) {
    console.error('Erro ao verificar tabelas:', err);
    
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
