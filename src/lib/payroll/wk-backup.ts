/**
 * Leitor do backup do WK Radar (AguasBrasileiras_*.zip).
 *
 * O backup é proprietário: os 37 mil XMLs do eSocial e o cadastro completo
 * estão comprimidos em formato da WK e NÃO abrem (entropia 7,67 — não é XOR
 * nem zlib/gzip). O que está em JSON legível são os "cards" do painel
 * gerencial, em DF/CRMINFP*.dat — cada um com um prólogo binário curto
 * antes do '{'.
 *
 * Dentro dos cards, o sub-objeto `Funcionario` traz a identidade completa:
 * CPF, PIS/PASEP, nome, código (= matrícula no GT), admissão e nascimento.
 * O card de custo de folha traz a remuneração mensal por IdFuncionario.
 *
 * IMPORTANTE — remuneração NÃO é salário-base: é o bruto pago no mês, que
 * para o pessoal offshore varia com embarque e dobra (a mesma pessoa vai de
 * R$ 8 mil a R$ 20 mil). Só vale como salário quando fica estável. Por isso
 * este módulo devolve o histórico e marca `remuneracaoEstavel`, e nunca
 * decide sozinho o que gravar.
 */
import JSZip from 'jszip';

/** Cards em JSON legível dentro do backup. */
const CARDS_IDENTIDADE = [
  'DF/CRMINFPINDICADORCOLABORADORES.dat',
  'DF/CRMINFPAVISOSVENCIMENTOS.dat',
];
const CARD_CUSTO_FOLHA = 'DF/CRMINFPCUSTOFOLHA.dat';

/** Meses considerados ao julgar se a remuneração é fixa. */
const JANELA_MESES = 12;
/** Repetições do mesmo valor na janela para tratar como salário fixo. */
const MIN_REPETICOES_ESTAVEL = 6;

const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

const round2 = (v: number) => Math.round(v * 100) / 100;

export const normalizarNome = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Datas "zeradas" do WK não são data. */
const dataOuNull = (v: unknown): string | null => {
  const s = String(v ?? '');
  if (!s || s.startsWith('0001-01-01')) return null;
  return s.slice(0, 10);
};

export interface PessoaWk {
  /** Id interno do WK (liga com o card de custo de folha). */
  idWk: number;
  /** Código/ficha do WK — é o que o GT guarda como matrícula. */
  codigo: string | null;
  cpf: string;
  nome: string;
  nomeNormalizado: string;
  pis: string | null;
  admissao: string | null;
  nascimento: string | null;
  /** Competência 'YYYY-MM' → bruto pago. Variável para offshore. */
  remuneracao: Record<string, number>;
  /** Valor repetido na janela, quando houver. */
  remuneracaoModa: number | null;
  /** Pagamento praticamente fixo — só então a moda vale como salário. */
  remuneracaoEstavel: boolean;
}

interface FuncionarioWk {
  Id?: number;
  Codigo?: number | string;
  Nome?: string;
  CPF?: number | string;
  PisPasep?: string;
  DataAdmissao?: string;
  DataNascimento?: string;
}

/**
 * O zip é gerado no Windows e grava os caminhos com barra invertida, que não
 * é separador válido de ZIP — `zip.file('DF/x.dat')` devolve null. Procurar
 * pelo nome normalizado.
 */
function acharArquivo(zip: JSZip, caminho: string): JSZip.JSZipObject | null {
  const alvo = caminho.replace(/\\/g, '/').toUpperCase();
  const achado = zip.file(/.*/).find((f) => f.name.replace(/\\/g, '/').toUpperCase() === alvo);
  return achado || null;
}

/** Os cards têm bytes de controle antes do JSON. */
export function lerCardJson(buf: Uint8Array): unknown {
  const texto = Buffer.from(buf).toString('utf8');
  const inicio = texto.indexOf('{');
  if (inicio < 0) throw new Error('card sem JSON');
  return JSON.parse(texto.slice(inicio));
}

/** Os objetos `Funcionario` aparecem aninhados em profundidades diferentes. */
function coletarFuncionarios(no: unknown, saida: FuncionarioWk[]): void {
  if (Array.isArray(no)) {
    for (const item of no) coletarFuncionarios(item, saida);
    return;
  }
  if (!no || typeof no !== 'object') return;
  const obj = no as Record<string, unknown>;
  if ('CPF' in obj && 'Nome' in obj && 'Id' in obj) saida.push(obj as FuncionarioWk);
  for (const v of Object.values(obj)) coletarFuncionarios(v, saida);
}

function remuneracaoPorFuncionario(card: unknown): Map<number, Record<string, number>> {
  const mapa = new Map<number, Record<string, number>>();
  const grupos = (card as { Grupos?: Array<Record<string, unknown>> })?.Grupos || [];
  for (const grupo of grupos) {
    // O nome vem em latin-1 quebrado ("Remunera??o") — casar pelo prefixo.
    if (!String(grupo.NomeGrupo ?? '').includes('Remunera')) continue;
    const valores = (grupo.ValoresMensais || []) as Array<Record<string, unknown>>;
    for (const v of valores) {
      // TipoFolha 1 = folha mensal. 13º/férias/rescisão vêm com outro tipo e
      // inflariam o mês.
      if (Number(v.TipoFolha) !== 1) continue;
      const idf = Number(v.IdFuncionario);
      if (!Number.isFinite(idf)) continue;
      const comp = String(v.Competencia ?? '').slice(0, 7);
      if (comp.length !== 7) continue;
      const atual = mapa.get(idf) || {};
      atual[comp] = round2((atual[comp] || 0) + (Number(v.Valor) || 0));
      mapa.set(idf, atual);
    }
  }
  return mapa;
}

function avaliarEstabilidade(hist: Record<string, number>): { moda: number | null; estavel: boolean } {
  const ultimos = Object.keys(hist)
    .sort()
    .slice(-JANELA_MESES)
    .map((c) => hist[c]);
  if (ultimos.length === 0) return { moda: null, estavel: false };

  const contagem = new Map<number, number>();
  for (const v of ultimos) contagem.set(v, (contagem.get(v) || 0) + 1);
  let moda = ultimos[0];
  let repeticoes = 0;
  for (const [valor, n] of contagem) {
    if (n > repeticoes) {
      moda = valor;
      repeticoes = n;
    }
  }
  return { moda, estavel: repeticoes >= MIN_REPETICOES_ESTAVEL };
}

/**
 * Extrai as pessoas do backup. Só entra quem tem CPF de 11 dígitos — é a
 * chave de casamento com o portal.
 */
export async function lerPessoasDoBackupWk(zipBuffer: Buffer): Promise<PessoaWk[]> {
  const zip = await JSZip.loadAsync(zipBuffer);

  const cardsIdentidade: unknown[] = [];
  for (const caminho of CARDS_IDENTIDADE) {
    const arq = acharArquivo(zip, caminho);
    if (arq) cardsIdentidade.push(lerCardJson(await arq.async('uint8array')));
  }
  if (cardsIdentidade.length === 0) {
    throw new Error(
      'Nenhum cadastro de funcionário no backup — confira se o zip é o export completo do WK Radar.',
    );
  }

  const cardCusto = acharArquivo(zip, CARD_CUSTO_FOLHA);
  const custoCard = cardCusto ? lerCardJson(await cardCusto.async('uint8array')) : null;
  return lerPessoasDeCards(cardsIdentidade, custoCard);
}

/**
 * Núcleo compartilhado entre o backup zip e os cards soltos (rota
 * /api/dp/wk/enriquecer): cards de identidade (JSON já decifrado) + card de
 * custo de folha (remuneração por competência) → pessoas com CPF de 11 dígitos.
 */
export function lerPessoasDeCards(
  cardsIdentidade: unknown[],
  custoCard: unknown,
): PessoaWk[] {
  const funcionarios: FuncionarioWk[] = [];
  for (const card of cardsIdentidade) {
    coletarFuncionarios(card, funcionarios);
  }
  if (funcionarios.length === 0) {
    throw new Error(
      'Nenhum cadastro de funcionário nos cards informados (procurei objetos com Id/Codigo/Nome/CPF).',
    );
  }

  const remuneracoes = custoCard
    ? remuneracaoPorFuncionario(custoCard)
    : new Map<number, Record<string, number>>();

  const porId = new Map<number, PessoaWk>();
  for (const f of funcionarios) {
    const idWk = Number(f.Id);
    const cpf = digitos(f.CPF).padStart(11, '0');
    if (!Number.isFinite(idWk) || cpf.length !== 11) continue;

    const existente = porId.get(idWk);
    if (existente) {
      // Mesma pessoa em cards diferentes: completar o que faltava.
      existente.pis = existente.pis || f.PisPasep || null;
      existente.admissao = existente.admissao || dataOuNull(f.DataAdmissao);
      existente.nascimento = existente.nascimento || dataOuNull(f.DataNascimento);
      continue;
    }

    const nome = String(f.Nome ?? '').trim();
    const hist = remuneracoes.get(idWk) || {};
    const { moda, estavel } = avaliarEstabilidade(hist);
    porId.set(idWk, {
      idWk,
      codigo: f.Codigo != null ? String(f.Codigo).trim() : null,
      cpf,
      nome,
      nomeNormalizado: normalizarNome(nome),
      pis: f.PisPasep || null,
      admissao: dataOuNull(f.DataAdmissao),
      nascimento: dataOuNull(f.DataNascimento),
      remuneracao: hist,
      remuneracaoModa: moda,
      remuneracaoEstavel: estavel,
    });
  }

  return [...porId.values()].sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado));
}

export interface CasamentoWk<T> {
  pessoa: PessoaWk;
  alvo: T | null;
  via: 'cpf' | 'matricula' | 'nome' | null;
}

/**
 * Casa as pessoas do backup com as fichas do portal, em ordem de confiança:
 * CPF (chave real), matrícula (código WK) e só então nome normalizado.
 */
export function casarComPortal<T>(
  pessoas: PessoaWk[],
  alvos: T[],
  chaves: { cpf: (t: T) => string; matricula: (t: T) => string; nome: (t: T) => string },
): Array<CasamentoWk<T>> {
  const porCpf = new Map<string, T>();
  const porMatricula = new Map<string, T>();
  const porNome = new Map<string, T>();
  for (const alvo of alvos) {
    const cpf = digitos(chaves.cpf(alvo));
    if (cpf.length === 11) porCpf.set(cpf, alvo);
    const matricula = String(chaves.matricula(alvo) ?? '').trim();
    if (matricula) porMatricula.set(matricula, alvo);
    const nome = normalizarNome(chaves.nome(alvo));
    // Nome repetido é ambíguo: não serve de chave.
    if (nome) porNome.set(nome, porNome.has(nome) ? (null as unknown as T) : alvo);
  }

  return pessoas.map((pessoa) => {
    const porCpfHit = porCpf.get(pessoa.cpf);
    if (porCpfHit) return { pessoa, alvo: porCpfHit, via: 'cpf' as const };
    const porMatrHit = pessoa.codigo ? porMatricula.get(pessoa.codigo) : undefined;
    if (porMatrHit) return { pessoa, alvo: porMatrHit, via: 'matricula' as const };
    const porNomeHit = porNome.get(pessoa.nomeNormalizado);
    if (porNomeHit) return { pessoa, alvo: porNomeHit, via: 'nome' as const };
    return { pessoa, alvo: null, via: null };
  });
}
