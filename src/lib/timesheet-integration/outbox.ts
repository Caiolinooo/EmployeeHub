/**
 * Outbox de sync Portal → Time-Sheet (design §5/§9, D2).
 * - enqueueSync: no máximo 1 job vivo por colaborador (unique parcial
 *   ts_outbox_one_pending); re-enqueue coalesce — último desired vence.
 * - syncColaboradorAfterSave: decide se reenfileira (flag mudou OU hash do
 *   payload mudou) e marca status de sync em gt_colaboradores.
 * Best-effort por contrato: as rotas chamam em try/catch — falha aqui NUNCA
 * falha o save do cadastro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hashPersonPayload,
  mapColaboradorToPerson,
  type ColaboradorSyncInput,
} from './mapper';
import type { SyncDesired } from './types';

/** Mínimo de SupabaseClient usado aqui (injetável p/ testes). */
export type OutboxDbClient = Pick<SupabaseClient, 'from'>;

async function defaultClient(): Promise<OutboxDbClient> {
  // Dynamic import (exceção justificada): '@/lib/supabase' valida env vars no
  // load do módulo e quebraria `node:test` (env-less); testes injetam mock.
  const { supabaseAdmin } = await import('@/lib/supabase');
  return supabaseAdmin;
}

/**
 * Upsert manual do job pendente (PostgREST não expressa ON CONFLICT com
 * predicado do índice parcial). Race de insert concorrente (23505) vira update.
 * Também marca o colaborador como 'pending' (status visível no form).
 */
export async function enqueueSync(
  colaboradorId: string,
  desired: SyncDesired,
  client?: OutboxDbClient,
): Promise<void> {
  const db = client ?? (await defaultClient());
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await db
    .from('ts_integration_outbox')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .is('dead_at', null)
    .maybeSingle();
  if (findError) throw new Error(`enqueueSync lookup: ${findError.message}`);

  if (existing) {
    // Coalesce: último desired vence; reagenda para já e limpa erro anterior.
    const { error } = await db
      .from('ts_integration_outbox')
      .update({ desired, next_attempt_at: now, last_error: null })
      .eq('id', existing.id);
    if (error) throw new Error(`enqueueSync update: ${error.message}`);
  } else {
    const { error } = await db
      .from('ts_integration_outbox')
      .insert({ colaborador_id: colaboradorId, desired, next_attempt_at: now });
    if (error) {
      if (error.code === '23505') {
        // Perdeu a race com um insert concorrente: coalesce no job existente.
        const { error: retryError } = await db
          .from('ts_integration_outbox')
          .update({ desired, next_attempt_at: now, last_error: null })
          .eq('colaborador_id', colaboradorId)
          .is('dead_at', null);
        if (retryError) throw new Error(`enqueueSync race-update: ${retryError.message}`);
      } else {
        throw new Error(`enqueueSync insert: ${error.message}`);
      }
    }
  }

  const { error: statusError } = await db
    .from('gt_colaboradores')
    .update({ timesheet_sync_status: 'pending', timesheet_sync_error: null })
    .eq('id', colaboradorId);
  if (statusError) throw new Error(`enqueueSync status: ${statusError.message}`);
}

export interface AfterSaveResult {
  enqueued: boolean;
  desired?: SyncDesired;
  /** Motivo de erro estrutural (status='error', sem job): sem_login etc. */
  reason?: string;
}

interface ColaboradorSyncRow extends ColaboradorSyncInput {
  timesheet_sync_status?: string | null;
}

const SYNC_SELECT =
  'id, nome_completo, cpf, user_id, empresa_id, ativo, contabilizar_timesheet,' +
  ' regime_trabalho, escala_embarque, escala_folga, timesheet_sync_status';

/**
 * Decide e reenfileira após POST/PUT do cadastro (design §9 fluxos 1–3).
 * - flag off: enfileira 'inactive' só se a flag mudou (flag off nunca deleta —
 *   vira active:false no TS; worker no-op se nunca foi provisionado).
 * - flag on: monta o payload; erro estrutural marca status='error' sem job;
 *   enfileira se flag mudou OU hash ≠ ts_people_map.last_payload_hash OU
 *   status anterior era 'error' (retry explícito via novo save).
 */
export async function syncColaboradorAfterSave(
  colaboradorId: string,
  opts: { flagChanged?: boolean } = {},
  client?: OutboxDbClient,
): Promise<AfterSaveResult> {
  const db = client ?? (await defaultClient());

  const { data: colab, error: colabError } = await db
    .from('gt_colaboradores')
    .select(SYNC_SELECT)
    .eq('id', colaboradorId)
    .maybeSingle();
  if (colabError) throw new Error(`afterSave colaborador: ${colabError.message}`);
  if (!colab) return { enqueued: false, reason: 'colaborador_nao_encontrado' };

  // Cast duplo justificado: supabase-js sem Database types resolve select como GenericStringError.
  const row = colab as unknown as ColaboradorSyncRow;
  const flagChanged = opts.flagChanged === true;

  if (row.contabilizar_timesheet !== true) {
    if (flagChanged) {
      await enqueueSync(colaboradorId, 'inactive', db);
      return { enqueued: true, desired: 'inactive' };
    }
    return { enqueued: false };
  }

  // ---- flag on: precisa do payload completo para comparar o hash ----
  let email: string | null = null;
  if (row.user_id) {
    const { data: user } = await db
      .from('users_unified')
      .select('email')
      .eq('id', row.user_id)
      .maybeSingle();
    email = user?.email ? String(user.email) : null;
  }

  let empresaTenantConfigurada = false;
  if (row.empresa_id) {
    const { data: cfg } = await db
      .from('ts_empresa_config')
      .select('empresa_id')
      .eq('empresa_id', row.empresa_id)
      .eq('enabled', true)
      .maybeSingle();
    empresaTenantConfigurada = Boolean(cfg);
  }

  // Âncora: data_embarque do evento de embarque (ON real) mais recente.
  let anchorEmbarque: string | null = null;
  const { data: embarque } = await db
    .from('gt_historico_embarques')
    .select('data_embarque')
    .eq('colaborador_id', colaboradorId)
    .eq('tipo', 'normal')
    .is('deleted_at', null)
    .order('data_embarque', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (embarque?.data_embarque) anchorEmbarque = String(embarque.data_embarque).slice(0, 10);

  const mapped = mapColaboradorToPerson(row, { email, empresaTenantConfigurada, anchorEmbarque });
  if (!mapped.ok) {
    // Erro estrutural: visível no cadastro; reconciliação noturna reenfileira
    // quando o dado faltar deixar de faltar (design §9.6/§13).
    const { error: statusError } = await db
      .from('gt_colaboradores')
      .update({ timesheet_sync_status: 'error', timesheet_sync_error: mapped.reason })
      .eq('id', colaboradorId);
    if (statusError) throw new Error(`afterSave status: ${statusError.message}`);
    return { enqueued: false, reason: mapped.reason };
  }

  const payloadHash = hashPersonPayload(mapped.person);
  const { data: peopleMap } = await db
    .from('ts_people_map')
    .select('last_payload_hash')
    .eq('colaborador_id', colaboradorId)
    .maybeSingle();

  const hashChanged = !peopleMap || peopleMap.last_payload_hash !== payloadHash;
  const retryAfterError = row.timesheet_sync_status === 'error';

  if (flagChanged || hashChanged || retryAfterError) {
    await enqueueSync(colaboradorId, 'active', db);
    return { enqueued: true, desired: 'active' };
  }
  return { enqueued: false };
}
