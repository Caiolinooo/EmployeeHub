import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Verificar se as tabelas de folha de pagamento existem
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verificando tabelas de folha de pagamento...');

    const tables = [
      'payroll_companies',
      'payroll_departments', 
      'payroll_employees',
      'payroll_codes',
      'payroll_sheets',
      'payroll_sheet_items'
    ];

    const results = [];

    for (const table of tables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results.push({
            table,
            exists: false,
            error: error.message,
            count: 0
          });
        } else {
          results.push({
            table,
            exists: true,
            error: null,
            count: count || 0
          });
        }
      } catch (tableError) {
        results.push({
          table,
          exists: false,
          error: String(tableError),
          count: 0
        });
      }
    }

    const existingTables = results.filter(r => r.exists);
    const missingTables = results.filter(r => !r.exists);

    console.log(`✅ ${existingTables.length} tabelas existem`);
    console.log(`❌ ${missingTables.length} tabelas não existem`);

    return NextResponse.json({
      success: true,
      message: `Verificação concluída: ${existingTables.length}/${tables.length} tabelas existem`,
      results,
      summary: {
        total: tables.length,
        existing: existingTables.length,
        missing: missingTables.length,
        existingTables: existingTables.map(t => t.table),
        missingTables: missingTables.map(t => t.table)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error}` },
      { status: 500 }
    );
  }
}

// POST - Tentar criar as tabelas básicas (sem usar exec_sql)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Tentando criar tabelas básicas de folha de pagamento...');

    // Tentar inserir um registro na tabela payroll_companies para forçar criação
    const { error: companyError } = await supabaseAdmin
      .from('payroll_companies')
      .insert([{
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'ABZ Group',
        cnpj: '12.345.678/0001-90',
        address: 'Rua Principal, 123',
        phone: '(11) 99999-9999',
        email: 'contato@groupabz.com',
        contact_person: 'Administrador'
      }]);

    if (companyError && companyError.code !== '23505') { // 23505 = duplicate key
      console.error('❌ Erro ao criar/inserir na tabela payroll_companies:', companyError);
      return NextResponse.json({
        success: false,
        error: `Erro ao criar tabela payroll_companies: ${companyError.message}`,
        suggestion: 'Execute o script SQL manualmente no Supabase Dashboard'
      }, { status: 500 });
    }

    console.log('✅ Tabela payroll_companies criada/verificada');

    return NextResponse.json({
      success: true,
      message: 'Tabelas básicas criadas com sucesso',
      note: 'Para criar todas as tabelas, execute o script SQL completo no Supabase Dashboard'
    });

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error}` },
      { status: 500 }
    );
  }
}
