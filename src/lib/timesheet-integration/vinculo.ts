/**
 * Cadeia única login ↔ GT ↔ PontoFlow ↔ folha.
 * CPF, e-mail e telefone preenchem elo vazio quando o match é único.
 * Telefone também reassumir o elo do e-mail pessoal do próprio cadastro.
 * Nunca cria segunda pessoa.
 */
import { normalizeCpf, formatCpf } from '@/lib/utils/identity';
import type { SupabaseClient } from '@supabase/supabase-js';

export type VinculoMotivo =
  | 'sem_colaborador'
  | 'ambiguo'
  | 'sem_user'
  | 'flag_inativa'
  | 'sem_empresa'
  | 'sem_people_map'
  | 'sem_folha';

export interface ColaboradorVinculoRow {
  id: string;
  user_id: string | null;
  empresa_id: string | null;
  cpf: string | null;
  email: string | null;
  telefone?: string | null;
  telefone_2?: string | null;
  nome_completo: string | null;
  contabilizar_timesheet: boolean | null;
  ativo: boolean | null;
  timesheet_sync_status?: string | null;
}

export interface PortalUserVinculo {
  id: string;
  email: string | null;
  tax_id: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface PayrollVinculoRow {
  id: string;
  employee_id: string | null;
  cpf: string | null;
  company_id: string | null;
}

export interface VinculoResolvido {
  completo: boolean;
  motivo: VinculoMotivo | null;
  colaborador: ColaboradorVinculoRow | null;
  tsEmployeeId: string | null;
  payrollEmployeeId: string | null;
  payrollCompanyId: string | null;
  empresaConfigurada: boolean;
}

export interface VinculoStore {
  colaboradorByUserId(userId: string): Promise<ColaboradorVinculoRow | null>;
  colaboradorById(id: string): Promise<ColaboradorVinculoRow | null>;
  userById(userId: string): Promise<PortalUserVinculo | null>;
  candidatos(cpfDigits: string | null, email: string | null, phoneDigits?: string | null): Promise<ColaboradorVinculoRow[]>;
  setUserIdIfEmpty(colaboradorId: string, userId: string): Promise<boolean>;
  /** Troca o login só se o user_id atual ainda é `fromUserId`. */
  setUserIdFrom(colaboradorId: string, fromUserId: string, toUserId: string): Promise<boolean>;
  peopleMap(colaboradorId: string): Promise<{ tsEmployeeId: string; empresaId: string } | null>;
  empresaEnabled(empresaId: string): Promise<boolean>;
  payrollByGtId(gtId: string): Promise<PayrollVinculoRow | null>;
  payrollByCpf(cpfDigits: string): Promise<PayrollVinculoRow[]>;
  setPayrollGtIdIfEmpty(payrollId: string, gtId: string): Promise<boolean>;
  enqueueActive(colaboradorId: string): Promise<void>;
}

const VAZIO: VinculoResolvido = {
  completo: false,
  motivo: 'sem_colaborador',
  colaborador: null,
  tsEmployeeId: null,
  payrollEmployeeId: null,
  payrollCompanyId: null,
  empresaConfigurada: false,
};

function digits(raw: string | null | undefined): string {
  const d = normalizeCpf(raw || '');
  return d.length === 11 ? d : '';
}

function emailNorm(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase();
}

/** Últimos 11 dígitos. DDD+número, com ou sem 55. Menos que 11 não entra. */
export function phoneKey(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length >= 11) return d.slice(-11);
  return '';
}

function foldName(raw: string | null | undefined): string[] {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 3);
}

/** Quantos tokens do login aparecem no nome do cadastro. */
export function nomesCompartilhados(
  loginNome: string | null | undefined,
  cadastroNome: string | null | undefined,
): number {
  const cadastro = new Set(foldName(cadastroNome));
  let n = 0;
  for (const token of foldName(loginNome)) {
    if (cadastro.has(token)) n += 1;
  }
  return n;
}

function loginNome(user: PortalUserVinculo): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

/**
 * O cadastro já tem user_id no login do e-mail pessoal gravado nele.
 * O login atual é outro, com o mesmo telefone e dois nomes em comum.
 * Não troca um vínculo que não seja esse par.
 */
export function podeReassumirLogin(
  user: PortalUserVinculo,
  row: ColaboradorVinculoRow,
  outro: PortalUserVinculo | null,
): boolean {
  const phone = phoneKey(user.phone_number);
  if (!phone || !outro || !row.user_id || row.user_id === user.id) return false;
  if (outro.id !== row.user_id) return false;
  const emailCadastro = emailNorm(row.email);
  if (!emailCadastro || emailNorm(outro.email) !== emailCadastro) return false;
  if (emailNorm(user.email) === emailCadastro) return false;
  const foneCadastro = phoneKey(row.telefone) === phone || phoneKey(row.telefone_2) === phone;
  if (!foneCadastro) return false;
  return nomesCompartilhados(loginNome(user), row.nome_completo) >= 2;
}

/** Linhas que este login pode assumir: user_id vazio ou já é ele. Outro user_id não entra. */
export function candidatosDoLogin(
  rows: ColaboradorVinculoRow[],
  userId: string,
): { kind: 'none' } | { kind: 'one'; row: ColaboradorVinculoRow } | { kind: 'many' } {
  const eligible = rows.filter((row) => !row.user_id || row.user_id === userId);
  if (eligible.length === 0) return { kind: 'none' };
  if (eligible.length === 1) return { kind: 'one', row: eligible[0] };
  return { kind: 'many' };
}

/** Folha: employee_id vazio ou já este GT. Vínculo de outra pessoa não é roubado. */
export function pickPayroll(
  rows: PayrollVinculoRow[],
  gtId: string,
): { kind: 'none' } | { kind: 'one'; row: PayrollVinculoRow } | { kind: 'many' } {
  const eligible = rows.filter((row) => !row.employee_id || row.employee_id === gtId);
  if (eligible.length === 0) return { kind: 'none' };
  if (eligible.length === 1) return { kind: 'one', row: eligible[0] };
  return { kind: 'many' };
}

function fechar(
  colaborador: ColaboradorVinculoRow,
  empresaConfigurada: boolean,
  tsEmployeeId: string | null,
  payroll: PayrollVinculoRow | null,
  motivo: VinculoMotivo | null,
): VinculoResolvido {
  return {
    completo: motivo === null,
    motivo,
    colaborador,
    tsEmployeeId,
    payrollEmployeeId: payroll?.id ?? null,
    payrollCompanyId: payroll?.company_id ?? null,
    empresaConfigurada,
  };
}

async function completar(
  store: VinculoStore,
  colaborador: ColaboradorVinculoRow,
  opts: { enqueue: boolean },
): Promise<VinculoResolvido> {
  if (!colaborador.user_id) {
    return fechar(colaborador, false, null, null, 'sem_user');
  }
  if (colaborador.contabilizar_timesheet !== true) {
    return fechar(colaborador, false, null, null, 'flag_inativa');
  }
  const empresaConfigurada = colaborador.empresa_id
    ? await store.empresaEnabled(colaborador.empresa_id)
    : false;
  if (!colaborador.empresa_id || !empresaConfigurada) {
    return fechar(colaborador, empresaConfigurada, null, null, 'sem_empresa');
  }

  let map = await store.peopleMap(colaborador.id);
  if (!map && opts.enqueue) {
    await store.enqueueActive(colaborador.id);
    map = await store.peopleMap(colaborador.id);
  }
  if (!map) {
    return fechar(colaborador, true, null, null, 'sem_people_map');
  }

  const payroll = await ligarFolha(store, colaborador);
  if (payroll === 'ambiguo') {
    return fechar(colaborador, true, map.tsEmployeeId, null, 'ambiguo');
  }
  if (!payroll) {
    return fechar(colaborador, true, map.tsEmployeeId, null, 'sem_folha');
  }
  return fechar(colaborador, true, map.tsEmployeeId, payroll, null);
}

async function ligarFolha(
  store: VinculoStore,
  colaborador: ColaboradorVinculoRow,
): Promise<PayrollVinculoRow | null | 'ambiguo'> {
  const direto = await store.payrollByGtId(colaborador.id);
  if (direto) return direto;

  const cpf = digits(colaborador.cpf);
  if (!cpf) return null;
  const rows = await store.payrollByCpf(cpf);
  const pick = pickPayroll(rows, colaborador.id);
  if (pick.kind === 'many') return 'ambiguo';
  if (pick.kind === 'none') return null;
  if (!pick.row.employee_id) {
    const ok = await store.setPayrollGtIdIfEmpty(pick.row.id, colaborador.id);
    if (!ok) {
      const again = await store.payrollByGtId(colaborador.id);
      return again;
    }
    return { ...pick.row, employee_id: colaborador.id };
  }
  return pick.row;
}

async function gravarUserId(
  store: VinculoStore,
  row: ColaboradorVinculoRow,
  userId: string,
): Promise<ColaboradorVinculoRow | null> {
  const ok = row.user_id
    ? await store.setUserIdFrom(row.id, row.user_id, userId)
    : await store.setUserIdIfEmpty(row.id, userId);
  if (!ok) return store.colaboradorByUserId(userId);
  return { ...row, user_id: userId };
}

async function acharPorIdentidade(
  store: VinculoStore,
  userId: string,
): Promise<ColaboradorVinculoRow | 'ambiguo' | null> {
  const user = await store.userById(userId);
  if (!user) return null;
  const cpf = digits(user.tax_id);
  const email = emailNorm(user.email);
  const phone = phoneKey(user.phone_number);
  if (!cpf && !email && !phone) return null;
  const rows = await store.candidatos(cpf || null, email || null, phone || null);
  const pick = candidatosDoLogin(rows, userId);
  if (pick.kind === 'many') return 'ambiguo';
  if (pick.kind === 'one') {
    if (!pick.row.user_id) return gravarUserId(store, pick.row, userId);
    return pick.row;
  }

  const presos = rows.filter((row) => row.user_id && row.user_id !== userId);
  if (presos.length !== 1) return null;
  const row = presos[0];
  const outro = await store.userById(row.user_id as string);
  if (!podeReassumirLogin(user, row, outro)) return null;
  return gravarUserId(store, row, userId);
}

/** Resolve a cadeia a partir do usuário do portal (JWT). */
export async function resolveVinculoByUser(
  store: VinculoStore,
  userId: string,
  opts: { enqueue?: boolean } = {},
): Promise<VinculoResolvido> {
  let direto: ColaboradorVinculoRow | null;
  try {
    direto = await store.colaboradorByUserId(userId);
  } catch (error) {
    if (error instanceof Error && error.message === 'ambiguo') {
      return { ...VAZIO, motivo: 'ambiguo' };
    }
    throw error;
  }
  if (direto) return completar(store, direto, { enqueue: opts.enqueue !== false });

  const achado = await acharPorIdentidade(store, userId);
  if (achado === 'ambiguo') return { ...VAZIO, motivo: 'ambiguo' };
  if (!achado) return VAZIO;
  return completar(store, achado, { enqueue: opts.enqueue !== false });
}

/** Resolve a cadeia a partir do externalId (gt_colaboradores.id) do webhook. */
export async function resolveVinculoByExternalId(
  store: VinculoStore,
  externalId: string,
  opts: { enqueue?: boolean } = {},
): Promise<VinculoResolvido> {
  const colab = await store.colaboradorById(externalId);
  if (!colab) return VAZIO;
  return completar(store, colab, { enqueue: opts.enqueue === true });
}

const COLAB_SELECT =
  'id, user_id, empresa_id, cpf, email, telefone, telefone_2, nome_completo, contabilizar_timesheet, ativo, timesheet_sync_status';

function asColab(row: unknown): ColaboradorVinculoRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as ColaboradorVinculoRow;
  if (!r.id) return null;
  return r;
}

export function createSupabaseVinculoStore(db: SupabaseClient): VinculoStore {
  return {
    async colaboradorByUserId(userId) {
      const { data, error } = await db
        .from('gt_colaboradores')
        .select(COLAB_SELECT)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(2);
      if (error) throw new Error(`gt_colaboradores user_id: ${error.message}`);
      const rows = (data || []).map(asColab).filter((r): r is ColaboradorVinculoRow => Boolean(r));
      if (rows.length > 1) {
        throw new Error('ambiguo');
      }
      return rows[0] ?? null;
    },
    async colaboradorById(id) {
      const { data, error } = await db
        .from('gt_colaboradores')
        .select(COLAB_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw new Error(`gt_colaboradores id: ${error.message}`);
      return asColab(data);
    },
    async userById(userId) {
      const { data, error } = await db
        .from('users_unified')
        .select('id, email, tax_id, phone_number, first_name, last_name')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`users_unified: ${error.message}`);
      if (!data) return null;
      return {
        id: String(data.id),
        email: data.email ? String(data.email) : null,
        tax_id: data.tax_id ? String(data.tax_id) : null,
        phone_number: data.phone_number ? String(data.phone_number) : null,
        first_name: data.first_name ? String(data.first_name) : null,
        last_name: data.last_name ? String(data.last_name) : null,
      };
    },
    async candidatos(cpfDigits, email, phoneDigits) {
      const filters: string[] = [];
      if (cpfDigits) {
        filters.push(`cpf.eq.${cpfDigits}`, `cpf.eq.${formatCpf(cpfDigits)}`);
      }
      if (email) filters.push(`email.ilike.${email}`);
      const suffix = phoneDigits && phoneDigits.length >= 11 ? phoneDigits.slice(-9) : '';
      if (suffix) {
        filters.push(`telefone.ilike.%${suffix}`, `telefone_2.ilike.%${suffix}`);
      }
      if (filters.length === 0) return [];
      const { data, error } = await db
        .from('gt_colaboradores')
        .select(COLAB_SELECT)
        .is('deleted_at', null)
        .or(filters.join(','))
        .limit(20);
      if (error) throw new Error(`gt_colaboradores candidatos: ${error.message}`);
      const seen = new Set<string>();
      const out: ColaboradorVinculoRow[] = [];
      for (const raw of data || []) {
        const row = asColab(raw);
        if (!row || seen.has(row.id)) continue;
        const cpfOk = cpfDigits ? digits(row.cpf) === cpfDigits : false;
        const emailOk = email ? emailNorm(row.email) === email : false;
        const phoneOk = phoneDigits
          ? phoneKey(row.telefone) === phoneDigits || phoneKey(row.telefone_2) === phoneDigits
          : false;
        if (!cpfOk && !emailOk && !phoneOk) continue;
        seen.add(row.id);
        out.push(row);
      }
      return out;
    },
    async setUserIdIfEmpty(colaboradorId, userId) {
      const { data, error } = await db
        .from('gt_colaboradores')
        .update({ user_id: userId })
        .eq('id', colaboradorId)
        .is('user_id', null)
        .select('id');
      if (error) throw new Error(`gt user_id: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async setUserIdFrom(colaboradorId, fromUserId, toUserId) {
      const { data, error } = await db
        .from('gt_colaboradores')
        .update({ user_id: toUserId })
        .eq('id', colaboradorId)
        .eq('user_id', fromUserId)
        .select('id');
      if (error) throw new Error(`gt user_id troca: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async peopleMap(colaboradorId) {
      const { data, error } = await db
        .from('ts_people_map')
        .select('ts_employee_id, empresa_id')
        .eq('colaborador_id', colaboradorId)
        .maybeSingle();
      if (error) throw new Error(`ts_people_map: ${error.message}`);
      if (!data?.ts_employee_id) return null;
      return { tsEmployeeId: String(data.ts_employee_id), empresaId: String(data.empresa_id) };
    },
    async empresaEnabled(empresaId) {
      const { data, error } = await db
        .from('ts_empresa_config')
        .select('enabled')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (error) throw new Error(`ts_empresa_config: ${error.message}`);
      return data?.enabled === true;
    },
    async payrollByGtId(gtId) {
      const { data, error } = await db
        .from('payroll_employees')
        .select('id, employee_id, cpf, company_id')
        .eq('employee_id', gtId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`payroll_employees gt: ${error.message}`);
      return (data as PayrollVinculoRow | null) ?? null;
    },
    async payrollByCpf(cpfDigits) {
      const { data, error } = await db
        .from('payroll_employees')
        .select('id, employee_id, cpf, company_id')
        .or(`cpf.eq.${cpfDigits},cpf.eq.${formatCpf(cpfDigits)}`)
        .limit(20);
      if (error) throw new Error(`payroll_employees cpf: ${error.message}`);
      return ((data || []) as PayrollVinculoRow[]).filter((row) => digits(row.cpf) === cpfDigits);
    },
    async setPayrollGtIdIfEmpty(payrollId, gtId) {
      const { data, error } = await db
        .from('payroll_employees')
        .update({ employee_id: gtId })
        .eq('id', payrollId)
        .is('employee_id', null)
        .select('id');
      if (error) throw new Error(`payroll employee_id: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async enqueueActive(colaboradorId) {
      const { enqueueSync } = await import('./outbox');
      await enqueueSync(colaboradorId, 'active', db);
    },
  };
}

export interface ReconcileVinculoResult {
  checked: number;
  userLinked: number;
  folhaLinked: number;
  enqueued: number;
}

/**
 * Reconciliação noturna dos três elos (login, people map, folha).
 * Não cria payroll_employees. Não troca user_id já preenchido.
 */
export async function reconcileVinculos(db: SupabaseClient): Promise<ReconcileVinculoResult> {
  const store = createSupabaseVinculoStore(db);
  const { data, error } = await db
    .from('gt_colaboradores')
    .select(COLAB_SELECT)
    .eq('contabilizar_timesheet', true)
    .is('deleted_at', null);
  if (error) throw new Error(`reconcile vinculo: ${error.message}`);

  let userLinked = 0;
  let folhaLinked = 0;
  let enqueued = 0;
  const rows = (data || []) as ColaboradorVinculoRow[];

  for (const row of rows) {
    let current = row;
    if (!current.user_id) {
      const cpf = digits(current.cpf);
      const email = emailNorm(current.email);
      if (cpf || email) {
        const filters: string[] = [];
        if (cpf) filters.push(`tax_id.eq.${cpf}`, `tax_id.eq.${formatCpf(cpf)}`);
        if (email) filters.push(`email.ilike.${email}`);
        const { data: users, error: userError } = await db
          .from('users_unified')
          .select('id, email, tax_id')
          .or(filters.join(','))
          .limit(5);
        if (userError) throw new Error(`reconcile users: ${userError.message}`);
        const matches = (users || []).filter((u) => {
          const cpfOk = cpf ? digits(u.tax_id ? String(u.tax_id) : '') === cpf : false;
          const emailOk = email ? emailNorm(u.email ? String(u.email) : '') === email : false;
          return cpfOk || emailOk;
        });
        if (matches.length === 1) {
          const ok = await store.setUserIdIfEmpty(current.id, String(matches[0].id));
          if (ok) {
            userLinked += 1;
            current = { ...current, user_id: String(matches[0].id) };
          }
        }
      }
    }

    const antes = await store.payrollByGtId(current.id);
    if (!antes) {
      const ligado = await ligarFolha(store, current);
      if (ligado && ligado !== 'ambiguo') folhaLinked += 1;
    }

    const map = await store.peopleMap(current.id);
    if (!map && current.user_id && current.empresa_id) {
      const enabled = await store.empresaEnabled(current.empresa_id);
      if (enabled) {
        await store.enqueueActive(current.id);
        enqueued += 1;
      }
    }
  }

  return { checked: rows.length, userLinked, folhaLinked, enqueued };
}
