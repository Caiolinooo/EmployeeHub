import { normalizeCpf } from '@/lib/utils/identity';

export const FECHAMENTO_STATUS = [
  'pendente_revisao',
  'em_aprovacao',
  'aprovado',
  'rejeitado',
  'enviado',
] as const;

export type FechamentoStatus = (typeof FECHAMENTO_STATUS)[number];

export interface AprovadorObrigatorio {
  id?: string;
  nome: string;
  email: string;
  cargo?: string;
}

export interface AssinaturaFechamento {
  userId?: string;
  email?: string;
  nome?: string;
  cpf?: string;
  cargo?: string;
  role?: string;
  assinado_em?: string;
  dataHora?: string;
  ip?: string;
  assinaturaUrl?: string;
  assinaturaHash?: string;
}

export type MotivoNegarAssinaturaFechamento =
  | 'nao_esta_na_lista'
  | 'lista_vazia_exige_gestor';

export type ResultadoPodeAssinarFechamento =
  | { permitido: true }
  | { permitido: false; motivo: MotivoNegarAssinaturaFechamento };

export interface PortalUserNameRow {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
}

const FECHAMENTO_ROLES = [
  'ADMIN',
  'ADMINISTRADOR',
  'SUPERADMIN',
  'MANAGER',
  'GERENTE',
] as const;

export function isFechamentoRole(role: string | undefined | null): boolean {
  const r = (role || '').trim().toUpperCase();
  return (FECHAMENTO_ROLES as readonly string[]).includes(r);
}

export function isFechamentoStatus(value: string | null | undefined): value is FechamentoStatus {
  return (FECHAMENTO_STATUS as readonly string[]).includes(String(value || ''));
}

export function labelFechamentoStatus(
  status: FechamentoStatus,
  extras?: { assinados?: number; obrigatorios?: number },
): string {
  switch (status) {
    case 'enviado':
      return 'Enviado ao DP';
    case 'aprovado':
      return 'Aprovado (100%)';
    case 'em_aprovacao': {
      const den = extras?.obrigatorios && extras.obrigatorios > 0 ? extras.obrigatorios : 1;
      return `Em Aprovação (${extras?.assinados ?? 0}/${den})`;
    }
    case 'rejeitado':
      return 'Rejeitado';
    case 'pendente_revisao':
      return 'Pendente';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function displayNameFromUser(row: PortalUserNameRow): string {
  const composed = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return composed || (row.name || '').trim() || (row.email || '').trim() || 'Usuário';
}

export function normalizeAprovadoresObrigatorios(raw: unknown): AprovadorObrigatorio[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AprovadorObrigatorio[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const email = String(rec.email || '').trim().toLowerCase();
    const id = String(rec.id || '').trim();
    if (!email && !id) continue;
    const key = id ? `id:${id}` : `email:${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: id || undefined,
      nome: String(rec.nome || rec.name || email || 'Aprovador').trim(),
      email,
      cargo: rec.cargo ? String(rec.cargo) : undefined,
    });
  }
  return out;
}

/** Match listed approver by user id first, then email. Role is ignored. */
export function atorCobreAprovador(
  obr: AprovadorObrigatorio,
  ator: { userId?: string; email?: string },
): boolean {
  const obrId = (obr.id || '').trim();
  const atorId = String(ator.userId || '').trim();
  if (obrId && atorId && obrId === atorId) return true;
  const obrEmail = (obr.email || '').toLowerCase().trim();
  const atorEmail = (ator.email || '').toLowerCase().trim();
  if (obrEmail && atorEmail && obrEmail === atorEmail) return true;
  return false;
}

export function assinaturaCobreAprovador(
  obr: AprovadorObrigatorio,
  assinaturas: AssinaturaFechamento[],
): boolean {
  return assinaturas.some((sig) => atorCobreAprovador(obr, { userId: sig.userId, email: sig.email }));
}

export function atorEstaNaLista(
  obrigatorios: AprovadorObrigatorio[],
  ator: { userId?: string; email?: string },
): boolean {
  return obrigatorios.some((obr) => atorCobreAprovador(obr, ator));
}

export const estaNaListaAprovadores = atorEstaNaLista;

export function mensagemErroAssinaturaNegada(motivo: MotivoNegarAssinaturaFechamento): string {
  switch (motivo) {
    case 'nao_esta_na_lista':
      return 'Você não está na lista de aprovadores obrigatórios deste mês.';
    case 'lista_vazia_exige_gestor':
      return 'Sem aprovadores nominados, apenas gestores ou administradores podem assinar o fechamento.';
    default: {
      const _never: never = motivo;
      return _never;
    }
  }
}

/**
 * Named list: only those exact people may sign (any role).
 * Empty list: ADMIN/MANAGER family only — never USER, never wait forever.
 */
export function podeAssinarFechamento(
  obrigatorios: AprovadorObrigatorio[],
  ator: { userId?: string; email?: string; role?: string | null },
): ResultadoPodeAssinarFechamento {
  if (obrigatorios.length === 0) {
    if (isFechamentoRole(ator.role)) return { permitido: true };
    return { permitido: false, motivo: 'lista_vazia_exige_gestor' };
  }
  if (atorEstaNaLista(obrigatorios, ator)) return { permitido: true };
  return { permitido: false, motivo: 'nao_esta_na_lista' };
}

export function autorizacaoAssinarFechamento(input: {
  obrigatorios: AprovadorObrigatorio[];
  userId: string;
  email: string;
  role: string | undefined | null;
}): { permitido: true } | { permitido: false; motivo: string } {
  const gate = podeAssinarFechamento(input.obrigatorios, {
    userId: input.userId,
    email: input.email,
    role: input.role,
  });
  if (gate.permitido) return { permitido: true };
  return { permitido: false, motivo: mensagemErroAssinaturaNegada(gate.motivo) };
}

export function assinaturaContaComoGestorFallback(sig: AssinaturaFechamento): boolean {
  return isFechamentoRole(sig.role) || isFechamentoRole(sig.cargo);
}

export function mesclarAssinaturaFechamento(
  existentes: AssinaturaFechamento[],
  nova: AssinaturaFechamento,
): AssinaturaFechamento[] {
  const novaId = String(nova.userId || '').trim();
  const novaEmail = (nova.email || '').toLowerCase().trim();
  return [
    ...existentes.filter((sig) => {
      const sigId = String(sig.userId || '').trim();
      const sigEmail = (sig.email || '').toLowerCase().trim();
      if (novaId && sigId && novaId === sigId) return false;
      if (novaEmail && sigEmail && novaEmail === sigEmail) return false;
      return true;
    }),
    nova,
  ];
}

/**
 * Empty required list: a single ADMIN/MANAGER signature completes (100%). USER never completes it.
 * Named list of N: every listed person must have signed; extras (any role) do not count toward 100%.
 */
export function avaliarAssinaturasFechamento(
  obrigatorios: AprovadorObrigatorio[],
  assinaturas: AssinaturaFechamento[],
): { todosAssinaram: boolean; pendentes: AprovadorObrigatorio[] } {
  if (obrigatorios.length === 0) {
    return {
      todosAssinaram: assinaturas.some(assinaturaContaComoGestorFallback),
      pendentes: [],
    };
  }
  const pendentes = obrigatorios.filter((obr) => !assinaturaCobreAprovador(obr, assinaturas));
  return { todosAssinaram: pendentes.length === 0, pendentes };
}

export function montarHashFechamento(input: {
  mesAno: string;
  nome: string;
  cpf: string;
  dataIso: string;
  ip: string;
}): string {
  const cpf = normalizeCpf(input.cpf || '') || (input.cpf || '');
  return `GT_FECHAMENTO:${input.mesAno}:${input.nome}:${cpf}:${input.dataIso}:${input.ip}`;
}

export function mensagemErroAssinaturaAusente(): string {
  return 'Assinatura digital é obrigatória para o fechamento. Cadastre sua assinatura e confirme no modal para continuar.';
}
