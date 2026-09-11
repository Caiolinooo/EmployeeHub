/**
 * Civil YYYY-MM-DD validity — client-safe (no Supabase).
 * Never classify with `new Date(iso)` UTC.
 */

export type ClassificacaoValidadeCivil = 'vencido' | 'vencendo' | 'valido' | 'sem_validade';

export function dataLocalISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function adicionarDiasLocalISO(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return dataLocalISO(d);
}

/** Janela vencendo: hoje…limite inclusive (default histórico hoje+30 se limite omitido). */
export function classificarValidadeCivil(
  dataValidade: string | null | undefined,
  hoje = dataLocalISO(),
  limite?: string,
): ClassificacaoValidadeCivil {
  const validade = String(dataValidade || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return 'sem_validade';
  const [y, m, d] = hoje.split('-').map(Number);
  const limiteCivil = limite ?? dataLocalISO(new Date(y, (m || 1) - 1, (d || 1) + 30));
  if (validade < hoje) return 'vencido';
  if (validade <= limiteCivil) return 'vencendo';
  return 'valido';
}

/** Tabs that consume `gt_documentos` via tipo. QHSE / EPI is catalog-only (`onlyQhse`) and is never an ASO landing tab. */
export type AbaDocumento =
  | 'treinamentos'
  | 'aso'
  | 'passaportes'
  | 'documentos';

export function abaParaTipoDocumento(tipo: string | null | undefined): AbaDocumento {
  const t = String(tipo || '').toLowerCase();
  if (t === 'treinamento' || t === 'certificado') return 'treinamentos';
  if (t === 'aso' || t === 'laudo') return 'aso';
  if (t === 'passaporte') return 'passaportes';
  return 'documentos';
}

/** Same routing the alert panel uses — keep tab filters aligned or the KPI count has nowhere to land. */
export function documentoPertenceAba(
  tipo: string | null | undefined,
  aba: AbaDocumento,
): boolean {
  return abaParaTipoDocumento(tipo) === aba;
}

function normKey(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(\.pdf|\.jpg|\.jpeg|\.png|_rotated|\(1\)|\(2\))/gi, '')
    .trim();
}

export type PapelConformidade = 'vigente' | 'historico';

export interface DocParaConformidade {
  id: string;
  colaborador_id?: string | null;
  tipo_documento?: string | null;
  subtipo?: string | null;
  titulo?: string | null;
  numero_documento?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  created_at?: string | null;
}

/** One current slot per person: latest ASO, latest passport, latest course (subtipo/title). */
export function chaveConformidade(doc: DocParaConformidade): string {
  const colab = doc.colaborador_id || '_';
  const tipo = String(doc.tipo_documento || 'outro').toLowerCase();
  if (tipo === 'treinamento' || tipo === 'certificado') {
    const curso = normKey(doc.subtipo) || normKey(doc.titulo) || doc.id;
    return `${colab}:tre:${curso}`;
  }
  if (tipo === 'aso' || tipo === 'laudo') {
    return `${colab}:aso`;
  }
  if (tipo === 'passaporte') {
    return `${colab}:passaporte`;
  }
  const ident = normKey(doc.numero_documento) || normKey(doc.titulo) || doc.id;
  return `${colab}:${tipo}:${ident}`;
}

function rankDoc(doc: DocParaConformidade): string {
  const validade = String(doc.data_validade || '').slice(0, 10);
  const emissao = String(doc.data_emissao || '').slice(0, 10);
  const created = String(doc.created_at || '');
  return `${validade || '0000-00-00'}|${emissao || '0000-00-00'}|${created}`;
}

export function marcarPapeisConformidade<T extends DocParaConformidade>(
  docs: T[],
): Array<T & { papel: PapelConformidade; chave: string }> {
  const groups = new Map<string, T[]>();
  for (const doc of docs) {
    const chave = chaveConformidade(doc);
    const list = groups.get(chave) || [];
    list.push(doc);
    groups.set(chave, list);
  }

  const vigenteIds = new Set<string>();
  for (const list of groups.values()) {
    const winner = [...list].sort((a, b) => rankDoc(b).localeCompare(rankDoc(a)))[0];
    if (winner) vigenteIds.add(winner.id);
  }

  return docs.map((doc) => ({
    ...doc,
    papel: (vigenteIds.has(doc.id) ? 'vigente' : 'historico') as PapelConformidade,
    chave: chaveConformidade(doc),
  }));
}

export function contarAlertasVigentes(
  docs: Array<DocParaConformidade & { papel?: PapelConformidade }>,
  hoje = dataLocalISO(),
): { vencidos: number; vencendo: number; validos: number } {
  let vencidos = 0;
  let vencendo = 0;
  let validos = 0;
  for (const d of docs) {
    if (d.papel === 'historico') continue;
    const alerta = classificarValidadeCivil(d.data_validade, hoje);
    if (alerta === 'vencido') vencidos += 1;
    else if (alerta === 'vencendo') vencendo += 1;
    else if (alerta === 'valido') validos += 1;
  }
  return { vencidos, vencendo, validos };
}
