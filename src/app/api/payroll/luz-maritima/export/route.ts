import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API para exportação de dados do cliente LUZ Marítima
 * Gera arquivo Excel com o mesmo layout da planilha AN-FIN-005-R0
 * GET /api/payroll/luz-maritima/export
 */
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json({
        success: false,
        error: 'Esta rota só pode ser executada no servidor'
      }, { status: 500 });
    }

    // Check if we're in a static generation context
    if (!request || !request.url) {
      return NextResponse.json({
        success: false,
        error: 'Rota não disponível durante geração estática'
      }, { status: 503 });
    }

    let sheetId = null;
    let format = 'excel';
    
    try {
      const { searchParams } = new URL(request.url);
      sheetId = searchParams.get('sheetId');
      format = searchParams.get('format') || 'excel'; // excel ou invoice
    } catch (error) {
      console.error('Erro ao processar URL:', error);
      return NextResponse.json({
        success: false,
        error: 'URL inválida'
      }, { status: 400 });
    }

    if (!sheetId) {
      return NextResponse.json({
        success: false,
        error: 'ID da folha é obrigatório'
      }, { status: 400 });
    }

    // Buscar dados da folha
    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select(`
        *,
        company:payroll_companies(*)
      `)
      .eq('id', sheetId)
      .single();

    if (sheetError || !sheet) {
      return NextResponse.json({
        success: false,
        error: 'Folha de pagamento não encontrada'
      }, { status: 404 });
    }

    // Verificar se é LUZ Marítima
    if (sheet.company.name !== 'LUZ MARÍTIMA LTDA') {
      return NextResponse.json({
        success: false,
        error: 'Esta API é específica para o cliente LUZ Marítima'
      }, { status: 403 });
    }

    if (format === 'invoice') {
      return await exportInvoice(sheetId, sheet);
    } else {
      return await exportExcel(sheetId, sheet);
    }

  } catch (error) {
    console.error('Erro na exportação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function exportExcel(sheetId: string, sheet: any) {
  // Buscar dados do payroll
  const { data: payrollData, error: payrollError } = await supabaseAdmin
    .from('luz_maritima_payroll_data')
    .select(`
      *,
      employee:payroll_employees(*)
    `)
    .eq('sheet_id', sheetId)
    .order('employee.name');

  if (payrollError) {
    throw new Error('Erro ao buscar dados do payroll');
  }

  // Buscar dados de custo
  const { data: costData, error: costError } = await supabaseAdmin
    .from('luz_maritima_cost_data')
    .select(`
      *,
      employee:payroll_employees(*)
    `)
    .eq('sheet_id', sheetId)
    .order('employee.name');

  if (costError) {
    throw new Error('Erro ao buscar dados de custo');
  }

  // Criar workbook
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Payroll
  const payrollSheetData = [];
  
  // Header do payroll
  const payrollHeaders = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'];
  payrollSheetData.push(payrollHeaders);

  // Dados do payroll
  for (const record of payrollData) {
    const row = [];
    const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'aa', 'ab'];
    
    for (const col of columns) {
      row.push(record[`column_${col}`] || '');
    }
    payrollSheetData.push(row);
  }

  const payrollWS = XLSX.utils.aoa_to_sheet(payrollSheetData);
  XLSX.utils.book_append_sheet(workbook, payrollWS, 'payroll');

  // Sheet 2: Cost
  const costSheetData = [];
  
  // Header do cost
  const costHeaders = ['Employee', 'Registration', 'Position', 'Manual D', 'Manual E', 'Manual F', 'Fixed G', 'Fixed H', 'Fixed I', 'Manual J', 'Fixed K', 'Manual M', 'Fixed N'];
  costSheetData.push(costHeaders);

  // Dados de custo
  for (const record of costData) {
    const row = [
      record.employee.name,
      record.employee.registration_number || '',
      record.employee.position || '',
      record.manual_d || 0,
      record.manual_e || 0,
      record.manual_f || 0,
      record.fixed_g || 0,
      record.fixed_h || 0,
      record.fixed_i || 0,
      record.manual_j || 0,
      record.fixed_k || 0,
      record.manual_m || 0,
      record.fixed_n || 0
    ];
    costSheetData.push(row);
  }

  const costWS = XLSX.utils.aoa_to_sheet(costSheetData);
  XLSX.utils.book_append_sheet(workbook, costWS, 'Cost');

  // Sheet 3: Invoice (resumo)
  const invoiceData = await generateInvoiceData(costData, sheet);
  const invoiceWS = XLSX.utils.aoa_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(workbook, invoiceWS, 'Invoice');

  // Gerar buffer do Excel
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Retornar arquivo
  const fileName = `LUZ_MARITIMA_${sheet.reference_month}_${sheet.reference_year}.xlsx`;
  
  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}

async function exportInvoice(sheetId: string, sheet: any) {
  // Buscar dados de custo para o invoice
  const { data: costData, error: costError } = await supabaseAdmin
    .from('luz_maritima_cost_data')
    .select(`
      *,
      employee:payroll_employees(*)
    `)
    .eq('sheet_id', sheetId)
    .order('employee.name');

  if (costError) {
    throw new Error('Erro ao buscar dados de custo');
  }

  // Gerar dados do invoice
  const invoiceData = await generateInvoiceData(costData, sheet);
  
  // Criar workbook apenas com invoice
  const workbook = XLSX.utils.book_new();
  const invoiceWS = XLSX.utils.aoa_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(workbook, invoiceWS, 'Invoice');

  // Gerar buffer do Excel
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Retornar arquivo
  const fileName = `LUZ_MARITIMA_INVOICE_${sheet.reference_month}_${sheet.reference_year}.xlsx`;
  
  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}

async function generateInvoiceData(costData: any[], sheet: any) {
  const invoiceData = [];
  
  // Header do invoice
  invoiceData.push([
    'LUZ MARÍTIMA LTDA - INVOICE',
    '',
    '',
    `Período: ${sheet.reference_month}/${sheet.reference_year}`
  ]);
  invoiceData.push([]); // Linha vazia
  
  // Headers das colunas
  invoiceData.push([
    'Funcionário',
    'Posição',
    'Custos Manuais',
    'Custos Fixos',
    'Total'
  ]);

  let totalManual = 0;
  let totalFixed = 0;
  let totalGeral = 0;

  // Dados dos funcionários
  for (const record of costData) {
    const custoManual = (record.manual_d || 0) + (record.manual_e || 0) + (record.manual_f || 0) + (record.manual_j || 0) + (record.manual_m || 0);
    const custoFixo = (record.fixed_g || 0) + (record.fixed_h || 0) + (record.fixed_i || 0) + (record.fixed_k || 0) + (record.fixed_n || 0);
    const total = custoManual + custoFixo;

    invoiceData.push([
      record.employee.name,
      record.employee.position || '',
      custoManual.toFixed(2),
      custoFixo.toFixed(2),
      total.toFixed(2)
    ]);

    totalManual += custoManual;
    totalFixed += custoFixo;
    totalGeral += total;
  }

  // Linha de totais
  invoiceData.push([]); // Linha vazia
  invoiceData.push([
    'TOTAIS',
    '',
    totalManual.toFixed(2),
    totalFixed.toFixed(2),
    totalGeral.toFixed(2)
  ]);

  return invoiceData;
}
