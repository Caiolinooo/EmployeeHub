/**
 * Cadeia única login ↔ GT ↔ PontoFlow ↔ folha.
 * CPF/e-mail só preenchem elo vazio quando o match é único. Nunca cria segunda pessoa.
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
  nome_completo: string | null;
  contabilizar_timesheet: boolean | null;
  ativo: boolean | null;
  timesheet_sync_status?: string | null;
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
  userById(userId: string): Promise<{ id: string; email: string | null; tax_id: string | null } | null>;
  candidatos(cpfDigits: string | null, email: string | null): Promise<ColaboradorVinculoRow[]>;
  setUserIdIfEmpty(colaboradorId: string, userId: string): Promise<boolean>;
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

async function acharPorIdentidade(
  store: VinculoStore,
  userId: string,
): Promise<ColaboradorVinculoRow | 'ambiguo' | null> {
  const user = await store.userById(userId);
  if (!user) return null;
  const cpf = digits(user.tax_id);
  const email = emailNorm(user.email);
  if (!cpf && !email) return null;
  const rows = await store.candidatos(cpf || null, email || null);
  const pick = candidatosDoLogin(rows, userId);
  if (pick.kind === 'many') return 'ambiguo';
  if (pick.kind === 'none') return null;
  if (!pick.row.user_id) {
    const ok = await store.setUserIdIfEmpty(pick.row.id, userId);
    if (!ok) {
      const again = await store.colaboradorByUserId(userId);
      return again;
    }
    return { ...pick.row, user_id: userId };
  }
  return pick.row;
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
  'id, user_id, empresa_id, cpf, email, nome_completo, contabilizar_timesheet, ativo, timesheet_sync_status';

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
        .select('id, email, tax_id')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`users_unified: ${error.message}`);
      if (!data) return null;
      return {
        id: String(data.id),
        email: data.email ? String(data.email) : null,
        tax_id: data.tax_id ? String(data.tax_id) : null,
      };
    },
    async candidatos(cpfDigits, email) {
      const filters: string[] = [];
      if (cpfDigits) {
        filters.push(`cpf.eq.${cpfDigits}`, `cpf.eq.${formatCpf(cpfDigits)}`);
      }
      if (email) filters.push(`email.ilike.${email}`);
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
        if (!cpfOk && !emailOk) continue;
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
