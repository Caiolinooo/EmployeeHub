import { supabaseAdmin } from '@/lib/supabase';
import { getAsoAntecedenciaDias } from '@/lib/gestao-tripulantes/aso-agendamento-config';
import {
  adicionarDiasLocalISO,
  classificarValidadeCivil,
  dataLocalISO,
} from '@/lib/gestao-tripulantes/validade-civil';

export {
  adicionarDiasLocalISO,
  classificarValidadeCivil,
  dataLocalISO,
} from '@/lib/gestao-tripulantes/validade-civil';
export type { ClassificacaoValidadeCivil } from '@/lib/gestao-tripulantes/validade-civil';

const ASO_ALERTA_SELECT = `
  id, titulo, numero_documento, numero_rastreio, data_emissao, data_validade, status_validacao,
  colaborador:gt_colaboradores(id, user_id, nome_completo, cpf, email, matricula,
    cargo:gt_cargos(nome),
    empresa:gt_empresas(nome),
    embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome)
  )
`.replace(/\s+/g, ' ').trim();

export type AsoAlertaStatus = 'vencido' | 'vencendo';

export interface AsoVencimentoColaborador {
  id: string;
  user_id: string | null;
  nome_completo: string;
  cpf: string;
  email: string | null;
  matricula: string | null;
  cargo_nome: string | null;
  empresa_nome: string | null;
  embarcacao_nome: string | null;
}

export interface AsoVencimentoItem {
  id: string;
  titulo: string;
  numero_documento: string | null;
  numero_rastreio: string | null;
  data_emissao: string | null;
  data_validade: string;
  status_validacao: string | null;
  alerta: AsoAlertaStatus;
  colaborador: AsoVencimentoColaborador | null;
}

export interface AsosComAlerta {
  vencidos: AsoVencimentoItem[];
  vencendo: AsoVencimentoItem[];
}

interface ColaboradorJoinRaw {
  id?: unknown;
  user_id?: unknown;
  nome_completo?: unknown;
  cpf?: unknown;
  email?: unknown;
  matricula?: unknown;
  cargo?: { nome?: string } | { nome?: string }[] | null;
  empresa?: { nome?: string } | { nome?: string }[] | null;
  embarcacao_atual?: { nome?: string } | { nome?: string }[] | null;
}

function asRel<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function normalizarColaborador(raw: unknown): AsoVencimentoColaborador | null {
  const colab = asRel<ColaboradorJoinRaw>(raw);
  if (!colab || typeof colab.id !== 'string') return null;
  const cargo = asRel<{ nome?: string }>(colab.cargo);
  const empresa = asRel<{ nome?: string }>(colab.empresa);
  const embarcacao = asRel<{ nome?: string }>(colab.embarcacao_atual);
  return {
    id: colab.id,
    user_id: (colab.user_id as string | null) ?? null,
    nome_completo: String(colab.nome_completo || ''),
    cpf: String(colab.cpf || ''),
    email: (colab.email as string | null) ?? null,
    matricula: (colab.matricula as string | null) ?? null,
    cargo_nome: cargo?.nome ?? null,
    empresa_nome: empresa?.nome ?? null,
    embarcacao_nome: embarcacao?.nome ?? null,
  };
}

interface AsoAlertaRow {
  id: string;
  titulo: string;
  numero_documento: string | null;
  numero_rastreio: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  status_validacao: string | null;
  colaborador: unknown;
}

/**
 * ASOs vencidos ou com validade até `diasJanela` (inclusive), classificados
 * por data civil local (YYYY-MM-DD) — nunca via `Date` UTC de string ISO.
 * Default: antecedência configurável (`gt_aso_agendamento_config`, 60 dias).
 */
export async function buscarAsosComAlerta(diasJanela?: number): Promise<AsosComAlerta> {
  const janela = diasJanela ?? (await getAsoAntecedenciaDias());
  const hoje = dataLocalISO();
  const limite = adicionarDiasLocalISO(janela);

  const { data, error } = await supabaseAdmin
    .from('gt_documentos')
    .select(ASO_ALERTA_SELECT)
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .not('data_validade', 'is', null)
    .lte('data_validade', limite)
    .order('data_validade', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const vencidos: AsoVencimentoItem[] = [];
  const vencendo: AsoVencimentoItem[] = [];

  for (const row of (data || []) as unknown as AsoAlertaRow[]) {
    const validade = String(row.data_validade || '').slice(0, 10);
    if (!validade) continue;
    const colaborador = normalizarColaborador(row.colaborador);
    if (!colaborador) continue;

    const alerta: AsoAlertaStatus =
      classificarValidadeCivil(validade, hoje, limite) === 'vencido' ? 'vencido' : 'vencendo';
    const item: AsoVencimentoItem = {
      id: row.id,
      titulo: row.titulo,
      numero_documento: row.numero_documento ?? null,
      numero_rastreio: row.numero_rastreio ?? null,
      data_emissao: row.data_emissao ?? null,
      data_validade: validade,
      status_validacao: row.status_validacao ?? null,
      alerta,
      colaborador,
    };

    if (alerta === 'vencido') vencidos.push(item);
    else vencendo.push(item);
  }

  return { vencidos, vencendo };
}
