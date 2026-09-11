/**
 * Gerador de Relatórios PDF para o Sistema IA
 * Portal ABZ - Geração de PDFs com formatação padrão ABZ Group
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportOptions {
  titulo: string;
  subtitulo?: string;
  periodo?: { inicio: string; fim: string };
  gerarPor?: string;
  incluirGraficos?: boolean;
}

interface PDFColumnDef {
  key: string;
  header: string;
  format?: (value: any) => string;
}

// Cores ABZ Group
const ABZ_COLORS = {
  primary: [31, 78, 121],    // #1F4E79
  secondary: [46, 117, 182],  // #2E75B6
  accent: [155, 194, 230],   // #9BC2E6
  text: [51, 51, 51],        // #333333
  lightGray: [240, 240, 240],
};

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString('pt-BR');
  } catch {
    return dateStr;
  }
}

/**
 * Gera um relatório PDF com dados tabulares
 */
export function generatePDFReport<T extends Record<string, any>>(
  data: T[],
  columns: PDFColumnDef[],
  options: PDFReportOptions
): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;

  // ============ CABEÇALHO ============
  doc.setFillColor(ABZ_COLORS.primary[0], ABZ_COLORS.primary[1], ABZ_COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ABZ GROUP', pageWidth / 2, 12, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Portal Corporativo', pageWidth / 2, 18, { align: 'center' });

  // ============ TÍTULO DO RELATÓRIO ============
   currentY = 35;
   doc.setTextColor(ABZ_COLORS.primary[0], ABZ_COLORS.primary[1], ABZ_COLORS.primary[2]);
   doc.setFontSize(16);
   doc.setFont('helvetica', 'bold');
  doc.text(options.titulo, pageWidth / 2, currentY, { align: 'center' });

   // ============ INFORMAÇÕES DO RELATÓRIO ============
   currentY += 10;
   doc.setTextColor(ABZ_COLORS.text[0], ABZ_COLORS.text[1], ABZ_COLORS.text[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const infoLines: string[] = [];
  if (options.periodo) {
    infoLines.push(`Período: ${options.periodo.inicio} a ${options.periodo.fim}`);
  }
  if (options.gerarPor) {
    infoLines.push(`Gerado por: Usuário ${options.gerarPor.substring(0, 8)}...`);
  }
  infoLines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  infoLines.push(`Total de registros: ${data.length}`);

  for (const line of infoLines) {
    doc.text(line, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
  }

  currentY += 5;

  // ============ TABELA DE DADOS ============
  if (data.length > 0) {
    const headers = columns.map(col => col.header);
    const body = data.slice(0, 100).map(row => 
      columns.map(col => {
        const value = row[col.key];
        if (col.format) {
          return col.format(value);
        }
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'number' && col.key.toLowerCase().includes('valor')) {
          return formatCurrency(value);
        }
        if (col.key.toLowerCase().includes('date') || col.key.toLowerCase().includes('data')) {
          return formatDate(value);
        }
        return String(value);
      })
    );

    autoTable(doc, {
      startY: currentY,
      head: [headers],
      body: body,
      theme: 'grid',
       headStyles: {
         fillColor: [ABZ_COLORS.primary[0], ABZ_COLORS.primary[1], ABZ_COLORS.primary[2]],
         textColor: [255, 255, 255],
         fontStyle: 'bold',
        fontSize: 9,
      },
       bodyStyles: {
         fontSize: 8,
         textColor: [ABZ_COLORS.text[0], ABZ_COLORS.text[1], ABZ_COLORS.text[2]],
       },
       alternateRowStyles: {
         fillColor: [ABZ_COLORS.lightGray[0], ABZ_COLORS.lightGray[1], ABZ_COLORS.lightGray[2]],
       },
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
    });
  }

  // ============ RODAPÉ ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount} | ABZ Group Portal | Gerado em ${new Date().toLocaleString('pt-BR')}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Gera um relatório resumido de reembolsos em PDF
 */
export function generateReembolsoPDF(data: any[], options: PDFReportOptions): Buffer {
  const columns: PDFColumnDef[] = [
    { key: 'usuario', header: 'Usuário' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'descricao', header: 'Descrição' },
    { key: 'categoria', header: 'Categoria' },
    { key: 'valor', header: 'Valor', format: formatCurrency },
    { key: 'status', header: 'Status' },
    { key: 'data', header: 'Data', format: formatDate },
  ];

  // Calcular totais
  const totalValor = data.reduce((sum: number, r: any) => sum + (parseFloat(r.valor) || 0), 0);
  const porStatus: Record<string, number> = {};
  for (const r of data) {
    porStatus[r.status] = (porStatus[r.status] || 0) + 1;
  }

  // Adicionar totais aos dados
  const dataComTotais = [...data, {
    usuario: 'TOTAL',
    descricao: '',
    categoria: '',
    valor: totalValor,
    status: '',
    data: '',
  }];

  return generatePDFReport(dataComTotais, columns, {
    ...options,
    subtitulo: `Total: ${data.length} registros | Valor Total: ${formatCurrency(totalValor)}`,
  });
}

/**
 * Gera um relatório resumido de férias em PDF
 */
export function generateFeriasPDF(data: any[], options: PDFReportOptions): Buffer {
  const columns: PDFColumnDef[] = [
    { key: 'usuario', header: 'Usuário' },
    { key: 'departamento', header: 'Departamento' },
    { key: 'start_date', header: 'Início', format: formatDate },
    { key: 'end_date', header: 'Fim', format: formatDate },
    { key: 'dias', header: 'Dias' },
    { key: 'status', header: 'Status' },
  ];

  // Contagem por status
  const porStatus: Record<string, number> = {};
  for (const f of data) {
    porStatus[f.status] = (porStatus[f.status] || 0) + 1;
  }

  const dataComTotais = [...data, {
    usuario: 'TOTAL',
    departamento: '',
    start_date: '',
    end_date: '',
    dias: data.length,
    status: '',
  }];

  return generatePDFReport(dataComTotais, columns, options);
}

/**
 * Gera um relatório de KPIs em PDF
 */
export function generateKPIsPDF(data: any, options: PDFReportOptions): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
   // Cabeçalho
   doc.setFillColor(ABZ_COLORS.primary[0], ABZ_COLORS.primary[1], ABZ_COLORS.primary[2]);
   doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ABZ GROUP', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Dashboard de Indicadores', pageWidth / 2, 18, { align: 'center' });

   let y = 45;
   doc.setTextColor(ABZ_COLORS.text[0], ABZ_COLORS.text[1], ABZ_COLORS.text[2]);
   doc.setFontSize(16);
   doc.setFont('helvetica', 'bold');
   doc.text(options.titulo, 20, y);
  
  y += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  // KPIs em cards
  const kpis = [
    { label: 'Total de Usuários', value: data.total_usuarios },
    { label: 'Férias Pendentes', value: data.ferias_pendentes },
    { label: 'Reembolsos Pendentes', value: data.reembolsos_pendentes },
    { label: 'Sessões de IA', value: data.total_sessoes_ia },
  ];

   for (const kpi of kpis) {
     doc.setFillColor(ABZ_COLORS.lightGray[0], ABZ_COLORS.lightGray[1], ABZ_COLORS.lightGray[2]);
     doc.roundedRect(20, y, pageWidth - 40, 20, 3, 3, 'F');
    doc.setFontSize(11);
    doc.text(kpi.label, 25, y + 8);
     doc.setFontSize(14);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(ABZ_COLORS.primary[0], ABZ_COLORS.primary[1], ABZ_COLORS.primary[2]);
     doc.text(String(kpi.value || 0), pageWidth - 25, y + 13, { align: 'right' });
     doc.setTextColor(ABZ_COLORS.text[0], ABZ_COLORS.text[1], ABZ_COLORS.text[2]);
    doc.setFont('helvetica', 'normal');
    y += 25;
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} | ABZ Group Portal`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Gera um PDF em memória e retorna como base64
 */
export function generatePDFBase64(
  data: any[],
  type: 'reembolsos' | 'ferias' | 'avaliacoes' | 'epis' | 'usuarios' | 'kpis' | 'ponto' | 'compras' | 'resumo',
  options: PDFReportOptions
): string {
  let buffer: Buffer;

  switch (type) {
    case 'reembolsos':
      buffer = generateReembolsoPDF(data, options);
      break;
    case 'ferias':
      buffer = generateFeriasPDF(data, options);
      break;
    case 'kpis':
      buffer = generateKPIsPDF(data, options);
      break;
    default:
      buffer = generatePDFReport(data, [], options);
  }

  return buffer.toString('base64');
}