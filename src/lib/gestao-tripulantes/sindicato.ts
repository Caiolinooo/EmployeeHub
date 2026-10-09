/**
 * Sindicato no cadastro GT/DP.
 * O select grava "código - nome" em `sindicato` (TEXT). Sem enum no Postgres.
 */

export const SINDICATO_OPCOES = [
  'SINDITOB - SINDICATO DOS TRABALHADORES OFFSHORE DO BRASIL',
  'SINDENFMAR - SINDICATO DOS ENFERMEIROS DA MARINHA MERCANTE',
  'SINTHOP - SINDICATO DOS TRABALHADORES DE HOTELARIA NAS PLATAFORMAS DE PETROLEO',
  'TAICUPAM - SINDICATO NACIONAL DOS TAIFEIROS, CULINARIOS E PANIFICADORES MARITIMOS',
] as const;

const CANONICAS = new Set<string>(SINDICATO_OPCOES);

const POR_CODIGO = new Map<string, string>(
  SINDICATO_OPCOES.map(opcao => [opcao.split(' - ')[0].toUpperCase(), opcao]),
);

/** Código sozinho vira o rótulo WK. Texto sem código fica igual. Vazio fica vazio. */
export function resolverSindicato(atual: unknown): string {
  if (atual == null) return '';
  const text = String(atual).trim();
  if (!text) return '';
  if (CANONICAS.has(text)) return text;
  const porCodigo = POR_CODIGO.get(text.toUpperCase());
  if (porCodigo) return porCodigo;
  return text;
}

/** Lista WK, na ordem do WK. Valor que não casa com código nem rótulo entra no fim. */
export function opcoesSindicato(atual: unknown): string[] {
  const base = [...SINDICATO_OPCOES];
  const resolvido = resolverSindicato(atual);
  if (resolvido && !CANONICAS.has(resolvido)) return [...base, resolvido];
  return base;
}
