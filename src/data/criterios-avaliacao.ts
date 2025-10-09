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
export const criteriosPadrao: CriterioAvaliacao[] = [
  {
    id: '9a4f1c8b-5c1a-4e3b-8e0d-e2c1d3b4e5f6',
    nome: 'Conhecimento Técnico',
    descricao: 'Avalia o domínio das tecnologias e ferramentas utilizadas',
    categoria: 'Competências Técnicas',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '8b2e3f4a-1d5c-4e6b-9f0a-7c8d9e0f1a2b',
    nome: 'Produtividade',
    descricao: 'Avalia a capacidade de entregar resultados no prazo',
    categoria: 'Desempenho',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '7c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
    nome: 'Trabalho em Equipe',
    descricao: 'Avalia a capacidade de colaborar com os colegas',
    categoria: 'Habilidades Interpessoais',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '6d4e5f6a-7b8c-4d9e-0f1a-2b3c4d5e6f7a',
    nome: 'Comunicação',
    descricao: 'Avalia a clareza e eficácia na comunicação',
    categoria: 'Habilidades Interpessoais',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    nome: 'Resolução de Problemas',
    descricao: 'Avalia a capacidade de identificar e resolver problemas',
    categoria: 'Competências Técnicas',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '4f5a6b7c-8d9e-4f0a-1b2c-3d4e5f6a7b8c',
    nome: 'Iniciativa',
    descricao: 'Avalia a capacidade de tomar iniciativa e propor soluções',
    categoria: 'Comportamento',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '3a4b5c6d-7e8f-4a9b-0c1d-2e3f4a5b6c7d',
    nome: 'Comprometimento e Pontualidade',
    descricao: 'Avalia o nível de comprometimento com os objetivos da empresa e o cumprimento de prazos e horários estabelecidos',
    categoria: 'Comportamento',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    nome: 'Adaptabilidade',
    descricao: 'Avalia a capacidade de se adaptar a mudanças e novos desafios',
    categoria: 'Comportamento',
    peso: 1.0,
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: false
  },
  // Critérios específicos para líderes
  {
    id: '0d1e2f3a-4b5c-4d6e-7f8a-9b0c1d2e3f4a',
    nome: 'Liderança - Delegar',
    descricao: 'Avalia a capacidade de delegar tarefas de forma eficaz e acompanhar resultados',
    categoria: 'Liderança',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
    pontuacao_maxima: 5,
    ativo: true,
    apenas_lideres: true
  },
  {
    id: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    nome: 'Liderança - Desenvolvimento da Equipe',
    descricao: 'Avalia a capacidade de desenvolver e capacitar membros da equipe',
    categoria: 'Liderança',
    peso: 1.0, // Peso removido - todos os critérios têm peso igual
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
