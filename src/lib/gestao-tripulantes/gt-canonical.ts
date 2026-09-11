/**
 * Canonical local source of truth for Gestão de Tripulantes and every future
 * module that needs crew / ASO / training / scale data.
 *
 * NEVER call mio.app.br or scrape PoliWeb from feature modules.
 * Ingest only via admin/cron pull (`runMioPull` / `POST .../mio/sync` / `POST .../poliweb`).
 */

export const GT_CANONICAL_ORIGEM = ['mio', 'poliweb', 'upload', 'manual', 'ocr', 'local', 'importado'] as const;
export type GTCanonicalOrigem = (typeof GT_CANONICAL_ORIGEM)[number];

export const GT_CANONICAL_TABLES = {
  colaboradores: {
    table: 'gt_colaboradores',
    contains: 'All crew (ativo + inativo/desligado/demitido). Join key: id, cpf (digits), mio_id.',
    origem: ['mio', 'manual'] as const,
    join: 'cpf (normalize digits) or id',
  },
  documentos: {
    table: 'gt_documentos',
    contains:
      'All document types (aso, treinamento, passaporte, …). arquivo_url must be OUR bucket when bytes exist; arquivo_ausente=true when MIO had no downloadable file.',
    origem: ['mio', 'poliweb', 'upload', 'manual', 'ocr'] as const,
    join: 'colaborador_id; origem_ref for MIO idempotency',
  },
  aso: {
    table: 'gt_documentos_aso',
    contains:
      'ASO child rows. Unified: MIO training-classified-as-ASO + MIO ASO probe hits + PoliWeb ingest + local upload. Query this, never PoliWeb/MIO.',
    origem: 'via gt_documentos.origem',
    join: 'colaborador_id + documento_id',
  },
  treinamentos: {
    table: 'gt_documentos_treinamento',
    contains: 'Course metadata for tipo_documento=treinamento. Certificates in gt_documentos.arquivo_url.',
    origem: 'via gt_documentos.origem',
    join: 'colaborador_id + documento_id',
  },
  embarques: {
    table: 'gt_historico_embarques',
    contains:
      'Full embark/scale history including FI/DBA/STB/OFF-C extras and previsto (ON*, not POB) from LGP. Man Schedule reads this, not mio_cache.',
    origem: ['mio', 'local', 'importado'] as const,
    join: 'colaborador_id; mio_embarque_id for MIO idempotency',
  },
  tipos_escala: {
    table: 'gt_tipos_evento_escala',
    contains: 'UI labels/colors for rotation codes (normal/previsto/fi/dba/stb/offc + custom).',
    origem: 'local config',
    join: 'codigo = gt_historico_embarques.tipo (normalized)',
  },
  afastamentos: {
    table: 'gt_afastamentos',
    contains: 'Leave / afastamento rows pulled from GET /sms-afastamento-get (ingest). Runtime reads this table only.',
    origem: ['mio', 'manual'] as const,
    join: 'colaborador_id',
  },
  acidentes: {
    table: 'gt_acidentes',
    contains: 'CAT / workplace accidents (e-Social S-2210). Local + importado; MIO has no CAT list GET in the official insomnia doc.',
    origem: ['manual', 'mio', 'importado'] as const,
    join: 'colaborador_id',
  },
  entidades_mio: {
    table: 'gt_mio_entidades',
    contains:
      'Leftover readable MIO entities without a dedicated table (ferias, beneficio, dependente, sispat, timesheet, rtpe_turma, aso_probe).',
    origem: ['mio'] as const,
    join: 'cpf / colaborador_id / tipo',
  },
  aso_agendamentos: {
    table: 'gt_aso_agendamentos',
    contains:
      'DP→logística ASO scheduling (sugerido/solicitado/marcado). Dates from gt_historico_embarques via embarque-status (STB preferred, ON avoided). Never MIO.',
    origem: ['local'] as const,
    join: 'colaborador_id + documento_aso_id',
  },
  aso_agendamentos_log: {
    table: 'gt_aso_agendamentos_log',
    contains: 'Audit trail of ASO scheduling lifecycle (request, approve, reject, cancel).',
    origem: ['local'] as const,
    join: 'agendamento_id',
  },
  anexo_misses: {
    table: 'gt_mio_anexo_misses',
    contains: 'Retry queue: MIO id + reason when bytes could not be copied. resolved_at set after a successful re-pull.',
    origem: ['mio'] as const,
    join: 'origem_ref, colaborador_id',
  },
} as const;

/** Feature modules MUST NOT import mioClient or poliweb-scraper. */
export const GT_FORBIDDEN_RUNTIME_SOURCES = [
  'mioClient / mio.app.br (except admin sync/test/auditoria + cache atualizar ingest)',
  'PoliWeb scrape on page load (ingest is POST /poliweb or cron only)',
  'mio_cache JSON blobs as the schedule source of truth (legacy; pull still refreshes cache)',
] as const;

export function assertFeatureReadsGtOnly(_moduleName: string): void {
  // Documentation hook — runtime guard lives in mio/pull-context.ts + assert-mio-local-first.
}
