import {
  abaParaTipoDocumento,
  classificarValidadeCivil,
  contarAlertasVigentes,
  dataLocalISO,
  marcarPapeisConformidade,
  type AbaDocumento,
  type ClassificacaoValidadeCivil,
  type PapelConformidade,
} from './validade-civil';

export interface DocumentoAlertaItem {
  id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  colaborador_matricula: string | null;
  cpf: string | null;
  tipo_documento: string;
  subtipo: string | null;
  titulo: string;
  numero_documento: string | null;
  numero_rastreio: string | null;
  data_emissao: string | null;
  data_validade: string;
  status_validacao: string | null;
  origem: string | null;
  alerta: Extract<ClassificacaoValidadeCivil, 'vencido' | 'vencendo'>;
  papel: PapelConformidade;
  aba: AbaDocumento;
  status_stale: boolean;
}

export interface DocumentosAlertasResult {
  hoje: string;
  vencidos_vigentes: DocumentoAlertaItem[];
  vencendo_vigentes: DocumentoAlertaItem[];
  vencidos_historico: DocumentoAlertaItem[];
  totais: {
    vencidos_vigentes: number;
    vencendo_vigentes: number;
    vencidos_historico: number;
  };
}

export interface DocAlertaRow {
  id: string;
  colaborador_id: string | null;
  tipo_documento?: string | null;
  subtipo?: string | null;
  titulo?: string | null;
  numero_documento?: string | null;
  numero_rastreio?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  status_validacao?: string | null;
  origem?: string | null;
  created_at?: string | null;
}

export function montarItensAlerta(
  docs: DocAlertaRow[],
  nomes: Record<string, { nome: string | null; matricula: string | null; cpf: string | null }>,
  hoje = dataLocalISO(),
): DocumentoAlertaItem[] {
  const marked = marcarPapeisConformidade(
    docs.filter((d) => d.colaborador_id && d.data_validade),
  );
  const items: DocumentoAlertaItem[] = [];
  for (const d of marked) {
    const alerta = classificarValidadeCivil(d.data_validade, hoje);
    if (alerta !== 'vencido' && alerta !== 'vencendo') continue;
    const colab = nomes[d.colaborador_id as string] || { nome: null, matricula: null, cpf: null };
    const tipo = d.tipo_documento || 'outro';
    items.push({
      id: d.id,
      colaborador_id: d.colaborador_id as string,
      colaborador_nome: colab.nome,
      colaborador_matricula: colab.matricula,
      cpf: colab.cpf,
      tipo_documento: tipo,
      subtipo: d.subtipo ?? null,
      titulo: d.titulo || tipo,
      numero_documento: d.numero_documento ?? null,
      numero_rastreio: d.numero_rastreio ?? null,
      data_emissao: d.data_emissao ?? null,
      data_validade: String(d.data_validade).slice(0, 10),
      status_validacao: d.status_validacao ?? null,
      origem: d.origem ?? null,
      alerta,
      papel: d.papel,
      aba: abaParaTipoDocumento(tipo),
      status_stale: d.status_validacao !== alerta,
    });
  }
  items.sort((a, b) => a.data_validade.localeCompare(b.data_validade));
  return items;
}

export function resumoVencidosVigentes(
  items: DocumentoAlertaItem[],
): Record<string, { titulo: string; tipo_documento: string; data_validade: string; aba: AbaDocumento }[]> {
  const map: Record<string, { titulo: string; tipo_documento: string; data_validade: string; aba: AbaDocumento }[]> = {};
  for (const i of items) {
    if (i.alerta !== 'vencido' || i.papel !== 'vigente') continue;
    if (!map[i.colaborador_id]) map[i.colaborador_id] = [];
    map[i.colaborador_id].push({
      titulo: i.titulo,
      tipo_documento: i.tipo_documento,
      data_validade: i.data_validade,
      aba: i.aba,
    });
  }
  return map;
}

export function contarDocsPorColaborador(
  docs: Array<{
    id: string;
    colaborador_id: string;
    tipo_documento?: string | null;
    subtipo?: string | null;
    titulo?: string | null;
    numero_documento?: string | null;
    data_emissao?: string | null;
    data_validade?: string | null;
    created_at?: string | null;
    status_validacao?: string | null;
  }>,
  ids: string[],
  hoje = dataLocalISO(),
): Record<string, { qtd_docs_vencidos: number; qtd_docs_vencendo: number; qtd_docs_validos: number }> {
  const counts: Record<string, { qtd_docs_vencidos: number; qtd_docs_vencendo: number; qtd_docs_validos: number }> = {};
  for (const id of ids) {
    counts[id] = { qtd_docs_vencidos: 0, qtd_docs_vencendo: 0, qtd_docs_validos: 0 };
  }
  const byColab = new Map<string, typeof docs>();
  for (const d of docs) {
    const list = byColab.get(d.colaborador_id) || [];
    list.push(d);
    byColab.set(d.colaborador_id, list);
  }
  for (const [id, list] of byColab) {
    if (!counts[id]) counts[id] = { qtd_docs_vencidos: 0, qtd_docs_vencendo: 0, qtd_docs_validos: 0 };
    const c = contarAlertasVigentes(marcarPapeisConformidade(list), hoje);
    counts[id] = {
      qtd_docs_vencidos: c.vencidos,
      qtd_docs_vencendo: c.vencendo,
      qtd_docs_validos: c.validos,
    };
  }
  return counts;
}
