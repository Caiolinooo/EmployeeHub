import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

const IN_CHUNK = 120; // limite prático de `.in()` no PostgREST (padrão do módulo GT)

interface PlanilhaRow {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  created_at: string;
}

interface AbaRow {
  id: string;
  planilha_id: string;
  nome: string;
  colunas: unknown;
  ordem: number;
}

/**
 * GET /api/indicadores/planilhas
 * Lista datasets com abas + total de linhas vivas de cada aba.
 * Gate: podeVerIndicadores.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelIndicadores(request, 'view');
    if (gate.error) return gate.error;

    // PostgREST trunca em 1000 linhas — leitura multi-linha sempre paginada.
    const planilhas = await paginarSelect<PlanilhaRow>(async (from, to) => {
      const r = await supabaseAdmin
        .from('rs_planilhas')
        .select('id, nome, arquivo_nome, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
      return r;
    });
    if (planilhas.error) {
      return NextResponse.json({ success: false, error: planilhas.error }, { status: 500 });
    }

    const idsPlanilhas = planilhas.rows.map((p) => p.id);
    const abasPorPlanilha = new Map<string, AbaRow[]>();
    if (idsPlanilhas.length > 0) {
      for (let i = 0; i < idsPlanilhas.length; i += IN_CHUNK) {
        const parte = idsPlanilhas.slice(i, i + IN_CHUNK);
        const abas = await paginarSelect<AbaRow>(async (from, to) => {
          const r = await supabaseAdmin
            .from('rs_abas')
            .select('id, planilha_id, nome, colunas, ordem')
            .in('planilha_id', parte)
            .order('planilha_id', { ascending: true })
            .order('ordem', { ascending: true })
            .order('nome', { ascending: true })
            .range(from, to);
          return r;
        });
        if (abas.error) {
          return NextResponse.json({ success: false, error: abas.error }, { status: 500 });
        }
        for (const aba of abas.rows) {
          const lista = abasPorPlanilha.get(aba.planilha_id) || [];
          lista.push(aba);
          abasPorPlanilha.set(aba.planilha_id, lista);
        }
      }
    }

    const idsAbas = [...abasPorPlanilha.values()].flat().map((a) => a.id);
    const contagem = new Map<string, number>();
    if (idsAbas.length > 0) {
      for (let i = 0; i < idsAbas.length; i += IN_CHUNK) {
        const parte = idsAbas.slice(i, i + IN_CHUNK);
        const vivas = await paginarSelect<{ aba_id: string }>(async (from, to) => {
          const r = await supabaseAdmin
            .from('rs_linhas')
            .select('aba_id')
            .in('aba_id', parte)
            .is('deleted_at', null)
            .order('aba_id', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to);
          return r;
        });
        if (vivas.error) {
          return NextResponse.json({ success: false, error: vivas.error }, { status: 500 });
        }
        for (const linha of vivas.rows) {
          contagem.set(linha.aba_id, (contagem.get(linha.aba_id) || 0) + 1);
        }
      }
    }

    const data = {
      planilhas: planilhas.rows.map((p) => ({
        id: p.id,
        nome: p.nome,
        arquivoNome: p.arquivo_nome,
        criadoEm: p.created_at,
        abas: (abasPorPlanilha.get(p.id) || []).map((a) => ({
          id: a.id,
          nome: a.nome,
          totalLinhas: contagem.get(a.id) || 0,
          colunas: a.colunas,
        })),
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[indicadores planilhas GET]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar planilhas' },
      { status: 500 },
    );
  }
}
