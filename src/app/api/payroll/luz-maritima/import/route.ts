import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

/**
 * API para importação de dados da planilha AN-FIN-005-R0 do cliente LUZ Marítima
 * POST /api/payroll/luz-maritima/import
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const referenceMonth = parseInt(formData.get('referenceMonth') as string);
    const referenceYear = parseInt(formData.get('referenceYear') as string);

    if (!file || !companyId || !referenceMonth || !referenceYear) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo, empresa, mês e ano são obrigatórios'
      }, { status: 400 });
    }

    // Verificar se é o cliente LUZ Marítima
    const { data: company, error: companyError } = await supabaseAdmin
      .from('payroll_companies')
      .select('id, name')
      .eq('id', companyId)
      .eq('name', 'LUZ MARÍTIMA LTDA')
      .single();

    if (companyError || !company) {
      return NextResponse.json({
        success: false,
        error: 'Cliente LUZ Marítima não encontrado'
      }, { status: 404 });
    }

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Verificar se tem os sheets necessários
    if (!workbook.SheetNames.includes('payroll') || !workbook.SheetNames.includes('Cost')) {
      return NextResponse.json({
        success: false,
        error: 'Planilha deve conter os sheets "payroll" e "Cost"'
      }, { status: 400 });
    }

    // Criar ou buscar folha de pagamento
    let payrollSheetData;
    const { data: existingSheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_month', referenceMonth)
      .eq('reference_year', referenceYear)
      .single();

    if (sheetError && sheetError.code === 'PGRST116') {
      // Criar nova folha
      const { data: newSheet, error: createError } = await supabaseAdmin
        .from('payroll_sheets')
        .insert([{
          company_id: companyId,
          reference_month: referenceMonth,
          reference_year: referenceYear,
          period_start: new Date(referenceYear, referenceMonth - 1, 1),
          period_end: new Date(referenceYear, referenceMonth, 0),
          status: 'draft',
          notes: `Importado da planilha AN-FIN-005-R0 - ${file.name}`
        }])
        .select('id')
        .single();

      if (createError) {
        return NextResponse.json({
          success: false,
          error: 'Erro ao criar folha de pagamento'
        }, { status: 500 });
      }

      payrollSheetData = newSheet;
    } else if (sheetError) {
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar folha de pagamento'
      }, { status: 500 });
    } else {
      payrollSheetData = existingSheet;
    }

    // Processar Sheet 1 (Payroll) - colunas A até AB
    const payrollData = await processPayrollSheet(workbook, payrollSheetData.id, companyId);

    // Processar Sheet 2 (Cost) - custos fixos
    const costData = await processCostSheet(workbook, payrollSheetData.id);

    return NextResponse.json({
      success: true,
      data: {
        sheetId: payrollSheetData.id,
        employeesImported: payrollData.employeesCount,
        payrollRecords: payrollData.recordsCount,
        costRecords: costData.recordsCount
      },
      message: 'Dados importados com sucesso'
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function processPayrollSheet(workbook: XLSX.WorkBook, sheetId: string, companyId: string) {
  const payrollSheet = workbook.Sheets['payroll'];
  const payrollJson = XLSX.utils.sheet_to_json(payrollSheet, { header: 1 });
  
  let employeesCount = 0;
  let recordsCount = 0;

  // Buscar departamento padrão
  const { data: department } = await supabaseAdmin
    .from('payroll_departments')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', 'OPERACIONAL')
    .single();

  // Processar cada linha (assumindo que a primeira linha são headers)
  for (let i = 1; i < payrollJson.length; i++) {
    const row = payrollJson[i] as any[];
    
    if (!row || row.length === 0 || !row[0]) continue; // Pular linhas vazias
    
    const employeeName = row[0]?.toString().trim();
    if (!employeeName) continue;

    // Criar ou buscar funcionário
    let employeeData;
    const { data: existingEmployee, error: empError } = await supabaseAdmin
      .from('payroll_employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', employeeName)
      .single();

    if (empError && empError.code === 'PGRST116') {
      // Criar novo funcionário
      const { data: newEmployee, error: createEmpError } = await supabaseAdmin
        .from('payroll_employees')
        .insert([{
          company_id: companyId,
          department_id: department?.id,
          name: employeeName,
          registration_number: row[1]?.toString() || '',
          position: row[2]?.toString() || '',
          base_salary: parseFloat(row[3]?.toString() || '0') || 0,
          status: 'active'
        }])
        .select('id')
        .single();

      if (createEmpError) {
        console.error('Erro ao criar funcionário:', createEmpError);
        continue;
      }

      employeeData = newEmployee;
      employeesCount++;
    } else if (empError) {
      console.error('Erro ao buscar funcionário:', empError);
      continue;
    } else {
      employeeData = existingEmployee;
    }

    // Inserir dados do payroll (colunas A-AB)
    const payrollData: any = {
      employee_id: employeeData.id,
      sheet_id: sheetId
    };

    // Mapear colunas A-AB
    const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'aa', 'ab'];
    
    for (let colIndex = 0; colIndex < Math.min(28, row.length); colIndex++) {
      payrollData[`column_${columns[colIndex]}`] = row[colIndex]?.toString() || '';
    }

    const { error: insertError } = await supabaseAdmin
      .from('luz_maritima_payroll_data')
      .upsert([payrollData], { onConflict: 'employee_id,sheet_id' });

    if (!insertError) {
      recordsCount++;
    }
  }

  return { employeesCount, recordsCount };
}

async function processCostSheet(workbook: XLSX.WorkBook, sheetId: string) {
  const costSheet = workbook.Sheets['Cost'];
  const costJson = XLSX.utils.sheet_to_json(costSheet, { header: 1 });
  
  let recordsCount = 0;

  // Processar cada linha de custos
  for (let i = 1; i < costJson.length; i++) {
    const row = costJson[i] as any[];
    
    if (!row || row.length === 0 || !row[0]) continue;
    
    const employeeName = row[0]?.toString().trim();
    if (!employeeName) continue;

    // Buscar funcionário
    const { data: employee } = await supabaseAdmin
      .from('payroll_employees')
      .select('id')
      .eq('name', employeeName)
      .single();

    if (!employee) continue;

    // Inserir dados de custo (colunas G, H, I, K, N são fixas)
    const costData = {
      employee_id: employee.id,
      sheet_id: sheetId,
      // Custos fixos importados
      fixed_g: parseFloat(row[6]?.toString() || '0') || 0, // Coluna G
      fixed_h: parseFloat(row[7]?.toString() || '0') || 0, // Coluna H
      fixed_i: parseFloat(row[8]?.toString() || '0') || 0, // Coluna I
      fixed_k: parseFloat(row[10]?.toString() || '0') || 0, // Coluna K
      fixed_n: parseFloat(row[13]?.toString() || '0') || 0, // Coluna N
      // Valores manuais inicializados como 0 (serão preenchidos na interface)
      manual_d: 0,
      manual_e: 0,
      manual_f: 0,
      manual_j: 0,
      manual_m: 0
    };

    const { error: insertError } = await supabaseAdmin
      .from('luz_maritima_cost_data')
      .upsert([costData], { onConflict: 'employee_id,sheet_id' });

    if (!insertError) {
      recordsCount++;
    }
  }

  return { recordsCount };
}
