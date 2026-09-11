import { supabaseAdmin } from '@/lib/supabase';
import { dataLocalISO } from './validade-civil';
import {
  montarItensAlerta,
  type DocumentoAlertaItem,
  type DocumentosAlertasResult,
  type DocAlertaRow,
} from './documentos-alertas-core';

export {
  montarItensAlerta,
  resumoVencidosVigentes,
  contarDocsPorColaborador,
} from './documentos-alertas-core';
export type {
  DocumentoAlertaItem,
  DocumentosAlertasResult,
  DocAlertaRow,
} from './documentos-alertas-core';

const DOC_SELECT = `
  id, colaborador_id, tipo_documento, subtipo, titulo, numero_documento,
  numero_rastreio, data_emissao, data_validade, status_validacao, origem, created_at
`.replace(/\s+/g, ' ').trim();

async function fetchDocsPorColaboradores(ids: string[]): Promise<DocAlertaRow[]> {
  const rows: DocAlertaRow[] = [];
  const chunk = 120;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    let from = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('gt_documentos')
        .select(DOC_SELECT)
        .in('colaborador_id', part)
        .is('deleted_at', null)
        .not('data_validade', 'is', null)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      const page = (data || []) as unknown as DocAlertaRow[];
      rows.push(...page);
      if (page.length < 1000) break;
      from += 1000;
    }
  }
  return rows;
}

export async function listarDocumentosAlertas(opts?: {
  colaboradorIds?: string[];
}): Promise<DocumentosAlertasResult> {
  const hoje = dataLocalISO();
  const ids = opts?.colaboradorIds || [];

  if (ids.length === 0) {
    return {
      hoje,
      vencidos_vigentes: [],
      vencendo_vigentes: [],
      vencidos_historico: [],
      totais: { vencidos_vigentes: 0, vencendo_vigentes: 0, vencidos_historico: 0 },
    };
  }

  const [docs, colabRes] = await Promise.all([
    fetchDocsPorColaboradores(ids),
    supabaseAdmin
      .from('gt_colaboradores')
      .select('id, nome_completo, matricula, cpf')
      .in('id', ids),
  ]);

  if (colabRes.error) throw new Error(colabRes.error.message);

  const nomes: Record<string, { nome: string | null; matricula: string | null; cpf: string | null }> = {};
  for (const c of colabRes.data || []) {
    nomes[c.id as string] = {
      nome: (c.nome_completo as string) || null,
      matricula: (c.matricula as string) || null,
      cpf: (c.cpf as string) || null,
    };
  }

  const items = montarItensAlerta(docs, nomes, hoje);
  const vencidos_vigentes = items.filter((i: DocumentoAlertaItem) => i.alerta === 'vencido' && i.papel === 'vigente');
  const vencendo_vigentes = items.filter((i: DocumentoAlertaItem) => i.alerta === 'vencendo' && i.papel === 'vigente');
  const vencidos_historico = items.filter((i: DocumentoAlertaItem) => i.alerta === 'vencido' && i.papel === 'historico');

  return {
    hoje,
    vencidos_vigentes,
    vencendo_vigentes,
    vencidos_historico,
    totais: {
      vencidos_vigentes: vencidos_vigentes.length,
      vencendo_vigentes: vencendo_vigentes.length,
      vencidos_historico: vencidos_historico.length,
    },
  };
}
