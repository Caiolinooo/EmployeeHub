import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateEmployeePayroll, PerfilCalculo } from '@/lib/payroll/calculations';
import { PayrollApiResponse, PayrollCalculationResult, PayrollCalculationInput } from '@/types/payroll';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * Converte o rules JSONB de payroll_calculation_profiles no PerfilCalculo do motor.
 * Formato legado (seed): { inss: { enabled }, irrf: { enabled }, fgts: { enabled },
 * vale_transporte: { percentage, max_percentage_salary } }.
 */
function derivarPerfilDeRules(rules: Record<string, unknown> | undefined | null): PerfilCalculo | undefined {
  if (!rules || typeof rules !== 'object') return undefined;

  const desligado = (v: unknown): boolean => {
    if (typeof v === 'boolean') return !v;
    if (v && typeof v === 'object' && 'enabled' in v) {
      const { enabled } = v; // narrowing via `in` — prop infere unknown
      return enabled === false;
    }
    return false;
  };

  let tetoVT: number | undefined;
  const vt = rules['vale_transporte'];
  if (vt && typeof vt === 'object' && 'max_percentage_salary' in vt) {
    const { max_percentage_salary } = vt;
    if (typeof max_percentage_salary === 'number') tetoVT = max_percentage_salary;
  }

  const perfil: PerfilCalculo = {
    ignorarInss: desligado(rules['inss']),
    ignorarIrrf: desligado(rules['irrf']),
    ignorarFgts: desligado(rules['fgts']),
    tetoVTPercentual: tetoVT,
  };
  const temRegra = perfil.ignorarInss || perfil.ignorarIrrf || perfil.ignorarFgts || typeof tetoVT === 'number';
  return temRegra ? perfil : undefined;
}

/**
 * POST /api/payroll/calculate
 * Calcula a folha de pagamento para um funcionário
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    const body: PayrollCalculationInput = await request.json();

    // Validar dados obrigatórios
    if (!body.employee || !body.items) {
      return NextResponse.json({
        success: false,
        error: 'Dados do funcionário e itens são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Calcular folha de pagamento (perfil opcional do body)
    const result = calculateEmployeePayroll(body.employee, body.items, derivarPerfilDeRules(body.profile?.rules));

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Cálculo realizado com sucesso'
    } as PayrollApiResponse<PayrollCalculationResult>);
  } catch (error) {
    console.error('Erro ao calcular folha:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao calcular folha de pagamento'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * POST /api/payroll/calculate/sheet
 * Calcula uma folha de pagamento completa
 */
export async function PUT(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    const { sheetId } = await request.json();

    if (!sheetId) {
      return NextResponse.json({
        success: false,
        error: 'ID da folha é obrigatório'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Buscar folha de pagamento
    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select(`
        *,
        company:payroll_companies(*),
        department:payroll_departments(*)
      `)
      .eq('id', sheetId)
      .single();

    if (sheetError || !sheet) {
      return NextResponse.json({
        success: false,
        error: 'Folha de pagamento não encontrada'
      } as PayrollApiResponse<null>, { status: 404 });
    }

    // Buscar funcionários da empresa/departamento
    let employeesQuery = supabaseAdmin
      .from('payroll_employees')
      .select('*')
      .eq('company_id', sheet.company_id)
      .eq('status', 'active');

    if (sheet.department_id) {
      employeesQuery = employeesQuery.eq('department_id', sheet.department_id);
    }

    const { data: employees, error: employeesError } = await employeesQuery;

    if (employeesError) {
      console.error('Erro ao buscar funcionários:', employeesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar funcionários'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum funcionário ativo encontrado'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Buscar códigos ativos
    const { data: codes, error: codesError } = await supabaseAdmin
      .from('payroll_codes')
      .select('*')
      .eq('is_active', true);

    if (codesError) {
      console.error('Erro ao buscar códigos:', codesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar códigos de folha'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    // Buscar itens existentes da folha
    const { data: existingItems } = await supabaseAdmin
      .from('payroll_sheet_items')
      .select('*')
      .eq('sheet_id', sheetId);

    // Perfil de cálculo (default ativo da empresa) → PerfilCalculo do motor
    const { data: perfilDefault } = await supabaseAdmin
      .from('payroll_calculation_profiles')
      .select('rules')
      .eq('company_id', sheet.company_id)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    const perfil = derivarPerfilDeRules(perfilDefault?.rules);

    const results: PayrollCalculationResult[] = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalInss = 0;
    let totalIrrf = 0;
    let totalFgts = 0;

    // Calcular para cada funcionário
    for (const employee of employees) {
      // Buscar itens específicos do funcionário ou usar itens padrão
      const employeeItems = existingItems?.filter(item => item.employee_id === employee.id) || [];
      
      // Se não há itens específicos, usar códigos padrão (salário base + descontos legais)
      const calculationItems = employeeItems.length > 0 
        ? employeeItems.map(item => {
            const code = codes?.find(c => c.id === item.code_id);
            const codigo = code?.code || '';
            const informado = Number(item.calculated_value);
            const legal = code?.legal_type === 'inss' || code?.legal_type === 'irrf' || code?.legal_type === 'fgts';
            const natureza = codigo === '005' || codigo === '006' ? 'ferias'
              : codigo === '007' ? 'decimo'
              : ['301','302','303','304','305','306','307'].includes(codigo) ? 'rescisao'
              : 'mensal';
            return {
              codeId: item.code_id,
              code: codigo,
              type: code?.type || 'provento',
              name: code?.name || '',
              calculationType: code?.calculation_type || 'fixed',
              value: code?.value || 0,
              quantity: item.quantity,
              referenceValue: item.reference_value,
              legalType: code?.legal_type,
              formula: code?.formula,
              natureza,
              // Valor já apurado (dias × diária). Recalcular por code.value zeraria a verba.
              ...(legal || !Number.isFinite(informado) || informado === 0 ? {} : { valorInformado: informado }),
            };
          })
        : [
            // Salário base
            {
              codeId: 'base-salary',
              code: '001',
              type: 'provento' as const,
              name: 'Salário Base',
              calculationType: 'fixed' as const,
              value: employee.base_salary,
              quantity: 1,
              referenceValue: employee.base_salary
            },
            // INSS
            {
              codeId: 'inss-legal',
              code: '104',
              type: 'desconto' as const,
              name: 'INSS',
              calculationType: 'legal' as const,
              value: 0,
              legalType: 'inss' as const
            },
            // IRRF
            {
              codeId: 'irrf-legal',
              code: '108',
              type: 'desconto' as const,
              name: 'IRRF',
              calculationType: 'legal' as const,
              value: 0,
              legalType: 'irrf' as const
            },
            // FGTS
            {
              codeId: 'fgts-legal',
              code: '119',
              type: 'outros' as const,
              name: 'FGTS 8%',
              calculationType: 'legal' as const,
              value: 0,
              legalType: 'fgts' as const
            }
          ];

      const competencia = {
        mes: Number(sheet.reference_month),
        ano: Number(sheet.reference_year),
      };
      const result = calculateEmployeePayroll(employee, calculationItems, perfil, competencia);
      results.push(result);

      // Acumular totais
      totalGross += result.grossSalary;
      totalDeductions += result.totalDeductions;
      totalNet += result.netSalary;
      totalInss += result.inssValue;
      totalIrrf += result.irrfValue;
      totalFgts += result.fgtsValue;

      // Salvar/atualizar resumo do funcionário
      await supabaseAdmin
        .from('payroll_employee_summaries')
        .upsert({
          sheet_id: sheetId,
          employee_id: employee.id,
          base_salary: result.baseSalary,
          total_earnings: result.totalEarnings,
          total_deductions: result.totalDeductions,
          total_others: result.totalOthers,
          inss_base: result.inssBase,
          irrf_base: result.irrfBase,
          fgts_base: result.fgtsBase,
          inss_value: result.inssValue,
          irrf_value: result.irrfValue,
          fgts_value: result.fgtsValue,
          gross_salary: result.grossSalary,
          net_salary: result.netSalary
        }, {
          onConflict: 'sheet_id,employee_id'
        });

      // Salvar/atualizar itens da folha
      for (const item of result.items) {
        await supabaseAdmin
          .from('payroll_sheet_items')
          .upsert({
            sheet_id: sheetId,
            employee_id: employee.id,
            code_id: item.codeId,
            quantity: item.quantity,
            reference_value: item.referenceValue,
            calculated_value: item.calculatedValue,
            observation: (item as any).observation
          }, {
            onConflict: 'sheet_id,employee_id,code_id'
          });
      }
    }

    // Atualizar totais da folha
    const { error: updateError } = await supabaseAdmin
      .from('payroll_sheets')
      .update({
        status: 'calculated',
        total_employees: employees.length,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        total_inss: totalInss,
        total_irrf: totalIrrf,
        total_fgts: totalFgts,
        updated_at: new Date().toISOString()
      })
      .eq('id', sheetId);

    if (updateError) {
      console.error('Erro ao atualizar folha:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar totais da folha'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetId,
        totalEmployees: employees.length,
        totalGross,
        totalDeductions,
        totalNet,
        totalInss,
        totalIrrf,
        totalFgts,
        results
      },
      message: 'Folha calculada com sucesso'
    } as PayrollApiResponse<any>);
  } catch (error) {
    console.error('Erro ao calcular folha completa:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao calcular folha de pagamento'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
