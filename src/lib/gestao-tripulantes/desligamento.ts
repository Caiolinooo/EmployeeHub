/**
 * Regras de processo de desligamento (não é motor trabalhista certificado).
 * Mapeia tipo_rescisao → mtvDeslig (e-Social Tabela 19 / S-2299) e rubricas
 * típicas da rescisão. Cálculo de valores fica com a folha.
 */

export const TIPOS_RESCISAO = [
  'sem_justa_causa',
  'pedido_demissao',
  'justa_causa',
  'acordo_mutuo',
  'termino_contrato',
  'rescisao_indireta',
] as const;

export type TipoRescisao = (typeof TIPOS_RESCISAO)[number];

export const AVISO_PREVIO_TIPOS = [
  'indenizado',
  'trabalhado',
  'dispensado',
  'nao_aplicavel',
] as const;

export type AvisoPrevioTipo = (typeof AVISO_PREVIO_TIPOS)[number];

export const STATUS_DESLIGAMENTO = [
  'iniciado',
  'calculado',
  'aprovado',
  'pago',
  'cancelado',
] as const;

export type StatusDesligamento = (typeof STATUS_DESLIGAMENTO)[number];

/** e-Social Tabela 19 — códigos usados neste fluxo. */
export const MTV_DESLIG_POR_TIPO: Record<TipoRescisao, string> = {
  sem_justa_causa: '02',
  pedido_demissao: '07',
  justa_causa: '01',
  acordo_mutuo: '25',
  termino_contrato: '06',
  rescisao_indireta: '02',
};

export const LABEL_TIPO_RESCISAO: Record<TipoRescisao, string> = {
  sem_justa_causa: 'Sem justa causa (empregador)',
  pedido_demissao: 'Pedido de demissão (empregado)',
  justa_causa: 'Justa causa',
  acordo_mutuo: 'Acordo mútuo (art. 484-A CLT)',
  termino_contrato: 'Término de contrato / experiência',
  rescisao_indireta: 'Rescisão indireta (art. 483 CLT)',
};

export const LABEL_AVISO_PREVIO: Record<AvisoPrevioTipo, string> = {
  indenizado: 'Indenizado',
  trabalhado: 'Trabalhado',
  dispensado: 'Dispensado',
  nao_aplicavel: 'Não aplicável',
};

export const PAYROLL_CODE_RESCISAO = {
  AVISO_PREVIO: '301',
  MULTA_FGTS_40: '302',
  SALDO_SALARIO: '303',
  DECIMO_TERCEIRO_PROP: '304',
  FERIAS_PROP: '305',
  FERIAS_VENCIDAS: '306',
  MULTA_FGTS_20: '307',
} as const;

export interface VerbaRescisaoPrevista {
  code: string;
  name: string;
  observation: string;
}

const VERBA_META: Record<string, { name: string }> = {
  [PAYROLL_CODE_RESCISAO.SALDO_SALARIO]: { name: 'Saldo de Salário' },
  [PAYROLL_CODE_RESCISAO.DECIMO_TERCEIRO_PROP]: { name: '13º Salário Proporcional' },
  [PAYROLL_CODE_RESCISAO.FERIAS_PROP]: { name: 'Férias Proporcionais + 1/3' },
  [PAYROLL_CODE_RESCISAO.FERIAS_VENCIDAS]: { name: 'Férias Vencidas + 1/3' },
  [PAYROLL_CODE_RESCISAO.AVISO_PREVIO]: { name: 'Aviso Prévio' },
  [PAYROLL_CODE_RESCISAO.MULTA_FGTS_40]: { name: 'Multa 40% FGTS' },
  [PAYROLL_CODE_RESCISAO.MULTA_FGTS_20]: { name: 'Multa 20% FGTS' },
};

export function isTipoRescisao(value: unknown): value is TipoRescisao {
  return typeof value === 'string' && (TIPOS_RESCISAO as readonly string[]).includes(value);
}

export function isAvisoPrevioTipo(value: unknown): value is AvisoPrevioTipo {
  return typeof value === 'string' && (AVISO_PREVIO_TIPOS as readonly string[]).includes(value);
}

export function isStatusDesligamento(value: unknown): value is StatusDesligamento {
  return typeof value === 'string' && (STATUS_DESLIGAMENTO as readonly string[]).includes(value);
}

export function isMtvDesligValido(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}$/.test(value.trim());
}

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function mtvDesligParaTipo(tipo: TipoRescisao, override?: string | null): string {
  if (override && isMtvDesligValido(override)) return override.trim();
  return MTV_DESLIG_POR_TIPO[tipo];
}

export function avisoDefaultParaTipo(tipo: TipoRescisao): AvisoPrevioTipo {
  switch (tipo) {
    case 'sem_justa_causa':
    case 'rescisao_indireta':
    case 'acordo_mutuo':
      return 'indenizado';
    case 'pedido_demissao':
      return 'trabalhado';
    case 'justa_causa':
    case 'termino_contrato':
      return 'nao_aplicavel';
    default: {
      const _never: never = tipo;
      return _never;
    }
  }
}

function parseCivilDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatCivilDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Lei 13.467/2017: 10 dias corridos do término do contrato. */
export function prazoPagamentoRescisao(dataDesligamento: string): string {
  const date = parseCivilDate(dataDesligamento);
  date.setDate(date.getDate() + 10);
  return formatCivilDate(date);
}

/** Lei 12.506/2011: 30 dias + 3 por ano, máximo 90. */
export function sugerirAvisoPrevioDias(
  dataAdmissao: string | null | undefined,
  dataDesligamento: string,
): number {
  if (!dataAdmissao || !isCivilDate(dataAdmissao) || !isCivilDate(dataDesligamento)) {
    return 30;
  }
  const admissao = parseCivilDate(dataAdmissao);
  const deslig = parseCivilDate(dataDesligamento);
  let years = deslig.getFullYear() - admissao.getFullYear();
  const aniversario = new Date(deslig.getFullYear(), admissao.getMonth(), admissao.getDate());
  if (deslig < aniversario) years -= 1;
  if (years < 0) years = 0;
  return Math.min(90, 30 + 3 * years);
}

function verba(code: string, observation: string): VerbaRescisaoPrevista {
  return {
    code,
    name: VERBA_META[code]?.name || code,
    observation,
  };
}

/**
 * Itens de folha típicos por tipo de rescisão.
 * Valores ficam zerados para o DP calcular — só a lista de rubricas.
 */
export function verbasParaRescisao(
  tipo: TipoRescisao,
  aviso: AvisoPrevioTipo,
): VerbaRescisaoPrevista[] {
  const saldo = verba(
    PAYROLL_CODE_RESCISAO.SALDO_SALARIO,
    'Dias trabalhados no mês da rescisão',
  );
  const decimo = verba(
    PAYROLL_CODE_RESCISAO.DECIMO_TERCEIRO_PROP,
    '12 avos por mês trabalhado no ano (fração ≥ 15 dias)',
  );
  const feriasProp = verba(
    PAYROLL_CODE_RESCISAO.FERIAS_PROP,
    'Proporcionais do período aquisitivo + 1/3 constitucional',
  );
  const feriasVencidas = verba(
    PAYROLL_CODE_RESCISAO.FERIAS_VENCIDAS,
    'Incluir só se houver período vencido; zerar na folha se não houver',
  );
  const avisoIndenizado = verba(
    PAYROLL_CODE_RESCISAO.AVISO_PREVIO,
    aviso === 'indenizado'
      ? tipo === 'acordo_mutuo'
        ? 'Art. 484-A: aviso indenizado pela metade'
        : 'Aviso prévio indenizado (30 + 3 dias/ano, máx. 90)'
      : 'Aviso prévio indenizado',
  );
  const multa40 = verba(
    PAYROLL_CODE_RESCISAO.MULTA_FGTS_40,
    'Multa de 40% sobre o saldo do FGTS — saque + seguro-desemprego',
  );
  const multa20 = verba(
    PAYROLL_CODE_RESCISAO.MULTA_FGTS_20,
    'Art. 484-A: multa de 20% do FGTS; saque de 80%; sem seguro-desemprego',
  );

  switch (tipo) {
    case 'sem_justa_causa':
    case 'rescisao_indireta':
      return [
        saldo,
        decimo,
        feriasProp,
        feriasVencidas,
        ...(aviso === 'indenizado' ? [avisoIndenizado] : []),
        multa40,
      ];
    case 'pedido_demissao':
      return [saldo, decimo, feriasProp, feriasVencidas];
    case 'justa_causa':
      return [saldo, feriasVencidas];
    case 'acordo_mutuo':
      return [
        saldo,
        decimo,
        feriasProp,
        feriasVencidas,
        ...(aviso === 'indenizado' ? [avisoIndenizado] : []),
        multa20,
      ];
    case 'termino_contrato':
      return [saldo, decimo, feriasProp, feriasVencidas];
    default: {
      const _never: never = tipo;
      return _never;
    }
  }
}

export function seguroDesempregoElegivel(tipo: TipoRescisao): boolean {
  switch (tipo) {
    case 'sem_justa_causa':
    case 'rescisao_indireta':
    case 'termino_contrato':
      return true;
    case 'pedido_demissao':
    case 'justa_causa':
    case 'acordo_mutuo':
      return false;
    default: {
      const _never: never = tipo;
      return _never;
    }
  }
}
