/**
 * Server-only CPF lookups against gt_colaboradores (backfill-safe).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { formatCpf, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';

/** Lookup colaborador by CPF trying digits-only and masked forms (backfill-safe). */
export async function findColaboradorByCpf(
  cpfRaw: string
): Promise<{ id: string; cpf: string; nome_completo: string } | null> {
  const digits = normalizeCpf(cpfRaw);
  if (digits.length !== 11) return null;

  const formatted = formatCpf(digits);
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, cpf, nome_completo')
    .or(`cpf.eq.${digits},cpf.eq.${formatted}`)
    .is('deleted_at', null)
    .limit(2);

  if (error) {
    console.error('[GT/CPF] findColaboradorByCpf error:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const exact = data.find((c) => normalizeCpf(c.cpf || '') === digits);
  return exact || data[0];
}

export interface FullColaboradorInfo {
  id: string;
  cpf: string;
  nome_completo: string;
  matricula?: string | null;
  matricula_esocial?: string | null;
  data_admissao?: string | null;
  cargo_nome?: string | null;
  funcao?: string | null;
  cbo?: string | null;
  cargo_cbo?: string | null;
  empresa_cnpj?: string | null;
  empresa_nome?: string | null;
}

export async function findFullColaboradorByCpf(
  cpfRaw: string
): Promise<FullColaboradorInfo | null> {
  const digits = normalizeCpf(cpfRaw);
  if (digits.length !== 11) return null;

  const formatted = formatCpf(digits);
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(`
      id, cpf, nome_completo, matricula, matricula_esocial, data_admissao,
      cargo_nome, funcao, cbo, cargo_cbo, empresa_cnpj, empresa_nome
    `)
    .or(`cpf.eq.${digits},cpf.eq.${formatted}`)
    .is('deleted_at', null)
    .limit(2);

  if (error) {
    console.error('[GT/CPF] findFullColaboradorByCpf error:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const exact = data.find((c) => normalizeCpf(c.cpf || '') === digits);
  return exact || data[0];
}

export async function getColaboradorCpfNormalized(colaboradorId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('cpf')
    .eq('id', colaboradorId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data?.cpf) return null;
  const digits = normalizeCpf(data.cpf);
  return digits.length === 11 ? digits : null;
}
