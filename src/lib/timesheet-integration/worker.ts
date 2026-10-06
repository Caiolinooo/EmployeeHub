/**
 * Worker da outbox de integração Time-Sheet (design §9).
 * - drainOutbox: claim SKIP LOCKED via rpc `ts_claim_outbox` (migration
 *   20261006_000002), backoff 2^n minutos, dead após 8 tentativas
 *   (timesheet_sync_status='error' no gt_colaboradores). Sucesso grava
 *   ts_people_map (com hash do payload) e remove o job.
 * - reconcileTimesheetSync: reenfileira flag=true com hash ≠ último enviado
 *   ou status error; guarda anti-massa aborta se > 20% dos ativos passariam
 *   a inativos num run.
 * Nunca deleta no TS: flag off ⇒ active:false (D6).
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTimesheetClient } from './client';
import { enqueueSync } from './outbox';
import {
  hashPersonPayload,
  mapColaboradorToPerson,
  type ColaboradorSyncInput,
  type MapperContext,
} from './mapper';
import { isEmpresaTenantEnabled, listEmpresaConfigs } from './settings';
import type { OutboxJob, PersonUpsert, SyncDesired, SyncState } from './types';

const MAX_ATTEMPTS = 8;
const MASS_INACTIVATION_GUARD = 0.2;

export interface DrainResult {
  ok: number;
  failed: number;
  dead: number;
}

export interface ReconcileResult {
  checked: number;
  enqueued: number;
  skipped: number;
  aborted: boolean;
}

export interface QueueStatus {
  pendentes: number;
  aguardandoRetry: number;
  dead: number;
}

const COLABORADOR_SELECT =
  'id, nome_completo, cpf, user_id, empresa_id, ativo, contabilizar_timesheet, regime_trabalho, escala_embarque, escala_folga, timesheet_sync_status';

interface PeopleMapRow {
  colaborador_id: string;
  empresa_id: string;
  ts_employee_id: string;
  last_payload_hash: string | null;
}

interface ClaimedJobRow {
  id: string;
  colaborador_id: string;
  desired: SyncDesired;
  attempts: number;
  next_attempt_at: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** E-mail de login (users_unified via user_id) — null se ausente. */
async function resolveEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from('users_unified')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  const email = data && typeof data.email === 'string' ? data.email.trim() : '';
  return email || null;
}

/** Âncora do ciclo: data_embarque do evento de embarque mais recente. */
async function resolveAnchorEmbarque(colaboradorId: string): Promise<string | null> {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from('gt_historico_embarques')
    .select('data_embarque')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .not('data_embarque', 'is', null)
    .order('data_embarque', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data && typeof data.data_embarque === 'string' ? data.data_embarque : null;
}

async function resolveEmpresaNome(empresaId: string | null | undefined): Promise<string | null> {
  if (!empresaId) return null;
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from('gt_empresas')
    .select('nome')
    .eq('id', empresaId)
    .maybeSingle();
  return data && typeof data.nome === 'string' ? data.nome : null;
}

async function setColaboradorSyncState(
  colaboradorId: string,
  status: SyncState,
  syncError: string | null,
): Promise<void> {
  const admin = await getSupabaseAdmin();
  const patch: Record<string, unknown> = {
    timesheet_sync_status: status,
    timesheet_sync_error: syncError,
  };
  if (status === 'active' || status === 'inactive') {
    patch.timesheet_synced_at = new Date().toISOString();
  }
  const { error } = await admin.from('gt_colaboradores').update(patch).eq('id', colaboradorId);
  if (error) {
    console.error(`[timesheet-worker] falha ao atualizar status do colaborador ${colaboradorId}:`, error.message);
  }
}

async function markJobDead(jobId: string, colaboradorId: string, reason: string): Promise<void> {
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from('ts_integration_outbox')
    .update({ dead_at: new Date().toISOString(), last_error: reason })
    .eq('id', jobId);
  if (error) {
    console.error(`[timesheet-worker] falha ao marcar job ${jobId} dead:`, error.message);
  }
  await setColaboradorSyncState(colaboradorId, 'error', reason);
}

async function scheduleRetry(job: OutboxJob, reason: string): Promise<void> {
  const admin = await getSupabaseAdmin();
  // Backoff 2^n minutos (attempts já incrementado no claim), teto de 24h.
  const delayMin = Math.min(2 ** job.attempts, 24 * 60);
  const nextAttemptAt = new Date(Date.now() + delayMin * 60_000).toISOString();
  const { error } = await admin
    .from('ts_integration_outbox')
    .update({ last_error: reason, next_attempt_at: nextAttemptAt })
    .eq('id', job.id);
  if (error) {
    console.error(`[timesheet-worker] falha ao reagendar job ${job.id}:`, error.message);
  }
}

async function completeJob(
  job: OutboxJob,
  person: PersonUpsert,
  empresaId: string,
  employeeId: string,
  payloadHash: string,
): Promise<void> {
  const admin = await getSupabaseAdmin();
  const { error: mapError } = await admin.from('ts_people_map').upsert(
    {
      colaborador_id: job.colaboradorId,
      empresa_id: empresaId,
      ts_employee_id: employeeId,
      last_payload_hash: payloadHash,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'colaborador_id' },
  );
  if (mapError) throw new Error(`ts_people_map upsert: ${mapError.message}`);

  await setColaboradorSyncState(
    job.colaboradorId,
    person.active ? 'active' : 'inactive',
    null,
  );

  const { error: delError } = await admin
    .from('ts_integration_outbox')
    .delete()
    .eq('id', job.id);
  if (delError) {
    console.error(`[timesheet-worker] falha ao remover job ${job.id}:`, delError.message);
  }
}

async function processJob(job: OutboxJob): Promise<void> {
  const admin = await getSupabaseAdmin();
  const { data: colab, error: colabError } = await admin
    .from('gt_colaboradores')
    .select(COLABORADOR_SELECT)
    .eq('id', job.colaboradorId)
    .maybeSingle();
  if (colabError) throw new Error(`gt_colaboradores: ${colabError.message}`);
  if (!colab) {
    // Colaborador removido: cascade costuma limpar; garante a remoção do job.
    await admin.from('ts_integration_outbox').delete().eq('id', job.id);
    return;
  }

  const input = colab as unknown as ColaboradorSyncInput;
  const ctx: MapperContext = {
    email: await resolveEmail(input.user_id),
    empresaTenantConfigurada: input.empresa_id
      ? await isEmpresaTenantEnabled(String(input.empresa_id))
      : false,
    anchorEmbarque: await resolveAnchorEmbarque(job.colaboradorId),
  };

  const mapped = mapColaboradorToPerson(
    { ...input, empresa_nome: await resolveEmpresaNome(input.empresa_id) },
    ctx,
  );
  if (!mapped.ok) {
    // Erro estrutural (sem_login/empresa_sem_tenant/sem_ancora): dead imediato.
    await markJobDead(job.id, job.colaboradorId, mapped.reason);
    return;
  }

  const person = mapped.person;
  const empresaId = String(input.empresa_id);
  const payloadHash = hashPersonPayload(person);

  const { data: mapRow } = await admin
    .from('ts_people_map')
    .select('colaborador_id, empresa_id, ts_employee_id, last_payload_hash')
    .eq('colaborador_id', job.colaboradorId)
    .maybeSingle();
  const existing = (mapRow as PeopleMapRow | null) ?? null;

  const client = await getTimesheetClient(empresaId);

  // Troca de empresa (1 tenant por empresa): desativa no tenant antigo antes
  // de provisionar no novo; histórico fica no tenant antigo (§13).
  if (existing && existing.empresa_id !== empresaId) {
    try {
      const oldClient = await getTimesheetClient(existing.empresa_id);
      await oldClient.putPerson(
        { ...person, active: false },
        { idempotencyKey: `${job.colaboradorId}:${payloadHash}:tenant-off` },
      );
    } catch (err) {
      console.error(
        `[timesheet-worker] falha ao desativar no tenant antigo (${existing.empresa_id}):`,
        errorMessage(err),
      );
    }
  }

  // No-op por hash (design C): payload idêntico ao último enviado e sem erro.
  if (
    existing &&
    existing.empresa_id === empresaId &&
    existing.last_payload_hash === payloadHash &&
    (colab as Record<string, unknown>).timesheet_sync_status !== 'error'
  ) {
    await admin.from('ts_integration_outbox').delete().eq('id', job.id);
    await setColaboradorSyncState(job.colaboradorId, person.active ? 'active' : 'inactive', null);
    return;
  }

  const result = await client.putPerson(person, {
    idempotencyKey: `${job.colaboradorId}:${payloadHash}`,
  });
  await completeJob(job, person, empresaId, result.employeeId, payloadHash);
}

/**
 * Drena a outbox (padrão 25 por lote). Claim SKIP LOCKED incrementa attempts
 * e esconde o lote por 5 min (visibility timeout); falha reagenda com 2^n min;
 * attempts >= 8 ⇒ dead + status error no colaborador.
 */
export async function drainOutbox(
  limit = 25,
): Promise<DrainResult> {
  const admin = await getSupabaseAdmin();
  const { data: claimed, error } = await admin.rpc('ts_claim_outbox', { p_limit: limit });
  if (error) throw new Error(`ts_claim_outbox: ${error.message}`);

  const jobs: OutboxJob[] = ((claimed as ClaimedJobRow[] | null) || []).map((row) => ({
    id: row.id,
    colaboradorId: row.colaborador_id,
    desired: row.desired,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
  }));

  let ok = 0;
  let failed = 0;
  let dead = 0;

  for (const job of jobs) {
    try {
      await processJob(job);
      ok += 1;
    } catch (err) {
      const reason = errorMessage(err);
      console.error(`[timesheet-worker] job ${job.id} (colab ${job.colaboradorId}) falhou:`, reason);
      if (job.attempts >= MAX_ATTEMPTS) {
        await markJobDead(job.id, job.colaboradorId, reason);
        dead += 1;
      } else {
        await scheduleRetry(job, reason);
        failed += 1;
      }
    }
  }

  return { ok, failed, dead };
}

/**
 * Reconciliação noturna (fluxo 6): para todos com contabilizar_timesheet=true,
 * reenfileira quem tem hash ≠ último enviado ou status error. Guarda
 * anti-massa: se > 20% dos ativos passariam a inativos, aborta e alerta.
 */
export async function reconcileTimesheetSync(): Promise<ReconcileResult> {
  const admin = await getSupabaseAdmin();
  const { data: colaboradores, error } = await admin
    .from('gt_colaboradores')
    .select(COLABORADOR_SELECT)
    .eq('contabilizar_timesheet', true);
  if (error) throw new Error(`reconcile gt_colaboradores: ${error.message}`);

  const rows = (colaboradores || []) as unknown as (ColaboradorSyncInput & {
    timesheet_sync_status?: SyncState | null;
  })[];
  if (rows.length === 0) return { checked: 0, enqueued: 0, skipped: 0, aborted: false };

  const ids = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const empresaIds = [...new Set(rows.map((r) => r.empresa_id).filter((v): v is string => Boolean(v)))];

  const [usersRes, embarquesRes, empresasRes, mapRes, configs] = await Promise.all([
    userIds.length
      ? admin.from('users_unified').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[], error: null }),
    admin
      .from('gt_historico_embarques')
      .select('colaborador_id, data_embarque')
      .in('colaborador_id', ids)
      .is('deleted_at', null)
      .not('data_embarque', 'is', null)
      .limit(10000),
    empresaIds.length
      ? admin.from('gt_empresas').select('id, nome').in('id', empresaIds)
      : Promise.resolve({ data: [] as { id: string; nome: string | null }[], error: null }),
    admin.from('ts_people_map').select('colaborador_id, empresa_id, ts_employee_id, last_payload_hash').in('colaborador_id', ids),
    listEmpresaConfigs(),
  ]);

  const emailByUserId: Record<string, string | null> = {};
  for (const u of usersRes.data || []) emailByUserId[u.id] = u.email;
  const anchorByColab: Record<string, string> = {};
  for (const e of embarquesRes.data || []) {
    const atual = anchorByColab[e.colaborador_id];
    if (e.data_embarque && (!atual || e.data_embarque > atual)) {
      anchorByColab[e.colaborador_id] = e.data_embarque;
    }
  }
  const nomeByEmpresa: Record<string, string | null> = {};
  for (const emp of empresasRes.data || []) nomeByEmpresa[emp.id] = emp.nome;
  const mapByColab: Record<string, PeopleMapRow> = {};
  for (const m of (mapRes.data as PeopleMapRow[] | null) || []) mapByColab[m.colaborador_id] = m;
  const enabledEmpresas = new Set(configs.filter((c) => c.enabled).map((c) => c.empresaId));

  interface Candidate {
    colaboradorId: string;
    desired: SyncDesired;
    currentlyActive: boolean;
  }
  const candidates: Candidate[] = [];
  let checked = 0;
  let skipped = 0;
  let totalActive = 0;

  for (const row of rows) {
    checked += 1;
    const existing = mapByColab[row.id] || null;
    if (row.timesheet_sync_status === 'active') totalActive += 1;

    const mapped = mapColaboradorToPerson(
      { ...row, empresa_nome: row.empresa_id ? nomeByEmpresa[row.empresa_id] || null : null },
      {
        email: row.user_id ? emailByUserId[row.user_id] || null : null,
        empresaTenantConfigurada: Boolean(row.empresa_id && enabledEmpresas.has(row.empresa_id)),
        anchorEmbarque: anchorByColab[row.id] || null,
      },
    );

    if (!mapped.ok) {
      // Erro estrutural: visível no cadastro, sem reenfileirar em loop.
      if (row.timesheet_sync_status !== 'error') {
        await setColaboradorSyncState(row.id, 'error', mapped.reason);
      }
      skipped += 1;
      continue;
    }

    const payloadHash = hashPersonPayload(mapped.person);
    const needsSync =
      row.timesheet_sync_status === 'error' ||
      !existing ||
      existing.empresa_id !== row.empresa_id ||
      existing.last_payload_hash !== payloadHash;

    if (!needsSync) {
      skipped += 1;
      continue;
    }

    candidates.push({
      colaboradorId: row.id,
      desired: mapped.person.active ? 'active' : 'inactive',
      currentlyActive: row.timesheet_sync_status === 'active',
    });
  }

  // Guarda anti-massa (§9.6): > 20% dos ativos virariam inativos ⇒ aborta.
  const inactivations = candidates.filter((c) => c.currentlyActive && c.desired === 'inactive').length;
  if (totalActive > 0 && inactivations / totalActive > MASS_INACTIVATION_GUARD) {
    console.error(
      `[timesheet-worker] reconciliação ABORTADA: ${inactivations}/${totalActive} ativos virariam inativos (> ${MASS_INACTIVATION_GUARD * 100}%). Verificar mudança em massa antes de reprocessar.`,
    );
    return { checked, enqueued: 0, skipped, aborted: true };
  }

  let enqueued = 0;
  for (const candidate of candidates) {
    try {
      await enqueueSync(candidate.colaboradorId, candidate.desired);
      enqueued += 1;
    } catch (err) {
      console.error(
        `[timesheet-worker] falha ao reenfileirar ${candidate.colaboradorId}:`,
        errorMessage(err),
      );
    }
  }

  return { checked, enqueued, skipped, aborted: false };
}

/** Reprocessa jobs dead (botão admin): zera tentativas e volta p/ a fila. */
export async function reprocessDeadJobs(): Promise<number> {
  const admin = await getSupabaseAdmin();
  const { data: deadJobs, error } = await admin
    .from('ts_integration_outbox')
    .select('id, colaborador_id')
    .not('dead_at', 'is', null);
  if (error) throw new Error(`reprocessDeadJobs select: ${error.message}`);
  const jobs = (deadJobs as { id: string; colaborador_id: string }[] | null) || [];
  if (jobs.length === 0) return 0;

  const now = new Date().toISOString();
  const { error: updError } = await admin
    .from('ts_integration_outbox')
    .update({ dead_at: null, attempts: 0, next_attempt_at: now, last_error: null })
    .not('dead_at', 'is', null);
  if (updError) throw new Error(`reprocessDeadJobs update: ${updError.message}`);

  await Promise.all(
    jobs.map((job) => setColaboradorSyncState(job.colaborador_id, 'pending', null)),
  );
  return jobs.length;
}

/** Status da fila para a UI admin. */
export async function getQueueStatus(): Promise<QueueStatus> {
  const admin = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const count = async (build: () => unknown): Promise<number> => {
    const res = await (build() as PromiseLike<{ count: number | null; error: { message: string } | null }>);
    if (res.error) throw new Error(`getQueueStatus: ${res.error.message}`);
    return res.count ?? 0;
  };

  const [pendentes, aguardandoRetry, dead] = await Promise.all([
    count(() =>
      admin
        .from('ts_integration_outbox')
        .select('id', { count: 'exact', head: true })
        .is('dead_at', null)
        .lte('next_attempt_at', now),
    ),
    count(() =>
      admin
        .from('ts_integration_outbox')
        .select('id', { count: 'exact', head: true })
        .is('dead_at', null)
        .gt('next_attempt_at', now),
    ),
    count(() =>
      admin
        .from('ts_integration_outbox')
        .select('id', { count: 'exact', head: true })
        .not('dead_at', 'is', null),
    ),
  ]);

  return { pendentes, aguardandoRetry, dead };
}
