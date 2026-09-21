import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';
import {
  calcularKpisPlanilha,
  type KpiColuna,
  type KpiLinha,
} from '@/lib/indicadores/kpi';

export const dynamic = 'force-dynamic';

interface PlanilhaRow {
  id: string;
  nome: string;
}

interface AbaRow {
  id: string;
  nome: string;
  colunas: unknown;
  ordem: number | null;
}

/**
 * GET /api/indicadores/kpi?planilha=<uuid>
 *
 * KPIs e avaliação de eficácia do R&S a partir das planilhas importadas.
 * Sem `planilha`, usa a mais recente (created_at desc). Contrato pronto para
 * consumo por outros módulos (IA, dashboard-bi) — envelope {success,data}.
 * Gate: podeVerIndicadores.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelIndicadores(request, 'view');
    if (gate.error) return gate.error;

    const { searchParams } = new URL(request.url);
    const planilhaId = (searchParams.get('planilha') || '').trim();

    const planilhas = await paginarSelect<PlanilhaRow>(async (from, to) =>
      supabaseAdmin
        .from('rs_planilhas')
        .select('id, nome')
        .order('created_at', { ascending: false })
        .range(from, to),
    );
    if (planilhas.error) {
      return NextResponse.json({ success: false, error: planilhas.error }, { status: 500 });
    }

    if (planilhas.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { planilhas: [], planilha: null, geradoEm: new Date().toISOString(), abas: [], consolidado: null, avaliacao: null },
      });
    }

    const selecionada = planilhaId
      ? planilhas.rows.find((p) => p.id === planilhaId)
      : planilhas.rows[0];
    if (!selecionada) {
      return NextResponse.json({ success: false, error: 'Planilha não encontrada' }, { status: 404 });
    }

    const abas = await paginarSelect<AbaRow>(async (from, to) =>
      supabaseAdmin
        .from('rs_abas')
        .select('id, nome, colunas, ordem')
        .eq('planilha_id', selecionada.id)
        .order('ordem', { ascending: true, nullsFirst: false })
        .range(from, to),
    );
    if (abas.error) {
      return NextResponse.json({ success: false, error: abas.error }, { status: 500 });
    }

    const abasComLinhas = [];
    for (const aba of abas.rows) {
      const linhas = await paginarSelect<KpiLinha>(async (from, to) =>
        supabaseAdmin
          .from('rs_linhas')
          .select('id, dados')
          .eq('aba_id', aba.id)
          .is('deleted_at', null)
          .order('ordem', { ascending: true, nullsFirst: false })
          .range(from, to),
      );
      if (linhas.error) {
        return NextResponse.json({ success: false, error: linhas.error }, { status: 500 });
      }
      abasComLinhas.push({
        id: aba.id,
        nome: aba.nome,
        colunas: (aba.colunas as KpiColuna[]) ?? [],
        linhas: linhas.rows,
      });
    }

    const kpi = calcularKpisPlanilha(
      { id: selecionada.id, nome: selecionada.nome },
      abasComLinhas,
    );

    return NextResponse.json({
      success: true,
      data: { planilhas: planilhas.rows, ...kpi },
    });
  } catch (error) {
    console.error('[indicadores kpi GET]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
