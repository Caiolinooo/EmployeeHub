/**
 * Tipos do adaptador Portal → Time-Sheet (PontoFlow) Integration API v1.
 * Contrato público versionado (design §5): o portal só conhece o TS por esta API.
 * Lib pura: sem imports de Supabase/Next.
 */

export type ISODate = string; // YYYY-MM-DD

export type WorkSchedule =
  | { kind: 'pattern'; daysOn: number; daysOff: number; anchor: ISODate } // 14x14, 28x28…
  | { kind: 'weekly'; workdays: (1 | 2 | 3 | 4 | 5 | 6 | 7)[] };          // onshore 5x2

export interface PersonUpsert {
  externalId: string;        // obrigatório, único por tenant (= gt_colaboradores.id)
  email: string;             // login/convite
  displayName: string;
  cpf?: string;              // 11 dígitos; só reconciliação/dedup
  active: boolean;
  schedule?: WorkSchedule;   // ausente => default do tenant (portal sempre envia explícito)
  managerExternalId?: string; // v1.1
  attributes?: Record<string, string>; // livre (empresa, embarcação…) — opaco ao TS
}

export interface PersonResult {
  employeeId: string;
  externalId: string;
  state: 'invited' | 'active' | 'inactive';
  created: boolean;
}

export type PunchKind = 'in' | 'out';
export type PunchSource = 'portal' | 'web';

export interface RubricaLine {
  code: string;
  quantity: number;
}

export interface PunchRecord {
  employeeId: string;
  externalId: string;
  timesheetId: string;
  entryId: string;
  date: string;
  kind: PunchKind;
  horaIni: string | null;
  horaFim: string | null;
}

export interface TodayPunch {
  date: string;
  open: boolean;
  horaIni: string | null;
  horaFim: string | null;
}

/** Resumo derivado que volta ao portal (D5): nunca batida bruta. */
export interface TimesheetSummary {
  timesheetId: string;
  externalId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  status: string;
  workedDays: number;
  workedMinutes: number;
}

export type SyncState = 'none' | 'pending' | 'active' | 'inactive' | 'error';
export type SyncDesired = 'active' | 'inactive';

export interface OutboxJob {
  id: string;
  colaboradorId: string;
  desired: SyncDesired;
  attempts: number;
  nextAttemptAt: string;
}

/** Cliente da Integration API v1 do TS (implementação em client.ts). */
export interface TimesheetClient {
  putPerson(p: PersonUpsert, o: { idempotencyKey: string }): Promise<PersonResult>;
  createSsoLink(p: { externalId: string }): Promise<{ url: string; expiresAt: string }>;
  listTimesheets(p: { externalId: string; from: ISODate; to: ISODate }): Promise<TimesheetSummary[]>;
  recordPunch(
    p: { externalId: string; kind: PunchKind; at: string; source: PunchSource; geo?: { lat: number; lng: number } | null },
    o: { idempotencyKey: string },
  ): Promise<PunchRecord>;
  todayPunch(p: { externalId: string }): Promise<TodayPunch>;
}
