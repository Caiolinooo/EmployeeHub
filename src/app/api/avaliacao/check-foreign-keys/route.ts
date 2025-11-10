import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API para verificar se as foreign keys existem
 * GET /api/avaliacao/check-foreign-keys
 */
export async function GET(request: NextRequest) {
  try {
    // Query para verificar as foreign keys
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      sql: `
        SELECT
          conname AS constraint_name,
          conrelid::regclass AS table_name,
          pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conname IN (
          'avaliacoes_desempenho_funcionario_id_fkey',
          'avaliacoes_desempenho_avaliador_id_fkey'
        )
        ORDER BY conname;
      `
    });

    if (error) {
      // Se a função execute_sql não existe, tentar query direta
      const { data: rawData, error: rawError } = await supabaseAdmin
        .from('pg_constraint')
        .select('conname, conrelid, oid')
        .in('conname', [
          'avaliacoes_desempenho_funcionario_id_fkey',
          'avaliacoes_desempenho_avaliador_id_fkey'
        ]);

      if (rawError) {
        return NextResponse.json({
          success: false,
          error: 'Não foi possível verificar as foreign keys',
          details: rawError.message,
          foreignKeys: {
            funcionario_id: false,
            avaliador_id: false
          }
        });
      }

      const hasFunc = rawData?.some(c => c.conname === 'avaliacoes_desempenho_funcionario_id_fkey');
      const hasAval = rawData?.some(c => c.conname === 'avaliacoes_desempenho_avaliador_id_fkey');

      return NextResponse.json({
        success: true,
        foreignKeys: {
          funcionario_id: hasFunc,
          avaliador_id: hasAval
        },
        constraints: rawData || []
      });
    }

    // Analisar resultados
    const constraints = data || [];
    const hasFunc = constraints.some((c: any) => c.constraint_name === 'avaliacoes_desempenho_funcionario_id_fkey');
    const hasAval = constraints.some((c: any) => c.constraint_name === 'avaliacoes_desempenho_avaliador_id_fkey');

    return NextResponse.json({
      success: true,
      foreignKeys: {
        funcionario_id: hasFunc,
        avaliador_id: hasAval
      },
      allExist: hasFunc && hasAval,
      constraints: constraints,
      message: hasFunc && hasAval
        ? 'Todas as foreign keys existem!'
        : 'Algumas foreign keys estão faltando'
    });

  } catch (error) {
    console.error('Erro ao verificar foreign keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        foreignKeys: {
          funcionario_id: false,
          avaliador_id: false
        }
      },
      { status: 500 }
    );
  }
}
