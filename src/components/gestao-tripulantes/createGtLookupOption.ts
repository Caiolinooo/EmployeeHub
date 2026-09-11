import { fetchWithToken } from '@/lib/tokenStorage';
import type { SearchableOption } from '@/components/gestao-tripulantes/SearchableCreatableSelect';

export type GtLookupKind = 'cargos' | 'empresas' | 'embarcacoes' | 'centros-custo';

export interface GtLookupRow {
  id: string;
  nome?: string | null;
  codigo?: string | null;
}

export function formatCentroCustoLabel(row: { nome?: string | null; codigo?: string | null }): string {
  const nome = (row.nome || '').trim();
  const codigo = (row.codigo || '').trim();
  if (codigo && nome) return `${codigo} - ${nome}`;
  return codigo || nome;
}

export function toLookupOptions(
  rows: GtLookupRow[],
  kind: GtLookupKind,
  current?: { id: string; label: string },
): SearchableOption[] {
  const mapped = rows.map(o => ({
    id: o.id,
    label: kind === 'centros-custo' ? formatCentroCustoLabel(o) : (o.nome || o.id),
  }));
  if (current?.id && !mapped.some(o => o.id === current.id)) {
    return [{ id: current.id, label: current.label || current.id }, ...mapped];
  }
  return mapped;
}

export async function createGtLookupOption(
  kind: GtLookupKind,
  nome: string,
): Promise<SearchableOption & { nome: string; codigo?: string | null }> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error('Nome é obrigatório');

  const body: Record<string, string> = { nome: trimmed };

  const res = await fetchWithToken(`/api/gestao-tripulantes/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Falha ao criar registro');
  const data = json.data as GtLookupRow | undefined;
  if (!data?.id) throw new Error('Resposta inválida ao criar registro');
  const label = kind === 'centros-custo' ? formatCentroCustoLabel(data) : (data.nome || trimmed);
  return { id: data.id, label, nome: data.nome || trimmed, codigo: data.codigo ?? null };
}
