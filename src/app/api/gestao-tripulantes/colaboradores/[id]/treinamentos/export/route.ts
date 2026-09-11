import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import * as XLSX from 'xlsx-js-style';

export const dynamic = 'force-dynamic';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function formatCPF(cpf?: string | null): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await context.params;

    // 1. Fetch Collaborator
    const { data: colaborador, error: colError } = await supabaseAdmin
      .from('gt_vw_colaboradores_completo')
      .select('id, nome_completo, cpf, matricula, cargo_nome, embarcacao_nome, empresa_nome')
      .eq('id', id)
      .maybeSingle();

    if (colError || !colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    // 2. Fetch all training documents
    const { data: docs, error: docError } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .eq('colaborador_id', id)
      .eq('tipo_documento', 'treinamento')
      .is('deleted_at', null)
      .order('data_validade', { ascending: false, nullsFirst: false });

    if (docError) {
      return NextResponse.json({ error: 'Erro ao buscar treinamentos' }, { status: 500 });
    }

    const treinamentos = docs || [];

    // 3. Fetch gt_documentos_treinamento metadata
    const docIds = treinamentos.map(t => t.id);
    let treDataMap: Record<string, any> = {};
    if (docIds.length > 0) {
      const { data: treData } = await supabaseAdmin
        .from('gt_documentos_treinamento')
        .select('*')
        .in('documento_id', docIds);
      if (treData) {
        treData.forEach(r => { treDataMap[r.documento_id] = r; });
      }
    }

    // Build workbook
    const wb = XLSX.utils.book_new();

    // Prepare rows
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };

    const titleStyle = {
      font: { bold: true, color: { rgb: '1E3A8A' }, sz: 14 },
      alignment: { vertical: 'center' },
    };

    const subTitleStyle = {
      font: { italic: true, color: { rgb: '475569' }, sz: 10 },
      alignment: { vertical: 'center' },
    };

    const cellStyle = {
      font: { sz: 10, color: { rgb: '0F172A' } },
      alignment: { vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left: { style: 'thin', color: { rgb: 'E2E8F0' } },
        right: { style: 'thin', color: { rgb: 'E2E8F0' } },
      },
    };

    const wsData: any[][] = [
      [{ v: 'ABZ GROUP — RELATÓRIO DE TREINAMENTOS E CERTIFICAÇÕES', s: titleStyle }],
      [{ v: `Colaborador: ${colaborador.nome_completo} | CPF: ${formatCPF(colaborador.cpf)} | Matrícula: ${colaborador.matricula || '—'}`, s: subTitleStyle }],
      [{ v: `Cargo: ${colaborador.cargo_nome || '—'} | Embarcação: ${colaborador.embarcacao_nome || '—'} | Empresa: ${colaborador.empresa_nome || 'ABZ Group'}`, s: subTitleStyle }],
      [{ v: `Exportado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Total: ${treinamentos.length} treinamento(s)`, s: subTitleStyle }],
      [], // blank line
      [
        { v: '#', s: headerStyle },
        { v: 'TREINAMENTO / CURSO', s: headerStyle },
        { v: 'CÓDIGO / SIGLA', s: headerStyle },
        { v: 'Nº CERTIFICADO / REGISTRO', s: headerStyle },
        { v: 'ÓRGÃO EMISSOR / INSTITUIÇÃO', s: headerStyle },
        { v: 'CARGA HORÁRIA', s: headerStyle },
        { v: 'DATA CONCLUSÃO / EMISSÃO', s: headerStyle },
        { v: 'DATA VALIDADE', s: headerStyle },
        { v: 'STATUS', s: headerStyle },
        { v: 'TEMPO RESTANTE', s: headerStyle },
        { v: 'ARQUIVO ANEXADO', s: headerStyle },
        { v: 'RASTREIO GT', s: headerStyle },
      ],
    ];

    treinamentos.forEach((tre, idx) => {
      const extra = treDataMap[tre.id] || {};
      const numDoc = tre.numero_documento && tre.numero_documento !== tre.subtipo ? tre.numero_documento : (tre.numero_rastreio || '—');
      const sigla = tre.subtipo || tre.numero_documento || '—';
      const orgao = tre.orgao_emissor || extra.instituicao || 'MARINHA DO BRASIL';
      const carga = extra.carga_horaria ? `${extra.carga_horaria}h` : '—';
      const dtEmissao = formatDate(tre.data_emissao);
      const dtValidade = tre.data_validade ? formatDate(tre.data_validade) : 'PERMANENTE';

      let statusLabel = 'Válido';
      let statusColor = '166534'; // green
      let statusBg = 'DCFCE7';

      if (!tre.data_validade) {
        statusLabel = 'Permanente';
        statusColor = '3730A3'; // indigo
        statusBg = 'EEF2FF';
      } else if (tre.status_validacao === 'vencido') {
        statusLabel = 'Vencido';
        statusColor = '991B1B'; // red
        statusBg = 'FEE2E2';
      } else if (tre.status_validacao === 'vencendo') {
        statusLabel = 'Vencendo';
        statusColor = '9A3412'; // orange
        statusBg = 'FFEDD5';
      }

      let tempoRestante = '—';
      if (tre.data_validade) {
        const diffDays = Math.ceil((new Date(tre.data_validade).getTime() - Date.now()) / 86400000);
        if (diffDays < 0) tempoRestante = `Vencido há ${Math.abs(diffDays)} dias`;
        else if (diffDays <= 30) tempoRestante = `Vence em ${diffDays} dias`;
        else tempoRestante = `${diffDays} dias`;
      } else {
        tempoRestante = 'Sem vencimento';
      }

      const statusStyle = {
        font: { bold: true, color: { rgb: statusColor }, sz: 10 },
        fill: { fgColor: { rgb: statusBg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellStyle.border,
      };

      const centerStyle = {
        ...cellStyle,
        alignment: { horizontal: 'center', vertical: 'center' },
      };

      wsData.push([
        { v: idx + 1, s: centerStyle },
        { v: tre.titulo, s: cellStyle },
        { v: sigla, s: centerStyle },
        { v: numDoc, s: centerStyle },
        { v: orgao, s: cellStyle },
        { v: carga, s: centerStyle },
        { v: dtEmissao, s: centerStyle },
        { v: dtValidade, s: centerStyle },
        { v: statusLabel, s: statusStyle },
        { v: tempoRestante, s: centerStyle },
        { v: tre.arquivo_url ? 'Sim (PDF/Imagem)' : 'Ficha Digital', s: centerStyle },
        { v: tre.numero_rastreio || '—', s: centerStyle },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 5 },  // #
      { wch: 42 }, // Título
      { wch: 18 }, // Sigla
      { wch: 26 }, // Nº Certificado
      { wch: 28 }, // Órgão Emissor
      { wch: 14 }, // Carga
      { wch: 16 }, // Emissão
      { wch: 16 }, // Validade
      { wch: 14 }, // Status
      { wch: 20 }, // Tempo
      { wch: 18 }, // Arquivo
      { wch: 28 }, // Rastreio
    ];

    // Merge title row
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Treinamentos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeName = String(colaborador.nome_completo || 'Tripulante').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const filename = `Treinamentos_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao exportar treinamentos para Excel:', error);
    return NextResponse.json({ error: 'Erro ao exportar treinamentos' }, { status: 500 });
  }
}
