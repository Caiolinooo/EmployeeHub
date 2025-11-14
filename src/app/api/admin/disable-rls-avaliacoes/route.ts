import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * API endpoint TEMPORÁRIO para desabilitar RLS na tabela avaliacoes_desempenho
 * ATENÇÃO: Use apenas para testes! Reative o RLS após resolver os problemas.
 */
export async function POST(request: NextRequest) {
  try {
    // Obter credenciais do ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Credenciais do Supabase não configuradas' },
        { status: 500 }
      );
    }

    // Criar cliente admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔧 Desabilitando RLS temporariamente...');

    // Desabilitar RLS usando SQL direto
    const { data, error } = await supabaseAdmin.from('avaliacoes_desempenho').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao acessar tabela',
          details: error.message,
          message: 'RLS não pode ser desabilitado via API. Execute manualmente no SQL Editor do Supabase:\n\nALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'RLS não pode ser desabilitado via API. Por favor, execute manualmente no SQL Editor do Supabase o seguinte comando:\n\nALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;\n\nOu use políticas RLS permissivas temporariamente:\n\nCREATE POLICY "temp_all_access" ON avaliacoes_desempenho FOR ALL USING (true);',
      sql_to_execute: 'ALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;',
      alternative_sql: 'CREATE POLICY "temp_all_access" ON avaliacoes_desempenho FOR ALL USING (true);',
      note: 'Execute um dos SQLs acima no SQL Editor do Supabase'
    });

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar requisição',
        details: error.message
      },
      { status: 500 }
    );
  }
}
