/**
 * Escala de Avaliação de Desempenho
 * Sistema de notas de 1 a 5 estrelas
 */

export interface NotaAvaliacao {
  valor: number;
  label: string;
  descricao: string;
  cor: string;
  icone: string;
}

export const ESCALA_AVALIACAO: NotaAvaliacao[] = [
  {
    valor: 1,
    label: 'Frequentemente não alcançou as expectativas',
    descricao: 'Desempenho consistentemente abaixo do esperado',
    cor: '#EF4444', // red-500
    icone: '★'
  },
  {
    valor: 2,
    label: 'Não alcançou as expectativas',
    descricao: 'Desempenho abaixo do esperado',
    cor: '#F59E0B', // amber-500
    icone: '★★'
  },
  {
    valor: 3,
    label: 'Alcançou as expectativas',
    descricao: 'Desempenho de acordo com o esperado',
    cor: '#3B82F6', // blue-500
    icone: '★★★'
  },
  {
    valor: 4,
    label: 'Excedeu as expectativas',
    descricao: 'Desempenho acima do esperado',
    cor: '#10B981', // green-500
    icone: '★★★★'
  },
  {
    valor: 5,
    label: 'Frequentemente excedeu as expectativas',
    descricao: 'Desempenho consistentemente acima do esperado',
    cor: '#8B5CF6', // violet-500
    icone: '★★★★★'
  }
];

/**
 * Obtém a nota da escala pelo valor
 */
export function getNotaPorValor(valor: number): NotaAvaliacao | undefined {
  return ESCALA_AVALIACAO.find(nota => nota.valor === valor);
}

/**
 * Obtém a label da nota pelo valor
 */
export function getLabelNota(valor: number): string {
  const nota = getNotaPorValor(valor);
  return nota ? nota.label : 'Não avaliado';
}

/**
 * Obtém a cor da nota pelo valor
 */
export function getCorNota(valor: number): string {
  const nota = getNotaPorValor(valor);
  return nota ? nota.cor : '#6B7280'; // gray-500
}

/**
 * Valida se o valor está dentro da escala
 */
export function isNotaValida(valor: number): boolean {
  return valor >= 1 && valor <= 5;
}

/**
 * Retorna todas as opções de notas disponíveis
 */
export function getOpcoesNotas(): NotaAvaliacao[] {
  return ESCALA_AVALIACAO;
}
