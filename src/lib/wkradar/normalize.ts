/**
 * Normalização de linhas WK Radar → entidades payroll. PURA (sem Supabase/Next).
 *
 * Tolerante a variantes de cabeçalho no estilo analisarWorkbook
 * (src/lib/indicadores/xlsx-import.ts): as keys das linhas chegam em
 * kebab-case sem acentos ('Data de Admissão' → 'data-de-admissao'); os
 * comparadores aqui removem separadores, então 'data-de-admissao',
 * 'data_admissao', 'DataAdmissao' e 'dataadmissao' caem juntos — o mesmo
 * código serve para linhas de planilha (analisarWorkbook) e de JSON da API.
 *
 * Nunca inventa dados: campo ausente/ilísivel vira null e a linha pode ser
 * contada como ignorada; quem decide pendência é o sync.
 */

export type StatusFuncionarioWk = 'active' | 'inactive' | 'terminated';

/** Funcionário WK pronto para payroll_employees (snake das colunas fica no sync). */
export interface WkFuncionario {
  matricula: string | null;
  cpf: string | null; // 11 dígitos
  nome: string;
  cargo: string | null;
  salarioBase: number;
  admissao: string | null; // 'YYYY-MM-DD'
  demissao: string | null; // 'YYYY-MM-DD'
  status: StatusFuncionarioWk;
}

/** Lançamento (rubrica) WK pronto para payroll_sheet_items. */
export interface WkLancamento {
  matricula: string | null;
  cpf: string | null;
  codigoWk: string;
  quantidade: number;
  valor: number; // valor unitário/de referência informado pelo WK
  observacao: string | null;
}

export interface ResultadoMapeamento<T> {
  registros: T[];
  ignoradas: number;
}

// ---------------------------------------------------------------------------
// Tabelas de variantes por campo (todas já normalizadas: sem acento/separador).
// Ordem importa: variantes mais específicas primeiro ('codigorubrica' antes
// de 'codigo', que é genérico e só vale como último recurso).
// ---------------------------------------------------------------------------
const VARIANTE_MATRICULA = ['matricula', 'chapa', 'registro', 'matriculaempresa', 'codigocolaborador', 'codigofuncionario', 'codigochapa'];
const VARIANTE_CPF = ['cpf', 'cpffuncionario', 'numerocpf', 'numcpf', 'cpfdigitos', 'cpfcolaborador'];
const VARIANTE_NOME = ['nome', 'nomecompleto', 'nomefuncionario', 'nomecolaborador', 'nomeempregado', 'colaborador', 'funcionario', 'empregado'];
const VARIANTE_CARGO = ['cargo', 'funcao', 'descricaocargo', 'cargofuncao', 'descricaofuncao'];
const VARIANTE_SALARIO = ['salariobase', 'salario', 'salariomensal', 'salariocontratual', 'valorsalario', 'remuneracao', 'remuneracaomensal'];
const VARIANTE_ADMISSAO = ['dataadmissao', 'datadeadmissao', 'admissao', 'dtadmissao', 'dataadmissaocolaborador'];
const VARIANTE_DEMISSAO = ['datademissao', 'datadedemissao', 'demissao', 'dtdemissao', 'datarescisao', 'datadesligamento', 'desligamento'];
const VARIANTE_SITUACAO = ['situacao', 'status', 'situacaofuncionario', 'descricaosituacao', 'situacaocolaborador'];
const VARIANTE_CODIGO = ['codigorubrica', 'codigowk', 'codigoevento', 'codevento', 'codigoverba', 'codrubrica', 'rubrica', 'evento', 'verba', 'codigo'];
const VARIANTE_QUANTIDADE = ['quantidade', 'quantidadelancamento', 'quantidaderubrica', 'qtde', 'qtd', 'quant', 'horas', 'dias'];
const VARIANTE_VALOR = ['valorreferencia', 'valorlancamento', 'valortotal', 'valor', 'referencia', 'vencimento', 'vencimentos', 'total'];
const VARIANTE_OBSERVACAO = ['observacao', 'complementohistorico', 'complemento', 'historico', 'descricao', 'obs'];

/** 'Código-WK' / 'codigo_wk' / 'CodigoWK' → 'codigowk' (mesma regra do slug, sem separador). */
function normalizarChave(chave: string): string {
  return chave
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

interface LinhaNormalizada {
  valores: Record<string, unknown>;
}

function normalizarLinha(linha: Record<string, unknown>): LinhaNormalizada {
  const valores: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    valores[normalizarChave(chave)] = valor;
  }
  return { valores };
}

/** Primeiro valor não vazio entre as variantes de cabeçalho. */
function valorPorVariantes(linha: LinhaNormalizada, variantes: string[]): unknown {
  for (const variante of variantes) {
    const valor = linha.valores[variante];
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') return valor;
  }
  return null;
}

/** Célula → texto trimmed ('' → null). */
function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' ? null : t;
}

/**
 * Número tolerante: aceita number, '1234.56', '1.234,56', 'R$ 1.234,56'.
 * Ponto+vírgula → pt-BR (ponto milhar, vírgula decimal); só vírgula → decimal.
 */
function parsearNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const bruto = texto(valor);
  if (!bruto) return null;
  let limpo = bruto.replace(/[^\d,.-]/g, '');
  if (!limpo) return null;
  if (limpo.includes(',') && limpo.includes('.')) {
    limpo = limpo.replace(/\./g, '').replace(/,/g, '.');
  } else if (limpo.includes(',')) {
    limpo = limpo.replace(/,/g, '.');
  }
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Data → 'YYYY-MM-DD'. Aceita ISO ('2026-08-15...'), BR ('15/08/2026'),
 * Date e serial Excel (número; base 1899-12-30 → 25569 dias até 1970-01-01).
 */
function parsearDataIso(valor: unknown): string | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const ms = Math.round((valor - 25569) * 86_400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const bruto = texto(valor);
  if (!bruto) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(bruto);
  if (iso) return iso[1];
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(bruto);
  if (br) {
    const ano = Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3]);
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * CPF → 11 dígitos. Exports numéricos derrubam o zero inicial (10 dígitos) —
 * recoloca com padStart; outro tamanho → null (nunca inventa).
 */
function parsearCpf(valor: unknown): string | null {
  const digitos = texto(valor)?.replace(/\D/g, '') ?? '';
  if (digitos.length === 10) return digitos.padStart(11, '0');
  if (digitos.length === 11) return digitos;
  return null;
}

/**
 * Situação WK → status payroll.
 * UNVERIFIED — situações exatas do WK variam por contrato; regra conservadora:
 * demitido/desligado/rescindido/cancelado → terminated; inativo/suspenso →
 * inactive; todo o resto (ativo, afastado, férias, licença…) segue 'active',
 * pois continua na folha. Confirmar no swagger/dados reais.
 */
function mapearStatusWk(valor: unknown): StatusFuncionarioWk {
  const t = (texto(valor) || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/demi|deslig|resci|cancel/.test(t)) return 'terminated';
  if (/inat|suspen/.test(t)) return 'inactive';
  return 'active';
}

/**
 * Chaves de busca de um código WK em payroll_codes.codigo_wk: o valor cru,
 * só dígitos e sem zeros à esquerda ('0001' e '1' casam com o mesmo código).
 */
export function chavesCodigoWk(codigo: string): string[] {
  const cru = codigo.trim();
  const soDigitos = cru.replace(/\D/g, '');
  const semZeros = soDigitos.replace(/^0+/, '') || soDigitos || cru;
  return [...new Set([cru, soDigitos, semZeros])].filter(Boolean);
}

/** Linha parece lançamento de rubrica? (código + quantidade/valor preenchidos) */
export function linhaPareceLancamento(linha: Record<string, unknown>): boolean {
  const n = normalizarLinha(linha);
  const codigo = valorPorVariantes(n, VARIANTE_CODIGO);
  if (codigo === null) return false;
  const quantidade = valorPorVariantes(n, VARIANTE_QUANTIDADE);
  const valor = valorPorVariantes(n, VARIANTE_VALOR);
  return quantidade !== null || valor !== null;
}

/** Linha parece funcionário? (nome + matrícula ou CPF) */
export function linhaPareceFuncionario(linha: Record<string, unknown>): boolean {
  const n = normalizarLinha(linha);
  const nome = valorPorVariantes(n, VARIANTE_NOME);
  if (nome === null) return false;
  const matricula = valorPorVariantes(n, VARIANTE_MATRICULA);
  const cpf = valorPorVariantes(n, VARIANTE_CPF);
  return matricula !== null || cpf !== null;
}

/** Linhas (planilha ou API) → funcionários normalizados. Linhas sem nome ou sem matrícula+CPF são contadas em ignoradas. */
export function mapearFuncionarios(linhas: Array<Record<string, unknown>>): ResultadoMapeamento<WkFuncionario> {
  const registros: WkFuncionario[] = [];
  let ignoradas = 0;
  for (const linha of linhas) {
    const n = normalizarLinha(linha);
    const nome = texto(valorPorVariantes(n, VARIANTE_NOME));
    const matricula = texto(valorPorVariantes(n, VARIANTE_MATRICULA));
    const cpf = parsearCpf(valorPorVariantes(n, VARIANTE_CPF));
    if (!nome || (!matricula && !cpf)) {
      ignoradas += 1;
      continue;
    }
    registros.push({
      matricula: matricula || null,
      cpf,
      nome,
      cargo: texto(valorPorVariantes(n, VARIANTE_CARGO)),
      salarioBase: parsearNumero(valorPorVariantes(n, VARIANTE_SALARIO)) ?? 0,
      admissao: parsearDataIso(valorPorVariantes(n, VARIANTE_ADMISSAO)),
      demissao: parsearDataIso(valorPorVariantes(n, VARIANTE_DEMISSAO)),
      status: mapearStatusWk(valorPorVariantes(n, VARIANTE_SITUACAO)),
    });
  }
  return { registros, ignoradas };
}

/** Linhas (planilha ou API) → lançamentos normalizados. Sem código WK ou sem matrícula/CPF → ignoradas. */
export function mapearLancamentos(linhas: Array<Record<string, unknown>>): ResultadoMapeamento<WkLancamento> {
  const registros: WkLancamento[] = [];
  let ignoradas = 0;
  for (const linha of linhas) {
    const n = normalizarLinha(linha);
    const codigo = texto(valorPorVariantes(n, VARIANTE_CODIGO));
    const matricula = texto(valorPorVariantes(n, VARIANTE_MATRICULA));
    const cpf = parsearCpf(valorPorVariantes(n, VARIANTE_CPF));
    if (!codigo || (!matricula && !cpf)) {
      ignoradas += 1;
      continue;
    }
    registros.push({
      matricula: matricula || null,
      cpf,
      codigoWk: codigo,
      quantidade: parsearNumero(valorPorVariantes(n, VARIANTE_QUANTIDADE)) ?? 1,
      valor: parsearNumero(valorPorVariantes(n, VARIANTE_VALOR)) ?? 0,
      observacao: texto(valorPorVariantes(n, VARIANTE_OBSERVACAO)),
    });
  }
  return { registros, ignoradas };
}
