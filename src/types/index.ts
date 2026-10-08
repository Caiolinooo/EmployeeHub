// src/types/index.ts
// Tipos centralizados do projeto

// Re-export tipos existentes
// Re-export tipos existentes
export type { User } from '../models/User';

export interface Sector {
  id: string;
  name: string;
  description: string | null;
  allowed_modules?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SectorModule {
  id: string;
  sector_id: string;
  module_id: string;
  created_at: string;
}

// Tipos de Avaliação
export interface Evaluation {
  id: string;
  funcionario_id: string;
  avaliador_id: string | null;
  periodo_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  respostas: Record<string, any>;
  nota_final: number | null;
  comentario_avaliador: string | null;
  comentario_gerente: string | null;
  comentario_final_funcionario: string | null;
  observacoes: string | null;
  data_aprovacao: string | null;
  created_at: string;
  updated_at: string;
  dados_colaborador?: any;
  dados_gerente?: any;
  isAuditViewer?: boolean;
  // Relações (quando usando select com joins)
  funcionario?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
    cargo?: string;
  };
  avaliador?: {
    id: string;
    name: string;
    email?: string;
  };
  periodo?: EvaluationPeriod | string; // Pode ser objeto ou string
}

export interface EvaluationPeriod {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  data_limite_autoavaliacao: string | null;
  data_limite_aprovacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationCriterion {
  id: string;
  nome: string;
  descricao: string | null;
  peso: number;
  categoria: string | null;
  ativo: boolean;
  ordem: number | null;
  created_at: string;
  updated_at: string;
}
