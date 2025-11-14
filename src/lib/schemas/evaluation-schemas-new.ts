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

// Perguntas do questionário organizadas por categoria
export interface QuestionarioPergunta {
  id: string;
  pergunta: string;
  titulo: string;
  descricao: string;
  tipo: 'collaborator' | 'manager';
  obrigatoria: boolean;
  apenas_lideres?: boolean;
  categoria: string;
}

// Perguntas organizadas por categoria
export const QUESTIONARIO_PADRAO: QuestionarioPergunta[] = [
  // Autoavaliação - Apenas texto para funcionários
  {
    id: 'pontos-fortes',
    pergunta: 'Pontos Fortes',
    titulo: 'Pontos Fortes',
    descricao: 'Descreva seus principais pontos fortes e competências que você considera mais desenvolvidas',
    tipo: 'collaborator',
    obrigatoria: true,
    categoria: 'Autoavaliação'
  },
  {
    id: 'areas-melhoria',
    pergunta: 'Áreas de Melhoria',
    titulo: 'Áreas de Melhoria',
    descricao: 'Identifique as áreas onde você acredita que precisa desenvolver mais',
    tipo: 'collaborator',
    obrigatoria: true,
    categoria: 'Autoavaliação'
  },
  {
    id: 'objetivos-alcancados',
    pergunta: 'Objetivos Alcançados',
    titulo: 'Objetivos Alcançados',
    descricao: 'Descreva os principais objetivos que você alcançou no período avaliado',
    tipo: 'collaborator',
    obrigatoria: true,
    categoria: 'Autoavaliação'
  },
  {
    id: 'planos-desenvolvimento',
    pergunta: 'Planos de Desenvolvimento',
    titulo: 'Planos de Desenvolvimento',
    descricao: 'Quais são seus planos para desenvolvimento profissional no próximo período?',
    tipo: 'collaborator',
    obrigatoria: true,
    categoria: 'Autoavaliação'
  },
  
  // Competências Comportamentais - Avaliação do gerente
  {
    id: 'pontualidade-comprometimento',
    pergunta: 'Pontualidade e Comprometimento',
    titulo: 'Pontualidade e Comprometimento',
    descricao: 'Cumpre prazos, horários e demonstra engajamento com as metas e atividades da equipe e empresa',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Competências Comportamentais'
  },
  {
    id: 'autonomia-proatividade',
    pergunta: 'Autonomia e Proatividade',
    titulo: 'Autonomia e Proatividade',
    descricao: 'Realiza as tarefas diárias sem a necessidade de intervenção da liderança',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Competências Comportamentais'
  },
  
  // Habilidades Interpessoais
  {
    id: 'comunicacao-colaboracao',
    pergunta: 'Comunicação, Colaboração e Relacionamento',
    titulo: 'Comunicação, Colaboração e Relacionamento',
    descricao: 'Possui uma comunicação clara. Pensa no coletivo e ajuda no aprendizado e conhecimento da equipe',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Habilidades Interpessoais'
  },
  {
    id: 'inteligencia-emocional',
    pergunta: 'Inteligência Emocional e Solução de conflitos',
    titulo: 'Inteligência Emocional',
    descricao: 'Lida bem com situações de conflito, demonstrando equilíbrio quando há adversidades',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Habilidades Interpessoais'
  },
  
  // Competências Técnicas
  {
    id: 'conhecimento-atividades',
    pergunta: 'Conhecimento das atividades',
    titulo: 'Conhecimento das atividades',
    descricao: 'Demonstra domínio das atividades que desempenha e compartilha boas ideias e conhecimentos técnicos',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Competências Técnicas'
  },
  {
    id: 'resolucao-problemas',
    pergunta: 'Resolução de problemas',
    titulo: 'Resolução de problemas',
    descricao: 'Resolve problemas relacionados à sua rotina de trabalho. Utiliza a criatividade para encontrar soluções',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Competências Técnicas'
  },
  
  // Liderança - Apenas para líderes
  {
    id: 'lideranca-delegar',
    pergunta: 'Liderança - Delegar',
    titulo: 'Capacidade de Delegação',
    descricao: 'Capacidade de delegar tarefas e responsabilidades de forma eficaz, desenvolvendo a equipe',
    tipo: 'manager',
    obrigatoria: true,
    apenas_lideres: true,
    categoria: 'Liderança'
  },
  {
    id: 'lideranca-desenvolvimento-equipe',
    pergunta: 'Liderança - Desenvolvimento de Equipe',
    titulo: 'Desenvolvimento de Equipe',
    descricao: 'Capacidade de desenvolver, orientar e capacitar membros da equipe para alcançar melhores resultados',
    tipo: 'manager',
    obrigatoria: true,
    apenas_lideres: true,
    categoria: 'Liderança'
  },
  
  // Avaliação Final do Gerente
  {
    id: 'comentario-avaliador',
    pergunta: 'Comentário do Avaliador',
    titulo: 'Avaliação Geral',
    descricao: 'Comentário detalhado do gerente sobre o desempenho geral do colaborador no período',
    tipo: 'manager',
    obrigatoria: true,
    categoria: 'Avaliação do Gerente'
  }
];

// Escala de avaliação fixa
export const ESCALA_AVALIACAO = [
  { valor: 1, descricao: 'Frequentemente não alcançou a expectativa' },
  { valor: 2, descricao: 'Não alcançou a expectativa' },
  { valor: 3, descricao: 'Alcançou a expectativa' },
  { valor: 4, descricao: 'Frequentemente excedeu a expectativa' },
  { valor: 5, descricao: 'Superou consistentemente a expectativa' }
];