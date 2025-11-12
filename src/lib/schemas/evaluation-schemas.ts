/**
 * Schema de tipos para o sistema de avaliações
 * Alinhado com especificações AN-TED-002-R0
 */

// Status do fluxo de avaliação
export type EvaluationStatus =
  | 'pending_response'        // Pendente de resposta (colaborador)
  | 'awaiting_manager'       // Aguardando gerente
  | 'returned_for_adjustment'// Devolvido para ajustes
  | 'under_review'          // Em revisão do colaborador
  | 'approved'              // Aprovado pelo gerente
  | 'rejected'              // Rejeitado
  | 'archived';             // Arquivado

// Tipos de respondentes
export type RespondentType =
  | 'collaborator'  // Colaborador (autoavaliação)
  | 'manager';      // Gerente/Avaliador

// Competências atualizadas conforme especificação
export interface Competencia {
  id: string;
  nome: string;
  categoria: 'leadership' | 'behavior' | 'technical' | 'interpersonal';
  descricao?: string;
}

// Perguntas do questionário (11-17)
export interface QuestionarioPergunta {
  id: number; // 11-17
  titulo: string;
  descricao: string;
  tipo: 'collaborator' | 'manager'; // Quem responde
  obrigatoria: boolean;
  apenas_lideres?: boolean; // Se true, pergunta só aparece para líderes
}

// Resposta detalhada de avaliação
export interface AvaliacaoResposta {
  id: string;
  avaliacao_id: string;
  pergunta_id: number; // 11-17
  competencia_id?: string;
  nota: number; // 1-5
  comentario?: string;
  respondente_tipo: RespondentType;
  created_at: string;
  updated_at?: string;
}

// Ciclo de avaliação
export interface AvaliacaoCiclo {
  id: string;
  ano: number;
  nome: string;
  status: 'draft' | 'active' | 'closed';
  data_abertura?: string;
  data_fechamento?: string;
  created_at: string;
  updated_at?: string;
}

// Configuração de avaliadores
export interface AvaliadorConfig {
  id: string;
  user_id: string;
  tipo: 'manager' | 'leader';
  ativo: boolean;
  created_at: string;
  updated_at?: string;
}

// Avaliação principal
export interface Avaliacao {
  id: string;
  ciclo_id: string;
  funcionario_id: string;
  avaliador_id: string;
  status: EvaluationStatus;
  periodo: string;
  data_inicio?: string;
  data_fim?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;

  // Campos calculados (não persistidos)
  media_geral?: number;
  media_por_competencia?: Record<string, number>;
  progresso?: number;

  // Join com informações do usuário
  funcionario_nome?: string;
  funcionario_cargo?: string;
  funcionario_departamento?: string;
  avaliador_nome?: string;
  avaliador_cargo?: string;
  ciclo_nome?: string;
}

// Dados para criação de avaliação
export interface CreateAvaliacaoData {
  ciclo_id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio?: string;
  data_fim?: string;
}

// Dados para resposta do questionário
export interface ResponderQuestionarioData {
  avaliacao_id: string;
  respostas: {
    pergunta_id: number;
    nota: number;
    comentario?: string;
  }[];
  respondente_tipo: RespondentType;
}

// Dados para decisão do gerente
export interface DecisaoGerenteData {
  avaliacao_id: string;
  acao: 'approve' | 'reject' | 'return';
  comentario_avaliador?: string; // Pergunta 15
  motivo_devolucao?: string;
}

// Filtros para listagem
export interface AvaliacaoFilters {
  status?: EvaluationStatus[];
  funcionario_id?: string;
  avaliador_id?: string;
  ciclo_id?: string;
  periodo?: string;
  data_inicio?: string;
  data_fim?: string;
}

// Métricas e relatórios
export interface AvaliacaoMetricas {
  total_avaliacoes: number;
  por_status: Record<EvaluationStatus, number>;
  por_competencia: Record<string, number>;
 taxa_conclusao: number;
  tempo_medio_conclusao: number;
}

// Item de notificação de avaliação
export interface AvaliacaoNotificacao {
  id: string;
  tipo: 'ciclo_abertura' | 'submissao' | 'aprovacao' | 'devolucao' | 'reenvio' | 'lembrete';
  titulo: string;
  mensagem: string;
  usuario_id: string;
  avaliacao_id?: string;
  dados?: Record<string, any>;
  lida: boolean;
  created_at: string;
}

// Resposta da API padrão
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Paginação
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

// Lista paginada
export interface PaginatedList<T> {
  items: T[];
  pagination: PaginationParams;
}

// Competências pré-definidas (conforme especificação)
export const COMPETENCIAS_PADRAO: Competencia[] = [
  // Liderança dividida em duas
  {
    id: 'lideranca-delegar',
    nome: 'Liderança - Delegar',
    categoria: 'leadership',
    descricao: 'Capacidade de delegar tarefas e responsabilidades de forma eficaz'
  },
  {
    id: 'lideranca-desenvolvimento',
    nome: 'Liderança - Desenvolvimento de Equipe',
    categoria: 'leadership',
    descricao: 'Capacidade de desenvolver e capacitar membros da equipe'
  },

  // Pontualidade e Comprometimento unificados
  {
    id: 'pontualidade-comprometimento',
    nome: 'Pontualidade e Comprometimento',
    categoria: 'behavior',
    descricao: 'Cumprimento de prazos e engajamento com as responsabilidades'
  },

  // Outras competências existentes
  {
    id: 'conhecimento-tecnico',
    nome: 'Conhecimento Técnico',
    categoria: 'technical',
    descricao: 'Domínio dos conhecimentos técnicos necessários para a função'
  },
  {
    id: 'resolucao-problemas',
    nome: 'Resolução de Problemas',
    categoria: 'technical',
    descricao: 'Capacidade de analisar e resolver problemas complexos'
  },
  {
    id: 'comunicacao',
    nome: 'Comunicação',
    categoria: 'interpersonal',
    descricao: 'Clareza e eficácia na comunicação verbal e escrita'
  },
  {
    id: 'inteligencia-emocional',
    nome: 'Inteligência Emocional',
    categoria: 'interpersonal',
    descricao: 'Capacidade de entender e gerenciar emoções próprias e alheias'
  }
];

// Perguntas do questionário (11-15)
export const QUESTIONARIO_PADRAO: QuestionarioPergunta[] = [
  {
    id: 11,
    titulo: 'Pontos Fortes',
    descricao: 'Descreva seus principais pontos fortes e competências que você considera mais desenvolvidas',
    tipo: 'collaborator',
    obrigatoria: true
  },
  {
    id: 12,
    titulo: 'Áreas de Melhoria',
    descricao: 'Identifique as áreas onde você acredita que precisa desenvolver mais',
    tipo: 'collaborator',
    obrigatoria: true
  },
  {
    id: 13,
    titulo: 'Objetivos Alcançados',
    descricao: 'Descreva os principais objetivos que você alcançou no período avaliado',
    tipo: 'collaborator',
    obrigatoria: true
  },
  {
    id: 14,
    titulo: 'Planos de Desenvolvimento',
    descricao: 'Quais são seus planos para desenvolvimento profissional no próximo período?',
    tipo: 'collaborator',
    obrigatoria: true
  },
  {
    id: 15,
    titulo: 'Comentário do Avaliador',
    descricao: 'Avaliação geral e feedback do gestor sobre o desempenho do colaborador',
    tipo: 'manager',
    obrigatoria: true
  },
  {
    id: 16,
    titulo: 'Liderança - Capacidade de Delegação',
    descricao: 'Avalie a capacidade de delegar tarefas e responsabilidades de forma eficaz, garantindo que a equipe esteja bem orientada e capacitada',
    tipo: 'manager',
    obrigatoria: true,
    apenas_lideres: true
  },
  {
    id: 17,
    titulo: 'Liderança - Desenvolvimento de Equipe',
    descricao: 'Avalie a capacidade de desenvolver, orientar e capacitar membros da equipe, promovendo crescimento profissional e engajamento',
    tipo: 'manager',
    obrigatoria: true,
    apenas_lideres: true
  }
];

// Esala de avaliação fixa
export const ESCALA_AVALIACAO = [
  { valor: 1, descricao: 'Frequentemente não alcançou a expectativa' },
  { valor: 2, descricao: 'Não alcançou a expectativa' },
  { valor: 3, descricao: 'Alcançou a expectativa' },
  { valor: 4, descricao: 'Frequentemente excedeu a expectativa' },
  { valor: 5, descricao: 'Superou consistentemente a expectativa' }
];

// Validações
export const VALIDACOES = {
  NOTA_MINIMA: 1,
  NOTA_MAXIMA: 5,
  COMENTARIO_MAX_LENGTH: 2000,
  PERGUNTAS_OBRIGATORIAS: [11, 12, 13, 14, 15], // Obrigatórias para todos
  PERGUNTAS_OBRIGATORIAS_LIDERES: [16, 17] // Obrigatórias apenas para líderes
};