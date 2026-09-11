/**
 * Status and labels for ASO scheduling. Client-safe (no Supabase).
 */

export const ASO_AGENDAMENTO_STATUS = [
  'sugerido',
  'solicitado',
  'aprovado',
  'reprovado',
  'cancelado',
  'marcado',
] as const;

export type AsoAgendamentoStatus = (typeof ASO_AGENDAMENTO_STATUS)[number];

export const ASO_AGENDAMENTO_STATUS_ABERTOS: readonly AsoAgendamentoStatus[] = [
  'sugerido',
  'solicitado',
];

export const ASO_ANTECEDENCIA_DIAS_DEFAULT = 60;
export const ASO_MIN_LEAD_DIAS_DEFAULT = 3;
export const ASO_MAX_SUGESTOES_DEFAULT = 5;

export interface AsoAgendamentoConfig {
  antecedencia_dias: number;
  min_lead_dias: number;
  max_sugestoes: number;
  emails_logistica: string[];
  emails_cc: string[];
  gerar_sugestoes_automatico: boolean;
}

export const DEFAULT_ASO_AGENDAMENTO_CONFIG: AsoAgendamentoConfig = {
  antecedencia_dias: ASO_ANTECEDENCIA_DIAS_DEFAULT,
  min_lead_dias: ASO_MIN_LEAD_DIAS_DEFAULT,
  max_sugestoes: ASO_MAX_SUGESTOES_DEFAULT,
  emails_logistica: [],
  emails_cc: [],
  gerar_sugestoes_automatico: true,
};

export function isAsoAgendamentoStatus(value: string): value is AsoAgendamentoStatus {
  return (ASO_AGENDAMENTO_STATUS as readonly string[]).includes(value);
}

export function labelAsoAgendamentoStatus(status: AsoAgendamentoStatus): string {
  switch (status) {
    case 'sugerido':
      return 'Sugerido';
    case 'solicitado':
      return 'Aguardando logística';
    case 'aprovado':
      return 'Aprovado';
    case 'reprovado':
      return 'Reprovado';
    case 'cancelado':
      return 'Cancelado';
    case 'marcado':
      return 'Marcado';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export interface AsoSugestaoData {
  data: string;
  codigo_escala: string;
  classe: AsoDiaClasse;
  score: number;
  motivo: string;
  conflito_on: boolean;
  bloqueado: boolean;
}

export const ASO_DIA_CLASSES = [
  'stb',
  'livre',
  'fi',
  'offc',
  'tre',
  'on',
  'on_previsto',
  'dba',
  'afast',
  'outro',
] as const;

export type AsoDiaClasse = (typeof ASO_DIA_CLASSES)[number];

export interface AsoAgendamentoAssinatura {
  papel: 'dp' | 'logistica';
  acao: 'solicitar' | 'aprovar' | 'reprovar' | 'cancelar';
  userId: string;
  email: string;
  nome: string;
  cpf: string;
  cargo: string;
  assinado_em: string;
  dataHora: string;
  ip: string;
  assinaturaUrl: string;
  assinaturaHash: string;
}
