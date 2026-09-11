/**
 * Gerador de Planilhas Excel para o Sistema IA
 * Portal ABZ - Geração de relatórios em formato XLSX
 */
import * as XLSX from 'xlsx-js-style';

interface ExcelReportOptions {
  titulo: string;
  subtitulo?: string;
  periodo?: { inicio: string; fim: string };
  gerarPor?: string;
  incluirTotais?: boolean;
}

interface ColumnDef {
  key: string;
  header: string;
  width?: number;
  format?: (value: any) => string;
}

// Cores ABZ Group
const ABZ_COLORS = {
  primary: '1F4E79',
  secondary: '2E75B6',
  accent: '9BC2E6',
  headerBg: '1F4E79',
  headerFont: 'FFFFFF',
  altRow: 'E7E6E6',
  border: 'D9D9D9',
};

function createHeaderStyle() {
  return {
    fill: { fgColor: { rgb: ABZ_COLORS.headerBg } },
    font: { color: { rgb: ABZ_COLORS.headerFont }, bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      bottom: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      left: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      right: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
    },
  };
}

function createCellStyle(isAlt: boolean = false) {
  return {
    fill: isAlt ? { fgColor: { rgb: ABZ_COLORS.altRow } } : { fgColor: { rgb: 'FFFFFF' } },
    font: { sz: 10 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      bottom: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      left: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
      right: { style: 'thin', color: { rgb: ABZ_COLORS.border } },
    },
  };
}

function createTitleStyle() {
  return {
    font: { color: { rgb: ABZ_COLORS.primary }, bold: true, sz: 16 },
    alignment: { horizontal: 'center' },
  };
}

function createSubtitleStyle() {
  return {
    font: { color: { rgb: ABZ_COLORS.secondary }, sz: 11 },
    alignment: { horizontal: 'center' },
  };
}

/**
 * Gera uma planilha Excel com dados tabulares
 */
export function generateExcelReport<T extends Record<string, any>>(
  data: T[],
  columns: ColumnDef[],
  options: ExcelReportOptions
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([]);

  // Título
  const titleRow = [options.titulo];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  XLSX.utils.sheet_add_aoa(ws, [titleRow], { origin: 'A1' });
  
  // Aplicar estilo ao título
  const titleAddr = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[titleAddr].s = createTitleStyle();

  // Subtítulo (período e gerado por)
  const subtitleRow: (string | number)[] = [];
  if (options.periodo) {
    subtitleRow.push(`Período: ${options.periodo.inicio} a ${options.periodo.fim}`);
  }
  if (options.gerarPor) {
    subtitleRow.push(`Gerado por: ${options.gerarPor}`);
  }
  subtitleRow.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  
  XLSX.utils.sheet_add_aoa(ws, [subtitleRow], { origin: 'A2' });
  for (let c = 0; c < columns.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[addr]) ws[addr].s = createSubtitleStyle();
  }

  // Linha vazia
  XLSX.utils.sheet_add_aoa(ws, [[]], { origin: 'A3' });

  // Cabeçalho
  const headerRow = columns.map(col => col.header);
  XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A4' });
  
  // Aplicar estilo ao cabeçalho
  for (let c = 0; c < columns.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 3, c });
    ws[addr].s = createHeaderStyle();
  }

  // Dados
  const dataRows = data.map((item, rowIndex) => {
    return columns.map(col => {
      const value = item[col.key];
      return col.format ? col.format(value) : value ?? '';
    });
  });
  
  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A5' });

  // Aplicar estilo às células de dados
  for (let r = 0; r < dataRows.length; r++) {
    for (let c = 0; c < columns.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 4 + r, c });
      if (ws[addr]) {
        ws[addr].s = createCellStyle(r % 2 === 1);
      }
    }
  }

  // Largura das colunas
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  // Criar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  // Gerar buffer
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  
  return buffer;
}

/**
 * Formata dados de reembolsos para planilha
 */
export function formatReembolsosForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'descricao', header: 'Descrição', width: 30 },
    { key: 'categoria', header: 'Categoria', width: 15 },
    { key: 'valor', header: 'Valor', width: 12, format: (v: number) => v ? `R$ ${v.toFixed(2)}` : '' },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'data', header: 'Data', width: 12 },
  ];

  return { data, columns };
}

/**
 * Formata dados de férias para planilha
 */
export function formatFeriasForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'start_date', header: 'Início', width: 12 },
    { key: 'end_date', header: 'Fim', width: 12 },
    { key: 'dias', header: 'Dias', width: 8 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'reason', header: 'Motivo', width: 30 },
  ];

  return { data, columns };
}

/**
 * Formata dados de avaliações para planilha
 */
export function formatAvaliacoesForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'periodo', header: 'Período', width: 15 },
    { key: 'nota', header: 'Nota', width: 8 },
    { key: 'status', header: 'Status', width: 15 },
    { key: 'created_at', header: 'Data', width: 12 },
  ];

  return { data, columns };
}

/**
 * Formata dados de usuários para planilha
 */
export function formatUsuariosForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'nome', header: 'Nome', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'role', header: 'Role', width: 12 },
    { key: 'department', header: 'Departamento', width: 20 },
    { key: 'position', header: 'Cargo', width: 20 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'created_at', header: 'Criado em', width: 12 },
  ];

  return { data, columns };
}

/**
 * Formata dados de EPIs para planilha
 */
export function formatEpisForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'tipo_epi', header: 'Tipo EPI', width: 20 },
    { key: 'ca', header: 'CA', width: 10 },
    { key: 'delivery_date', header: 'Entrega', width: 12 },
    { key: 'status', header: 'Status', width: 12 },
  ];

  return { data, columns };
}

/**
 * Formata dados de ponto/presença para planilha
 */
export function formatPontoForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'funcao', header: 'Função', width: 20 },
    { key: 'empresa', header: 'Empresa', width: 20 },
    { key: 'evento', header: 'Evento', width: 25 },
    { key: 'local', header: 'Local', width: 20 },
    { key: 'data_evento', header: 'Data Evento', width: 14 },
    { key: 'registrado_em', header: 'Registrado em', width: 14 },
  ];
  return { data, columns };
}

/**
 * Formata dados de compras para planilha
 */
export function formatComprasForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Solicitante', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'departamento', header: 'Departamento', width: 20 },
    { key: 'numero', header: 'Número', width: 15 },
    { key: 'provider_name', header: 'Fornecedor', width: 25 },
    { key: 'buyer_name', header: 'Comprador', width: 20 },
    { key: 'valor', header: 'Valor', width: 12, format: (v: number) => v ? `R$ ${Number(v).toFixed(2)}` : '' },
    { key: 'status', header: 'Status', width: 14 },
    { key: 'created_at', header: 'Criado em', width: 14 },
  ];
  return { data, columns };
}

/**
 * Formata dados de eventos de calendário para planilha
 */
export function formatEventosForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'usuario', header: 'Usuário', width: 25 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'summary', header: 'Título', width: 30 },
    { key: 'location', header: 'Local', width: 20 },
    { key: 'start_time', header: 'Início', width: 16 },
    { key: 'end_time', header: 'Fim', width: 16 },
    { key: 'description', header: 'Descrição', width: 35 },
  ];
  return { data, columns };
}

/**
 * Formata dados de cursos Academy para planilha
 */
export function formatCursosForExcel(data: any[]): { data: any[]; columns: ColumnDef[] } {
  const columns: ColumnDef[] = [
    { key: 'title', header: 'Curso', width: 30 },
    { key: 'categoria', header: 'Categoria', width: 20 },
    { key: 'level', header: 'Nível', width: 12 },
    { key: 'is_active', header: 'Ativo', width: 10, format: (v: any) => (v ? 'Sim' : 'Não') },
    { key: 'description', header: 'Descrição', width: 40 },
  ];
  return { data, columns };
}

/**
 * Gera totais para incluir no relatório
 */
export function generateTotals(data: any[], groupBy: string, valueField: string): any[] {
  const totals: Record<string, { count: number; total: number }> = {};
  
  for (const item of data) {
    const key = item[groupBy] || 'Sem grupo';
    if (!totals[key]) {
      totals[key] = { count: 0, total: 0 };
    }
    totals[key].count++;
    totals[key].total += Number(item[valueField] || 0);
  }

  return Object.entries(totals).map(([key, value]) => ({
    grupo: key,
    quantidade: value.count,
    total: value.total,
  }));
}