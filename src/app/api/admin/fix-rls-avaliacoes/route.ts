import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API endpoint para configurar políticas RLS para avaliacoes_desempenho
 * IMPORTANTE: Só pode ser executado por administradores
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado. Apenas administradores podem executar esta operação.' },
        { status: 403 }
      );
    }

    console.log('🔧 Iniciando configuração de políticas RLS para avaliacoes_desempenho');

    const results = [];

    // 1. Desabilitar RLS temporariamente
    try {
      console.log('1. Desabilitando RLS temporariamente...');
      await supabaseAdmin.rpc('exec_sql', {
        sql: 'ALTER TABLE IF EXISTS avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;'
      });
      results.push({ step: 'disable_rls', success: true });
    } catch (error: any) {
      console.error('Erro ao desabilitar RLS:', error);
      results.push({ step: 'disable_rls', success: false, error: error.message });
    }

    // 2. Remover políticas antigas
    const policiesToRemove = [
      'avaliacoes_select_policy',
      'avaliacoes_insert_policy',
      'avaliacoes_update_policy',
      'avaliacoes_delete_policy'
    ];

    for (const policy of policiesToRemove) {
      try {
        console.log(`2. Removendo política antiga: ${policy}...`);
        await supabaseAdmin.rpc('exec_sql', {
          sql: `DROP POLICY IF EXISTS "${policy}" ON avaliacoes_desempenho;`
        });
        results.push({ step: `remove_${policy}`, success: true });
      } catch (error: any) {
        // Erros esperados se a política não existir
        console.log(`   (Política ${policy} não existia ou já foi removida)`);
        results.push({ step: `remove_${policy}`, success: true, note: 'já removida ou não existia' });
      }
    }

    // 3. Reabilitar RLS
    try {
      console.log('3. Reabilitando RLS...');
      await supabaseAdmin.rpc('exec_sql', {
        sql: 'ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;'
      });
      results.push({ step: 'enable_rls', success: true });
    } catch (error: any) {
      console.error('Erro ao reabilitar RLS:', error);
      results.push({ step: 'enable_rls', success: false, error: error.message });
    }

    // 4. Criar políticas novas (simplificadas sem funções helper)
    const newPolicies = [
      {
        name: 'avaliacoes_select_policy',
        sql: `CREATE POLICY "avaliacoes_select_policy" ON avaliacoes_desempenho
          FOR SELECT USING (auth.uid() IS NOT NULL);`
      },
      {
        name: 'avaliacoes_insert_policy',
        sql: `CREATE POLICY "avaliacoes_insert_policy" ON avaliacoes_desempenho
          FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);`
      },
      {
        name: 'avaliacoes_update_policy',
        sql: `CREATE POLICY "avaliacoes_update_policy" ON avaliacoes_desempenho
          FOR UPDATE USING (auth.uid() IS NOT NULL);`
      },
      {
        name: 'avaliacoes_delete_policy',
        sql: `CREATE POLICY "avaliacoes_delete_policy" ON avaliacoes_desempenho
          FOR DELETE USING (auth.uid() IS NOT NULL);`
      }
    ];

    for (const policy of newPolicies) {
      try {
        console.log(`4. Criando política: ${policy.name}...`);
        await supabaseAdmin.rpc('exec_sql', { sql: policy.sql });
        results.push({ step: `create_${policy.name}`, success: true });
      } catch (error: any) {
        console.error(`Erro ao criar política ${policy.name}:`, error);
        results.push({ step: `create_${policy.name}`, success: false, error: error.message });
      }
    }

    // 5. Verificar se as políticas foram criadas
    try {
      console.log('5. Verificando políticas criadas...');
      const { data: policies, error } = await supabaseAdmin
        .from('pg_policies')
        .select('tablename, policyname, cmd')
        .eq('tablename', 'avaliacoes_desempenho');

      if (error) {
        console.error('Erro ao verificar políticas:', error);
        results.push({ step: 'verify_policies', success: false, error: error.message });
      } else {
        console.log(`   ✅ ${policies?.length || 0} políticas encontradas`);
        results.push({
          step: 'verify_policies',
          success: true,
          policies: policies?.map(p => p.policyname) || []
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar políticas:', error);
      results.push({ step: 'verify_policies', success: false, error: error.message });
    }

    // Contar sucessos e falhas
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ Configuração concluída: ${successCount} sucessos, ${failureCount} falhas`);

    return NextResponse.json({
      success: failureCount === 0,
      message: `Políticas RLS configuradas: ${successCount} sucessos, ${failureCount} falhas`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failure: failureCount
      }
    });

  } catch (error: any) {
    console.error('❌ Erro fatal ao configurar políticas RLS:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao configurar políticas RLS',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint para verificar o status atual das políticas RLS
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado. Apenas administradores podem visualizar esta informação.' },
        { status: 403 }
      );
    }

    // Verificar políticas existentes
    const { data: policies, error } = await supabaseAdmin
      .from('pg_policies')
      .select('tablename, policyname, cmd, permissive, qual, with_check')
      .eq('tablename', 'avaliacoes_desempenho');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar políticas RLS', details: error.message },
        { status: 500 }
      );
    }

    // Verificar se RLS está habilitado
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('tablename', 'avaliacoes_desempenho')
      .single();

    return NextResponse.json({
      success: true,
      rls_enabled: tableInfo?.rowsecurity || false,
      policies_count: policies?.length || 0,
      policies: policies || [],
      message: `RLS ${tableInfo?.rowsecurity ? 'HABILITADO' : 'DESABILITADO'} com ${policies?.length || 0} políticas`
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar status do RLS', details: error.message },
      { status: 500 }
    );
  }
}
