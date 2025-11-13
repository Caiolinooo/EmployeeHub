/**
 * Critérios padrão para avaliação de desempenho
 * Estes critérios são usados quando não há critérios personalizados definidos no banco de dados
 */

export interface CriterioAvaliacao {
  id: string; // UUID do banco de dados
  codigo: string; // Identificador legível (ex: 'q11-pontos-fortes')
  nome: string;
  descricao: string;
  categoria: string;
  pontuacao_maxima: number;
  ativo?: boolean;
  apenas_lideres?: boolean;
  tipo?: 'colaborador' | 'gerente'; // Define quem responde a este critério
}

// Função para gerar UUIDs v4 compatíveis com o formato do banco de dados
function generateUUID(): string {
  // Implementação simples de UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Critérios padrão para avaliação de desempenho - NOVO MODELO SEM PESOS
// Alinhados com a planilha AN-TED-002-R0 - Avaliação de Desempenho
// Atualizado para refletir as novas competências e fluxo
export const criteriosPadrao: CriterioAvaliacao[] = [
  // Questão 11 - PONTOS FORTES (resposta do colaborador)
  {
    id: generateUUID(),
    codigo: 'q11-pontos-fortes',
    nome: 'Pontos Fortes',
    descricao: 'Questão 11: Pontos fortes - Descrição feita pelo colaborador',
    categoria: 'Autoavaliação',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'colaborador'
  },

  // Questão 12 - ÁREAS DE MELHORIA (resposta do colaborador)
  {
    id: generateUUID(),
    codigo: 'q12-areas-melhoria',
    nome: 'Áreas de Melhoria',
    descricao: 'Questão 12: Áreas de melhoria - Descrição feita pelo colaborador',
    categoria: 'Autoavaliação',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'colaborador'
  },

  // Questão 13 - OBJETIVOS ALCANÇADOS (resposta do colaborador)
  {
    id: generateUUID(),
    codigo: 'q13-objetivos-alcancados',
    nome: 'Objetivos Alcançados',
    descricao: 'Questão 13: Objetivos alcançados - Descrição feita pelo colaborador',
    categoria: 'Autoavaliação',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'colaborador'
  },

  // Questão 14 - PLANOS DE DESENVOLVIMENTO (resposta do colaborador)
  {
    id: generateUUID(),
    codigo: 'q14-planos-desenvolvimento',
    nome: 'Planos de Desenvolvimento',
    descricao: 'Questão 14: Planos de desenvolvimento - Descrição feita pelo colaborador',
    categoria: 'Autoavaliação',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'colaborador'
  },

  // Competência unificada: PONTUALIDADE E COMPROMETIMENTO
  {
    id: generateUUID(),
    codigo: 'pontualidade-comprometimento',
    nome: 'Pontualidade e Comprometimento',
    descricao: 'Cumpre prazos, horários e demonstra engajamento com as metas e atividades da equipe e empresa.',
    categoria: 'Comportamento',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },

  // Competência subdividida: LIDERANÇA - DELEGAR
  {
    id: generateUUID(),
    codigo: 'lideranca-delegar',
    nome: 'Liderança - Delegar',
    descricao: 'Capacidade de delegar tarefas e responsabilidades de forma eficaz, desenvolvendo a equipe.',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true,
    tipo: 'gerente'
  },

  // Competência subdividida: LIDERANÇA - DESENVOLVIMENTO DE EQUIPE
  {
    id: generateUUID(),
    codigo: 'lideranca-desenvolvimento-equipe',
    nome: 'Liderança - Desenvolvimento de Equipe',
    descricao: 'Capacidade de desenvolver, orientar e capacitar membros da equipe para alcançar melhores resultados.',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true,
    tipo: 'gerente'
  },

  // Questão 15 - COMENTÁRIO DO AVALIADOR (resposta do gerente)
  {
    id: generateUUID(),
    codigo: 'q15-comentario-avaliador',
    nome: 'Comentário do Avaliador',
    descricao: 'Questão 15: Comentário detalhado do gerente sobre o desempenho do colaborador',
    categoria: 'Avaliação do Gerente',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },

  // Questão 16 - LIDERANÇA: CAPACIDADE DE DELEGAÇÃO (apenas para líderes)
  {
    id: generateUUID(),
    codigo: 'q16-lideranca-delegar',
    nome: 'Liderança - Capacidade de Delegação',
    descricao: 'Questão 16: Avalie a capacidade de delegar tarefas e responsabilidades de forma eficaz, desenvolvendo a equipe',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true,
    tipo: 'gerente'
  },

  // Questão 17 - LIDERANÇA: DESENVOLVIMENTO DE EQUIPE (apenas para líderes)
  {
    id: generateUUID(),
    codigo: 'q17-lideranca-desenvolvimento',
    nome: 'Liderança - Desenvolvimento de Equipe',
    descricao: 'Questão 17: Avalie a capacidade de desenvolver, orientar e capacitar membros da equipe para alcançar melhores resultados',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true,
    tipo: 'gerente'
  },
  {
    id: '7c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
    codigo: 'autonomia-proatividade',
    nome: 'Autonomia e Proatividade',
    descricao: 'Realiza as tarefas diárias sem a necessidade de intervenção da liderança.',
    categoria: 'Comportamento',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  {
    id: '6d4e5f6a-7b8c-4d9e-0f1a-2b3c4d5e6f7a',
    codigo: 'comunicacao-colaboracao',
    nome: 'Comunicação, Colaboração e Relacionamento',
    descricao: 'Possui uma comunicação clara. Pensa no coletivo e ajuda no aprendizado e conhecimento da equipe. Demonstra bom relacionamento com os colegas.',
    categoria: 'Habilidades Interpessoais',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  {
    id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    codigo: 'conhecimento-atividades',
    nome: 'Conhecimento das atividades',
    descricao: 'Demonstra domínio das atividades que desempenha e compartilha boas ideias e conhecimentos técnicos com o time.',
    categoria: 'Competências Técnicas',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  {
    id: '4f5a6b7c-8d9e-4f0a-1b2c-3d4e5f6a7b8c',
    codigo: 'resolucao-problemas',
    nome: 'Resolução de problemas',
    descricao: 'Resolve problemas relacionados à sua rotina de trabalho. Utiliza a criatividade para encontrar soluções. Quando necessário, propõe soluções para a tomada de decisão da liderança.',
    categoria: 'Competências Técnicas',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  {
    id: '3a4b5c6d-7e8f-4a9b-0c1d-2e3f4a5b6c7d',
    codigo: 'inteligencia-emocional',
    nome: 'Inteligência Emocional e Solução de conflitos',
    descricao: 'Lida bem com situações de conflito, demonstrando equilíbrio quando há adversidades.',
    categoria: 'Habilidades Interpessoais',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    codigo: 'inovacao',
    nome: 'Inovação',
    descricao: 'É capaz de inovar em suas estratégias e propõe ideias que irão agregar valores para o desenvolvimento das atividades e melhorias dos resultados da equipe e da empresa.',
    categoria: 'Comportamento',
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false,
    tipo: 'gerente'
  },
  // Critérios específicos para líderes (Gerentes e Líderes) - LEGADO
  // Mantidos para compatibilidade, mas as novas perguntas 16-17 são as oficiais
  {
    id: '0d1e2f3a-4b5c-4d6e-7f8a-9b0c1d2e3f4a',
    codigo: 'lideranca-delegacao-legacy',
    nome: 'Liderança - Delegação',
    descricao: 'Sabe delegar atividades, definindo e acompanhando prazos para execução.',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: false, // Desativado - usar q16-lideranca-delegar
    apenas_lideres: true,
    tipo: 'gerente'
  },
  {
    id: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    codigo: 'lideranca-feedback-legacy',
    nome: 'Liderança - Feedback e Desenvolvimento de equipe',
    descricao: 'Proporciona feedback constante para seus liderados, identificando pontos de melhorias e apresentando ferramentas e estratégias de atuação.',
    categoria: 'Liderança',
    pontuacao_maxima: 5,
    ativo: false, // Desativado - usar q17-lideranca-desenvolvimento
    apenas_lideres: true,
    tipo: 'gerente'
  }
];

// Função para obter critérios por categoria
export function getCriteriosPorCategoria(categoria: string): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio =>
    criterio.categoria.toLowerCase() === categoria.toLowerCase() && criterio.ativo
  );
}

// Função para obter todas as categorias disponíveis
export function getCategorias(): string[] {
  const categorias = new Set<string>();
  criteriosPadrao.forEach(criterio => {
    if (criterio.ativo) {
      categorias.add(criterio.categoria);
    }
  });
  return Array.from(categorias);
}

// Função para obter um critério pelo ID
export function getCriterioPorId(id: string): CriterioAvaliacao | undefined {
  return criteriosPadrao.find(criterio => criterio.id === id && criterio.ativo);
}

// Função para obter todos os critérios ativos
export function getTodosCriterios(): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio => criterio.ativo);
}

// Função para obter critérios baseado no tipo de usuário (líder ou não)
export function getCriteriosPorTipoUsuario(isLider: boolean): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio => {
    if (!criterio.ativo) return false;

    // Se o critério é apenas para líderes, só retorna se o usuário for líder
    if (criterio.apenas_lideres && !isLider) return false;

    return true;
  });
}

// NOVAS FUNÇÕES PARA CÁLCULO SEM PESOS

/**
 * Interface para resultado de avaliação calculado sem pesos
 */
export interface ResultadoAvaliacao {
  mediaGeral: number;
  mediasPorCategoria: Record<string, number>;
  mediasPorCompetencia: Record<string, number>;
  totalAvaliacoes: number;
  questoesRespondidas: number;
  detalhes: {
    criterio: CriterioAvaliacao;
    nota: number;
  }[];
}

/**
 * Calcula média simples sem pesos para as avaliações
 * @param notas Dicionário com ID do critério e nota (1-5)
 * @param criterios Lista de critérios para considerar
 * @returns Resultado com médias calculadas
 */
export function calcularMediaSimples(
  notas: Record<string, number>,
  criterios: CriterioAvaliacao[] = criteriosPadrao
): ResultadoAvaliacao {
  // Filtrar apenas critérios ativos e que possuem notas
  const avaliacoesValidas = criterios
    .filter(criterio => criterio.ativo && notas[criterio.id] !== undefined && notas[criterio.id] > 0)
    .map(criterio => ({
      criterio,
      nota: notas[criterio.id]
    }));

  const totalAvaliacoes = avaliacoesValidas.length;

  if (totalAvaliacoes === 0) {
    return {
      mediaGeral: 0,
      mediasPorCategoria: {},
      mediasPorCompetencia: {},
      totalAvaliacoes: 0,
      questoesRespondidas: 0,
      detalhes: []
    };
  }

  // Calcular média geral (simples)
  const somaNotas = avaliacoesValidas.reduce((acc, { nota }) => acc + nota, 0);
  const mediaGeral = Number((somaNotas / totalAvaliacoes).toFixed(1));

  // Calcular médias por categoria
  const mediasPorCategoria: Record<string, number> = {};
  const agrupadoPorCategoria = avaliacoesValidas.reduce((acc, { criterio, nota }) => {
    if (!acc[criterio.categoria]) {
      acc[criterio.categoria] = [];
    }
    acc[criterio.categoria].push(nota);
    return acc;
  }, {} as Record<string, number[]>);

  Object.entries(agrupadoPorCategoria).forEach(([categoria, notas]) => {
    const soma = notas.reduce((acc, nota) => acc + nota, 0);
    mediasPorCategoria[categoria] = Number((soma / notas.length).toFixed(1));
  });

  // Calcular médias por competência específica (usando os nomes dos critérios)
  const mediasPorCompetencia: Record<string, number> = {};
  avaliacoesValidas.forEach(({ criterio, nota }) => {
    if (!mediasPorCompetencia[criterio.nome]) {
      mediasPorCompetencia[criterio.nome] = [];
    }
    // Para competências que podem ter múltiplas avaliações (raro neste modelo)
    if (Array.isArray(mediasPorCompetencia[criterio.nome])) {
      mediasPorCompetencia[criterio.nome].push(nota);
    }
  });

  // Calcular médias das competências
  Object.entries(mediasPorCompetencia).forEach(([competencia, notas]) => {
    if (Array.isArray(notas)) {
      const soma = notas.reduce((acc, nota) => acc + nota, 0);
      mediasPorCompetencia[competencia] = Number((soma / notas.length).toFixed(1));
    }
  });

  return {
    mediaGeral,
    mediasPorCategoria,
    mediasPorCompetencia,
    totalAvaliacoes: criterios.filter(c => c.ativo).length,
    questoesRespondidas: totalAvaliacoes,
    detalhes: avaliacoesValidas
  };
}

/**
 * Valida se uma avaliação está completa para envio
 * @param notas Dicionário com ID do critério e nota
 * @param tipoUsuario 'colaborador' | 'gerente'
 * @returns Objeto com validação e mensagens
 */
export function validarAvaliacaoCompleta(
  notas: Record<string, number>,
  tipoUsuario: 'colaborador' | 'gerente'
): { valida: boolean; mensagens: string[] } {
  const mensagens: string[] = [];
  const criteriosUsuario = criteriosPadrao.filter(c =>
    c.ativo && c.tipo === tipoUsuario
  );

  // Verificar se todas as questões obrigatórias foram respondidas
  criteriosUsuario.forEach(criterio => {
    if (!notas[criterio.id] || notas[criterio.id] === 0) {
      mensagens.push(`A questão "${criterio.descricao}" é obrigatória`);
    }
  });

  // Validações específicas
  if (tipoUsuario === 'gerente') {
    // Comentário do avaliador (questão 15) é obrigatório para aprovação
    if (!notas['q15-comentario-avaliador'] || notas['q15-comentario-avaliador']?.trim() === '') {
      mensagens.push('O comentário do avaliador (questão 15) é obrigatório para aprovar a avaliação');
    }
  }

  return {
    valida: mensagens.length === 0,
    mensagens
  };
}

/**
 * Converte avaliações antigas para o novo formato
 * NOTA: Sistema não usa mais pesos desde a versão AN-TED-002-R0
 * @param avaliacaoAntiga Avaliação no formato antigo
 * @returns Avaliação convertida para o novo formato
 */
export function converterAvaliacaoAntiga(avaliacaoAntiga: any): ResultadoAvaliacao {
  // Extrai apenas as notas, ignorando qualquer campo de peso que possa existir
  const notasConvertidas: Record<string, number> = {};

  // Para cada critério, converte a nota
  Object.entries(avaliacaoAntiga.notas || {}).forEach(([criterioId, nota]: [string, any]) => {
    if (typeof nota === 'number' && nota > 0) {
      notasConvertidas[criterioId] = nota;
    }
  });

  return calcularMediaSimples(notasConvertidas);
}

/**
 * Obtém os critérios por tipo de respondente
 * @param tipo 'colaborador' | 'gerente'
 * @param isLider Se o usuário é líder
 * @returns Lista de critérios filtrados
 */
export function getCriteriosPorTipoRespondente(
  tipo: 'colaborador' | 'gerente',
  isLider?: boolean
): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio => {
    if (!criterio.ativo) return false;
    if (criterio.tipo !== tipo) return false;
    if (criterio.apenas_lideres && !isLider) return false;
    return true;
  });
}

// Função para obter apenas critérios de liderança
export function getCriteriosLideranca(): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio =>
    criterio.ativo && criterio.apenas_lideres
  );
}
