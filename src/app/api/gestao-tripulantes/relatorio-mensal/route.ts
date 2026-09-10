import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { gerarRelatorioEscalaMensal } from '@/lib/gestao-tripulantes/relatorio-escala-generator';
import { normalizeAprovadoresObrigatorios } from '@/lib/gestao-tripulantes/fechamento-assinatura';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get('mesAno') || new Date().toISOString().slice(0, 7);
    const dataInicio = searchParams.get('dataInicio') || undefined;
    const dataFim = searchParams.get('dataFim') || undefined;
    const empresa = searchParams.get('empresa') || undefined;
    const embarcacao = searchParams.get('embarcacao') || undefined;
    const cargo = searchParams.get('cargo') || undefined;
    const statusAtivo = (searchParams.get('statusAtivo') as any) || 'ativos';
    const busca = searchParams.get('busca') || undefined;
    const colaboradorId = searchParams.get('colaboradorId') || undefined;
    const download = searchParams.get('download') === 'true';

    // 1. Buscar configuração de aprovadores obrigatórios
    const { data: configData } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('valor')
      .eq('chave', 'gt_fechamento_mensal_config')
      .maybeSingle();

    let config: Record<string, unknown> = {};
    try {
      const raw = configData?.valor;
      if (typeof raw === 'string') config = JSON.parse(raw);
      else if (raw && typeof raw === 'object') config = raw as Record<string, unknown>;
    } catch {
      config = {};
    }
    const aprovadoresObrigatorios = normalizeAprovadoresObrigatorios(config.aprovadores_obrigatorios);

    // 2. Buscar registro existente de fechamento
    const { data: registroExistente } = await supabaseAdmin
      .from('gt_relatorios_aprovacoes')
      .select('*')
      .eq('mes_referencia', mesAno)
      .maybeSingle();

    const assinaturasColetadas = Array.isArray(registroExistente?.assinaturas) ? registroExistente.assinaturas : [];

    const reportResult = await gerarRelatorioEscalaMensal({
      mesAno,
      dataInicio,
      dataFim,
      empresa,
      embarcacao,
      cargo,
      statusAtivo,
      busca,
      colaboradorId,
      aprovadores: assinaturasColetadas.length > 0 ? assinaturasColetadas : (registroExistente?.aprovado_por_nome ? [{
        nome: registroExistente.aprovado_por_nome,
        cpf: registroExistente.aprovado_por_cpf,
        dataHora: registroExistente.aprovado_em ? new Date(registroExistente.aprovado_em).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
        ip: registroExistente.aprovado_ip,
        assinaturaUrl: registroExistente.assinatura_url,
        assinaturaHash: registroExistente.assinatura_hash,
      }] : undefined)
    });

    if (download) {
      const safeEmb = (embarcacao || 'Todas').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
      const filename = `relatorio_fechamento_${mesAno}_${safeEmb}.xlsx`;
      return new NextResponse(reportResult.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      mesAno,
      periodo: {
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      },
      regra: 'comparativo_nxn_dt_inicio_dt_fim',
      registro: registroExistente || null,
      aprovadoresObrigatorios,
      assinaturasColetadas,
      totaisConsolidados: reportResult.totaisConsolidados,
      colaboradoresTotais: reportResult.colaboradoresTotais,
      calculosFolha: reportResult.calculosFolha,
      semanas: reportResult.semanas,
    });
  } catch (error: any) {
    console.error('[API RelatorioMensal GET]', error);
    return NextResponse.json({ error: error.message || 'Erro ao obter dados do relatório' }, { status: 500 });
  }
}
