import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { gerarRelatorioEscalaMensal } from '@/lib/gestao-tripulantes/relatorio-escala-generator';
import { normalizeAprovadoresObrigatorios } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarMarcadosDoMes,
  extrairPendenciasDoRelatorio,
  montarNomeArquivoFechamento,
  resolverPeriodoFechamento,
} from '@/lib/gestao-tripulantes/fechamento-periodo-resolver';

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
    // BRT = UTC-3 (sem DST): âncora -3h evita virar o mês cedo demais no fim do dia.
    const mesAno = searchParams.get('mesAno') || new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const dataInicio = searchParams.get('dataInicio') || undefined;
    const dataFim = searchParams.get('dataFim') || undefined;
    const empresa = searchParams.get('empresa') || undefined;
    const embarcacao = searchParams.get('embarcacao') || undefined;
    // GT v2: multi-embarcações — `embarcacoes` (vírgula) além do `embarcacao` atual.
    const embarcacoes = (searchParams.get('embarcacoes') || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const cargo = searchParams.get('cargo') || undefined;
    const statusAtivo = (searchParams.get('statusAtivo') as any) || 'ativos';
    const busca = searchParams.get('busca') || undefined;
    const colaboradorId = searchParams.get('colaboradorId') || undefined;
    const download = searchParams.get('download') === 'true';

    // GT v2 (R2): período explícito > gt_fechamento_periodos do mês > mês civil.
    const periodo = await resolverPeriodoFechamento({ mesAno, dataInicio, dataFim });

    // GT v2 (R5): lista confirmada → SOMENTE os marcados entram no fechamento.
    const marcados = await carregarMarcadosDoMes(mesAno);

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
      // Período resolvido (explicit/config/mês) governa a janela do cálculo.
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      empresa,
      embarcacao,
      embarcacoes,
      cargo,
      statusAtivo,
      busca,
      colaboradorId,
      colaboradorIds: marcados.listaConfirmada ? marcados.idsMarcados : undefined,
      aprovadores: assinaturasColetadas.length > 0 ? assinaturasColetadas : (registroExistente?.aprovado_por_nome ? [{
        nome: registroExistente.aprovado_por_nome,
        cpf: registroExistente.aprovado_por_cpf,
        dataHora: registroExistente.aprovado_em ? new Date(registroExistente.aprovado_em).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
        ip: registroExistente.aprovado_ip,
        assinaturaUrl: registroExistente.assinatura_url,
        assinaturaHash: registroExistente.assinatura_hash,
      }] : undefined)
    });

    // GT v2 (R1/R4): pendências do próximo período expostas pelo motor.
    const pendencias = await extrairPendenciasDoRelatorio(reportResult);

    if (download) {
      const filename = montarNomeArquivoFechamento({
        mesAno,
        embarcacoes,
        embarcacao,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        fonte: periodo.fonte,
      });
      return new NextResponse(new Uint8Array(reportResult.buffer), {
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
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        fonte: periodo.fonte,
      },
      regra: 'comparativo_nxn_dt_inicio_dt_fim',
      registro: registroExistente || null,
      aprovadoresObrigatorios,
      assinaturasColetadas,
      totaisConsolidados: reportResult.totaisConsolidados,
      colaboradoresTotais: reportResult.colaboradoresTotais,
      calculosFolha: reportResult.calculosFolha,
      semanas: reportResult.semanas,
      pendencias,
      marcados: {
        listaConfirmada: marcados.listaConfirmada,
        total: marcados.total,
      },
    });
  } catch (error: any) {
    console.error('[API RelatorioMensal GET]', error);
    return NextResponse.json({ error: error.message || 'Erro ao obter dados do relatório' }, { status: 500 });
  }
}
