/**
 * Mapper gt_colaboradores → PersonUpsert (Integration API v1), design §5/§6.
 * Lib pura e síncrona: a resolução de email (users_unified via user_id),
 * config de tenant (ts_empresa_config) e âncora (gt_historico_embarques)
 * acontece ANTES, na outbox/worker — aqui entram prontas via MapperContext.
 */
import { createHash } from 'crypto';
import { extractEscalaDias } from '@/lib/gestao-tripulantes/regime-escala';
import type { ISODate, PersonUpsert, WorkSchedule } from './types';

/** Subconjunto de gt_colaboradores necessário ao payload de sync. */
export interface ColaboradorSyncInput {
  id: string;
  nome_completo?: string | null;
  cpf?: string | null;
  user_id?: string | null;
  empresa_id?: string | null;
  ativo?: boolean | null;
  contabilizar_timesheet?: boolean | null;
  regime_trabalho?: string | null;
  escala_embarque?: number | string | null;
  escala_folga?: number | string | null;
  /** Atributos opacos ao TS (opcionais, só enriquecem o payload). */
  empresa_nome?: string | null;
  embarcacao_nome?: string | null;
}

export interface MapperContext {
  /** Email de login resolvido de users_unified via user_id (null se ausente). */
  email: string | null;
  /** Existe ts_empresa_config (enabled) para empresa_id do colaborador. */
  empresaTenantConfigurada: boolean;
  /** data_embarque do evento de embarque mais recente (gt_historico_embarques). */
  anchorEmbarque: ISODate | null;
}

export type MapColaboradorError = 'sem_login' | 'empresa_sem_tenant' | 'sem_ancora';

export type MapColaboradorResult =
  | { ok: true; person: PersonUpsert }
  | { ok: false; reason: MapColaboradorError };

/** Escala SEMPRE explícita (D7): NxN → pattern com âncora; demais → weekly seg–sex. */
function resolveSchedule(
  c: ColaboradorSyncInput,
  anchorEmbarque: ISODate | null,
): { ok: true; schedule: WorkSchedule } | { ok: false; reason: 'sem_ancora' } {
  const { diasEmbarque, diasFolga } = extractEscalaDias({
    regime_trabalho: c.regime_trabalho,
    escala_embarque: c.escala_embarque,
    escala_folga: c.escala_folga,
  });

  if (diasEmbarque > 0) {
    // Rotação NxN: âncora = início do ciclo (embarque mais recente). Sem ela o
    // TS não sabe alinhar o padrão — erro explícito em vez de chutar uma data.
    if (!anchorEmbarque) return { ok: false, reason: 'sem_ancora' };
    return {
      ok: true,
      schedule: {
        kind: 'pattern',
        daysOn: diasEmbarque,
        daysOff: diasFolga || diasEmbarque,
        anchor: anchorEmbarque,
      },
    };
  }

  // onshore / administrativo / sem_escala / sem dados: seg–sex, sempre explícito.
  return { ok: true, schedule: { kind: 'weekly', workdays: [1, 2, 3, 4, 5] } };
}

/**
 * Monta o PersonUpsert de um colaborador.
 * Erros estruturais (job dead, timesheet_sync_status='error'):
 * - sem user_id/email → 'sem_login' (payroll_employees não tem login)
 * - empresa sem tenant configurado → 'empresa_sem_tenant'
 * - rotação NxN sem evento de embarque → 'sem_ancora'
 * active = flag contabilizar_timesheet && ativo (desligado = false, nunca delete — D6).
 */
export function mapColaboradorToPerson(
  c: ColaboradorSyncInput,
  ctx: MapperContext,
): MapColaboradorResult {
  if (!c.user_id || !ctx.email) return { ok: false, reason: 'sem_login' };
  if (!c.empresa_id || !ctx.empresaTenantConfigurada) {
    return { ok: false, reason: 'empresa_sem_tenant' };
  }

  const schedule = resolveSchedule(c, ctx.anchorEmbarque);
  if (!schedule.ok) return schedule;

  const cpfDigits = String(c.cpf || '').replace(/\D/g, '');
  const attributes: Record<string, string> = {};
  if (c.empresa_nome) attributes.empresa = String(c.empresa_nome);
  if (c.embarcacao_nome) attributes.embarcacao = String(c.embarcacao_nome);

  return {
    ok: true,
    person: {
      externalId: c.id,
      email: ctx.email,
      displayName: String(c.nome_completo || '').trim() || ctx.email,
      ...(cpfDigits.length === 11 ? { cpf: cpfDigits } : {}),
      active: c.contabilizar_timesheet === true && c.ativo !== false,
      schedule: schedule.schedule,
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    },
  };
}

/**
 * Hash estável do payload de sync (sha256 hex). Comparado com
 * ts_people_map.last_payload_hash: mudança de email/escala/regime/nome/flag
 * reenfileira; payload idêntico é no-op (design C — hash/no-op).
 */
export function hashPersonPayload(p: PersonUpsert): string {
  const canonical = {
    externalId: p.externalId,
    email: p.email,
    displayName: p.displayName,
    cpf: p.cpf ?? null,
    active: p.active,
    schedule: p.schedule ?? null,
    managerExternalId: p.managerExternalId ?? null,
    attributes: p.attributes
      ? Object.keys(p.attributes).sort().map(k => [k, p.attributes![k]])
      : null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
