/**
 * Departamento (WK): `codigo` + `nome` separados; o rótulo "NN - NOME" é derivado.
 * Idempotente: nunca prefixa o código se o nome já o traz ("38 - 38 - X" colapsa para "38 - X").
 */

export interface DepartamentoRow {
  nome?: string | null;
  codigo?: string | null;
}

/** Id sintético da opção "valor legado" (departamento em texto, sem `departamento_id`) nos selects. */
export const DEPARTAMENTO_LEGADO_ID = '__departamento_legado__';

const PREFIXO_CODIGO = /^\s*(\d{1,10})\s*-\s*/;

/** Remove prefixos numéricos repetidos: "38 - 38 - ABZ" → "38 - ABZ". */
function colapsarCodigoRepetido(texto: string): string {
  return texto.replace(/^\s*(\d{1,10})\s*-\s*(?:\1\s*-\s*)+/, '$1 - ');
}

export function formatDepartamentoLabel(row: DepartamentoRow): string {
  const nome = colapsarCodigoRepetido((row.nome || '').trim());
  const codigo = (row.codigo || '').trim();
  if (!codigo || !nome) return codigo || nome;
  const prefixo = nome.slice(0, codigo.length);
  const resto = nome.slice(codigo.length);
  if (prefixo.toLowerCase() === codigo.toLowerCase() && /^\s*-\s*/.test(resto)) return nome;
  return `${codigo} - ${nome}`;
}

/** Normaliza entrada de cadastro: código numérico no início do nome vira `codigo`, nome fica sem prefixo. */
export function normalizarDepartamento(
  nomeBruto: string,
  codigoBruto?: string | null,
): { nome: string; codigo: string } {
  let nome = colapsarCodigoRepetido(nomeBruto.trim());
  let codigo = (codigoBruto || '').trim();
  const m = PREFIXO_CODIGO.exec(nome);
  if (m && (!codigo || m[1] === codigo)) {
    codigo = m[1];
    nome = nome.slice(m[0].length).trim() || nome;
  }
  return { nome, codigo };
}
