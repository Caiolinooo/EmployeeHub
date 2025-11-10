/**
 * Critérios padrão para avaliação de desempenho
 * Estes critérios são usados quando não há critérios personalizados definidos no banco de dados
 */

export interface CriterioAvaliacao {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  peso: number; // Mantido para compatibilidade, mas será sempre 1.0
  pontuacao_maxima: number;
  ativo?: boolean;
  apenas_lideres?: boolean; // Novo campo para identificar critérios específicos de líderes
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

// Critérios padrão para avaliação de desempenho com UUIDs válidos
// Alinhados com a planilha AN-TED-002-R0 - Avaliação de Desempenho
export const criteriosPadrao: CriterioAvaliacao[] = [
  {
    id: '9a4f1c8b-5c1a-4e3b-8e0d-e2c1d3b4e5f6',
    nome: 'Prazos e Metas',
    descricao: 'Cumpre as atividades dentro dos prazos que são estabelecidos. Alcança todas as metas propostas.',
    categoria: 'Desempenho',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '8b2e3f4a-1d5c-4e6b-9f0a-7c8d9e0f1a2b',
    nome: 'Comprometimento',
    descricao: 'Demonstra esforço para alcançar resultados individuais, resultados da equipe e resultados da empresa.',
    categoria: 'Comportamento',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '7c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
    nome: 'Autonomia e Proatividade',
    descricao: 'Realiza as tarefas diárias sem a necessidade de intervenção da liderança.',
    categoria: 'Comportamento',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '6d4e5f6a-7b8c-4d9e-0f1a-2b3c4d5e6f7a',
    nome: 'Comunicação, Colaboração e Relacionamento',
    descricao: 'Possui uma comunicação clara. Pensa no coletivo e ajuda no aprendizado e conhecimento da equipe. Demonstra bom relacionamento com os colegas.',
    categoria: 'Habilidades Interpessoais',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    nome: 'Conhecimento das atividades',
    descricao: 'Demonstra domínio das atividades que desempenha e compartilha boas ideias e conhecimentos técnicos com o time.',
    categoria: 'Competências Técnicas',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '4f5a6b7c-8d9e-4f0a-1b2c-3d4e5f6a7b8c',
    nome: 'Resolução de problemas',
    descricao: 'Resolve problemas relacionados à sua rotina de trabalho. Utiliza a criatividade para encontrar soluções. Quando necessário, propõe soluções para a tomada de decisão da liderança.',
    categoria: 'Competências Técnicas',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '3a4b5c6d-7e8f-4a9b-0c1d-2e3f4a5b6c7d',
    nome: 'Inteligência Emocional e Solução de conflitos',
    descricao: 'Lida bem com situações de conflito, demonstrando equilíbrio quando há adversidades.',
    categoria: 'Habilidades Interpessoais',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    nome: 'Inovação',
    descricao: 'É capaz de inovar em suas estratégias e propõe ideias que irão agregar valores para o desenvolvimento das atividades e melhorias dos resultados da equipe e da empresa.',
    categoria: 'Comportamento',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  // Critérios específicos para líderes (Gerentes e Líderes)
  {
    id: '0d1e2f3a-4b5c-4d6e-7f8a-9b0c1d2e3f4a',
    nome: 'Liderança - Delegação',
    descricao: 'Sabe delegar atividades, definindo e acompanhando prazos para execução.',
    categoria: 'Liderança',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true
  },
  {
    id: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    nome: 'Liderança - Feedback e Desenvolvimento de equipe',
    descricao: 'Proporciona feedback constante para seus liderados, identificando pontos de melhorias e apresentando ferramentas e estratégias de atuação.',
    categoria: 'Liderança',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true
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

// Função para obter apenas critérios de liderança
export function getCriteriosLideranca(): CriterioAvaliacao[] {
  return criteriosPadrao.filter(criterio =>
    criterio.ativo && criterio.apenas_lideres
  );
}
