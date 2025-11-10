import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API para gerenciar dados manuais do cliente LUZ Marítima
 * Colunas D, E, F, J, M do Sheet Cost que devem ser preenchidas manualmente
 */

/**
 * GET /api/payroll/luz-maritima/manual-data
 * Lista dados manuais para preenchimento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId');
    const employeeId = searchParams.get('employeeId');

    if (!sheetId) {
      return NextResponse.json({
        success: false,
        error: 'ID da folha é obrigatório'
      }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('luz_maritima_cost_data')
      .select(`
        *,
        employee:payroll_employees(id, name, position, registration_number),
        sheet:payroll_sheets(id, reference_month, reference_year, status)
      `)
      .eq('sheet_id', sheetId);

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query.order('employee.name');

    if (error) {
      console.error('Erro ao buscar dados manuais:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar dados'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro na consulta:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

/**
 * PUT /api/payroll/luz-maritima/manual-data
 * Atualiza dados manuais
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, sheetId, manualData } = body;

    if (!employeeId || !sheetId || !manualData) {
      return NextResponse.json({
        success: false,
        error: 'ID do funcionário, folha e dados manuais são obrigatórios'
      }, { status: 400 });
    }

    // Validar dados manuais
    const validFields = ['manual_d', 'manual_e', 'manual_f', 'manual_j', 'manual_m'];
    const updateData: any = {};

    for (const field of validFields) {
      if (manualData[field] !== undefined) {
        const value = parseFloat(manualData[field]);
        if (isNaN(value)) {
          return NextResponse.json({
            success: false,
            error: `Valor inválido para ${field}`
          }, { status: 400 });
        }
        updateData[field] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum dado válido para atualizar'
      }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    // Atualizar dados
    const { data, error } = await supabaseAdmin
      .from('luz_maritima_cost_data')
      .update(updateData)
      .eq('employee_id', employeeId)
      .eq('sheet_id', sheetId)
      .select(`
        *,
        employee:payroll_employees(id, name, position),
        sheet:payroll_sheets(id, reference_month, reference_year)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar dados manuais:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar dados'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Dados atualizados com sucesso'
    });

  } catch (error) {
    console.error('Erro na atualização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

/**
 * POST /api/payroll/luz-maritima/manual-data/batch
 * Atualiza múltiplos registros de uma vez
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sheetId, updates } = body;

    if (!sheetId || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ID da folha e lista de atualizações são obrigatórios'
      }, { status: 400 });
    }

    const results = [];
    const errors = [];

    // Processar cada atualização
    for (const update of updates) {
      const { employeeId, manualData } = update;

      if (!employeeId || !manualData) {
        errors.push({ employeeId, error: 'Dados incompletos' });
        continue;
      }

      // Validar e preparar dados
      const validFields = ['manual_d', 'manual_e', 'manual_f', 'manual_j', 'manual_m'];
      const updateData: any = { updated_at: new Date().toISOString() };

      for (const field of validFields) {
        if (manualData[field] !== undefined) {
          const value = parseFloat(manualData[field]);
          if (isNaN(value)) {
            errors.push({ employeeId, error: `Valor inválido para ${field}` });
            continue;
          }
          updateData[field] = value;
        }
      }

      // Atualizar registro
      const { data, error } = await supabaseAdmin
        .from('luz_maritima_cost_data')
        .update(updateData)
        .eq('employee_id', employeeId)
        .eq('sheet_id', sheetId)
        .select('employee_id')
        .single();

      if (error) {
        errors.push({ employeeId, error: error.message });
      } else {
        results.push({ employeeId, success: true });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: results.length,
        errors: errors.length,
        results,
        errorDetails: errors
      },
      message: `${results.length} registros atualizados, ${errors.length} erros`
    });

  } catch (error) {
    console.error('Erro na atualização em lote:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
