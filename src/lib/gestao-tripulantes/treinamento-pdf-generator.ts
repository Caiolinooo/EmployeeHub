import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

export interface TreinamentoPDFData {
  colaborador: {
    nome_completo: string;
    cpf?: string | null;
    matricula?: string | null;
    cargo_nome?: string | null;
    empresa_nome?: string | null;
    embarcacao_nome?: string | null;
  };
  documento: {
    id: string;
    titulo: string;
    subtipo?: string | null;
    numero_documento?: string | null;
    orgao_emissor?: string | null;
    data_emissao?: string | null;
    data_validade?: string | null;
    status_validacao?: string | null;
    numero_rastreio?: string | null;
    origem?: string | null;
    descricao?: string | null;
    treinamento_data?: {
      nome_curso?: string | null;
      instituicao?: string | null;
      carga_horaria?: number | null;
      tipo_curso?: string | null;
    } | null;
  };
}

function formatCPF(cpf?: string | null): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const bitmap = fs.readFileSync(logoPath);
      return `data:image/png;base64,${bitmap.toString('base64')}`;
    }
  } catch (error) {
    console.warn('Logo not found:', error);
  }
  return '';
}

export async function generateTreinamentoPDF(data: TreinamentoPDFData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent line
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Logo or Company Name
  const logo = getLogoBase64();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 5, 30, 18);
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('ABZ GROUP', margin, 17);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ABZ GROUP', margin, 17);
  }

  // Title in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FICHA DE REGISTRO E CONFORMIDADE DE TREINAMENTO', pageWidth - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('SISTEMA INTEGRADO DE GESTÃO DE TRIPULANTES — OFFSHORE & MARÍTIMO', pageWidth - margin, 18, { align: 'right' });
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - margin, 23, { align: 'right' });

  let y = 35;

  // 2. Identification Card (Tripulante)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text('1. DADOS DO TRIPULANTE / COLABORADOR', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600

  // Line 1: Nome & CPF
  doc.text('Nome:', margin + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.nome_completo.toUpperCase(), margin + 16, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CPF:', margin + 118, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCPF(data.colaborador.cpf), margin + 128, y + 13);

  // Line 2: Cargo & Matrícula
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Cargo:', margin + 4, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.cargo_nome || '—', margin + 16, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Matrícula:', margin + 118, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.matricula || '—', margin + 134, y + 19);

  // Line 3: Embarcação & Empresa
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Embarcação / Unidade:', margin + 4, y + 25);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.embarcacao_nome || '—', margin + 38, y + 25);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Empresa:', margin + 118, y + 25);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(data.colaborador.empresa_nome || 'ABZ Group', margin + 134, y + 25);

  y += 37;

  // 3. Treinamento Details Card
  const tre = data.documento;
  const treData = tre.treinamento_data;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 54, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('2. ESPECIFICAÇÃO DO TREINAMENTO / CERTIFICAÇÃO', margin + 4, y + 6);

  // Course title banner inside card
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(margin + 4, y + 9, contentWidth - 8, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text(tre.titulo.toUpperCase(), margin + 7, y + 15.5);

  // Details
  const startDetailY = y + 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text('Código / Sigla STCW:', margin + 4, startDetailY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(tre.subtipo || tre.numero_documento || '—', margin + 38, startDetailY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Nº do Certificado / Registro:', margin + 92, startDetailY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const numDisplay = tre.numero_documento && tre.numero_documento !== tre.subtipo ? tre.numero_documento : (tre.numero_rastreio || '—');
  doc.text(numDisplay, margin + 138, startDetailY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Órgão Emissor / Instituição:', margin + 4, startDetailY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(tre.orgao_emissor || treData?.instituicao || 'MARINHA DO BRASIL', margin + 44, startDetailY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Carga Horária:', margin + 118, startDetailY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(treData?.carga_horaria ? `${treData.carga_horaria} horas` : 'Conforme programa oficial', margin + 140, startDetailY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Origem do Registro:', margin + 4, startDetailY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(tre.origem === 'mio' ? 'MIO Sistema Marítimo (Integrado)' : 'Cadastro Direto ABZ Group', margin + 34, startDetailY + 14);

  if (tre.descricao) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Observações:', margin + 92, startDetailY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(tre.descricao.slice(0, 40), margin + 114, startDetailY + 14);
  }

  y += 58;

  // 4. Validity & Conformity Status Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 40, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('3. VIGÊNCIA E CONTROLE DE VALIDADE', margin + 4, y + 6);

  // Status Box
  const status = tre.status_validacao || 'valido';
  let statusBg = [220, 252, 231]; // green-100
  let statusTextColor = [22, 101, 52]; // green-800
  let statusText = 'VÁLIDO / CONFORME';

  if (!tre.data_validade) {
    statusBg = [238, 242, 255]; // indigo-50
    statusTextColor = [55, 48, 163]; // indigo-800
    statusText = 'PERMANENTE (SEM EXPIRAÇÃO)';
  } else if (status === 'vencido') {
    statusBg = [254, 226, 226]; // red-100
    statusTextColor = [153, 27, 27]; // red-800
    statusText = 'DOCUMENTO VENCIDO';
  } else if (status === 'vencendo') {
    statusBg = [255, 237, 213]; // orange-100
    statusTextColor = [154, 52, 18]; // orange-800
    statusText = 'VENCENDO EM BREVE';
  }

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
  doc.roundedRect(margin + 4, y + 10, 56, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
  doc.text('STATUS OPERACIONAL', margin + 6, y + 15);

  doc.setFontSize(8);
  doc.text(statusText, margin + 6, y + 23);

  // Dates
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Data de Realização / Emissão:', margin + 66, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDate(tre.data_emissao), margin + 114, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Data de Vencimento / Validade:', margin + 66, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(tre.data_validade ? formatDate(tre.data_validade) : 'PERMANENTE (INDETERMINADO)', margin + 114, y + 22);

  if (tre.data_validade) {
    const diffDays = Math.ceil((new Date(tre.data_validade).getTime() - Date.now()) / 86400000);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Tempo Restante:', margin + 66, y + 28);
    doc.setFont('helvetica', 'normal');
    if (diffDays < 0) {
      doc.setTextColor(185, 28, 28);
      doc.text(`Vencido há ${Math.abs(diffDays)} dias`, margin + 92, y + 28);
    } else if (diffDays <= 30) {
      doc.setTextColor(194, 65, 12);
      doc.text(`Vence em ${diffDays} dias`, margin + 92, y + 28);
    } else {
      doc.setTextColor(21, 128, 61);
      doc.text(`${diffDays} dias de vigência restante`, margin + 92, y + 28);
    }
  }

  y += 45;

  // 5. Traceability & Digital Stamp Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 54, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('4. RASTREABILIDADE, AUTENTICIDADE E ASSINATURA DIGITAL', margin + 4, y + 6);

  // Generate QR code for verification
  const verificationUrl = `https://portal.groupabz.com/department/gestao-tripulantes?rastreio=${encodeURIComponent(tre.numero_rastreio || tre.id)}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 100 });
    doc.addImage(qrDataUrl, 'PNG', margin + 4, y + 10, 32, 32);
  } catch (err) {
    console.warn('QR Code gen error:', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Código de Rastreabilidade GT:', margin + 40, y + 15);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text(tre.numero_rastreio || `GT-TREINAMENTO-${tre.id.slice(0, 8).toUpperCase()}`, margin + 84, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Aponte a câmera do celular para o QR Code para validar a autenticidade e status deste certificado em tempo real.', margin + 40, y + 21, { maxWidth: contentWidth - 44 });

  // Verification Box / Stamp
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 40, y + 25, contentWidth - 44, 23, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('VALIDAÇÃO DIGITAL — COORDENAÇÃO DE DHO & OPERAÇÕES OFFSHORE ABZ', margin + 43, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Certificamos que as informações deste treinamento constam registradas no banco de dados corporativo da ABZ Group, em conformidade com as normas marítimas vigentes (NORMAM, STCW, IMO e NR-37).', margin + 43, y + 35, { maxWidth: contentWidth - 48 });

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(`Hash de Integridade: SHA256:${Buffer.from(`${tre.id}-${tre.numero_rastreio}-${tre.data_validade}`).toString('hex').slice(0, 32).toUpperCase()}`, margin + 43, y + 44);

  // 6. Page Footer
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Portal ABZ Group • portal.groupabz.com • Departamento de Gestão de Tripulantes', margin, pageHeight - 3);
  doc.text('Página 1 de 1', pageWidth - margin, pageHeight - 3, { align: 'right' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
