import { supabaseAdmin } from '@/lib/supabase';
import { overlayStatusEscalaHoje } from '@/lib/gestao-tripulantes/dashboard-service';

interface CandidatoBack {
  colaborador_id: string;
  nome: string;
  score: number;
  criterios: {
    mesmo_centro_custo: boolean;
    mesma_empresa: boolean;
    mesma_embarcacao: boolean;
    mesmo_cargo: boolean;
    standby: boolean;
    substituicoes_anteriores: number;
    documentos_validos: boolean;
    seniority_dias: number;
  };
}

interface SugerirBackParams {
  colaborador_embarcado_id: string;
  data_inicio: string;
}

export async function sugerirBack(params: SugerirBackParams): Promise<CandidatoBack[]> {
  const { colaborador_embarcado_id, data_inicio } = params;

  const { data: colaborador, error: errCol } = await supabaseAdmin
    .from('gt_vw_colaboradores_completo')
    .select('*')
    .eq('id', colaborador_embarcado_id)
    .single();

  if (errCol || !colaborador) {
    console.error('Colaborador não encontrado:', errCol);
    return [];
  }

  const { data: candidatosRaw, error: errCand } = await supabaseAdmin
    .from('gt_vw_colaboradores_completo')
    .select('*')
    .neq('id', colaborador_embarcado_id)
    .is('deleted_at', null);

  if (errCand || !candidatosRaw) {
    console.error('Erro ao buscar candidatos:', errCand);
    return [];
  }

  const overlay = await overlayStatusEscalaHoje(
    (candidatosRaw as Array<{ id: string; status_embarque?: string | null; standby?: boolean | null }>).map((c) => ({
      ...c,
      id: c.id,
    })),
  );
  const candidatos = (overlay.error ? candidatosRaw : overlay.rows).filter((c) => {
    const st = String((c as { status_embarque?: string }).status_embarque || '');
    return st === 'standby' || st === 'folga' || st === 'desembarcado';
  });

  const { data: substituicoes } = await supabaseAdmin
    .from('gt_historico_substituicoes')
    .select('substituto_id')
    .in('substituto_id', candidatos.map(c => c.id));

  const subCountMap = new Map<string, number>();
  if (substituicoes) {
    for (const s of substituicoes) {
      subCountMap.set(s.substituto_id, (subCountMap.get(s.substituto_id) || 0) + 1);
    }
  }

  // Prefer post-send ASOs (enviado/processado) for validity; fallback to any dated doc per candidate
  const candidatoIds = candidatos.map(c => c.id);
  const hoje = new Date();
  const docsValidosMap = new Map<string, boolean>();

  const { data: asosEnviados } = await supabaseAdmin
    .from('gt_documentos_aso')
    .select('colaborador_id, documento:gt_documentos!documento_id(data_validade, deleted_at)')
    .in('colaborador_id', candidatoIds)
    .in('esocial_status', ['enviado', 'processado']);

  const withGlobalAso = new Set<string>();
  if (asosEnviados) {
    for (const a of asosEnviados) {
      if (!a.colaborador_id) continue;
      const rawDoc = a.documento as
        | { data_validade?: string | null; deleted_at?: string | null }
        | { data_validade?: string | null; deleted_at?: string | null }[]
        | null;
      const doc = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
      if (doc?.deleted_at) continue;
      withGlobalAso.add(a.colaborador_id);
      const validade = doc?.data_validade;
      const valido = validade ? new Date(validade) >= hoje : true;
      docsValidosMap.set(
        a.colaborador_id,
        docsValidosMap.has(a.colaborador_id)
          ? (docsValidosMap.get(a.colaborador_id)! || valido)
          : valido
      );
    }
  }

  const missingIds = candidatoIds.filter((id) => !withGlobalAso.has(id));
  if (missingIds.length > 0) {
    const { data: documentos } = await supabaseAdmin
      .from('gt_documentos')
      .select('colaborador_id, data_validade')
      .in('colaborador_id', missingIds)
      .not('data_validade', 'is', null);

    if (documentos) {
      for (const d of documentos) {
        const valido = new Date(d.data_validade) >= hoje;
        if (!docsValidosMap.has(d.colaborador_id)) {
          docsValidosMap.set(d.colaborador_id, true);
        }
        docsValidosMap.set(d.colaborador_id, docsValidosMap.get(d.colaborador_id)! && valido);
      }
    }
  }

  const scored: CandidatoBack[] = candidatos.map(c => {
    const mesmoCentroCusto = c.centro_custo_id === colaborador.centro_custo_id ? 1 : 0;
    const mesmaEmpresa = c.empresa_id === colaborador.empresa_id ? 1 : 0;
    const mesmaEmbarcacao = c.embarcacao_atual_id === colaborador.embarcacao_atual_id ? 1 : 0;
    const mesmoCargo = c.cargo_id === colaborador.cargo_id ? 1 : 0;
    const standbyScore = c.status_embarque === 'standby' ? 1 : 0;
    const subAnteriores = Math.min((subCountMap.get(c.id) || 0) * 0.2, 1);
    const docsValidos = docsValidosMap.get(c.id) ? 1 : 0;

    let seniorityDias = 0;
    if (c.data_ultimo_embarque) {
      seniorityDias = Math.floor((hoje.getTime() - new Date(c.data_ultimo_embarque).getTime()) / (1000 * 60 * 60 * 24));
    }

    const score =
      mesmoCentroCusto * 30 +
      mesmaEmpresa * 20 +
      mesmaEmbarcacao * 15 +
      mesmoCargo * 10 +
      standbyScore * 10 +
      subAnteriores * 5 +
      docsValidos * 5 +
      Math.min(seniorityDias / 365, 1) * 5;

    return {
      colaborador_id: c.id,
      nome: c.nome_completo,
      score: Math.round(score * 100) / 100,
      criterios: {
        mesmo_centro_custo: mesmoCentroCusto === 1,
        mesma_empresa: mesmaEmpresa === 1,
        mesma_embarcacao: mesmaEmbarcacao === 1,
        mesmo_cargo: mesmoCargo === 1,
        standby: standbyScore === 1,
        substituicoes_anteriores: subCountMap.get(c.id) || 0,
        documentos_validos: docsValidos === 1,
        seniority_dias: seniorityDias
      }
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}
