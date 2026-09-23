/**
 * Parser de extrato CSV genérico (XP Internet Banking e banco 'desconhecido')
 * → ConciliacaoMovimento[] (§4/§6 do design financeiro).
 *
 * Tolerante a:
 * - delimitadores ';' ',' e tab (detectado por frequência fora de aspas)
 * - cabeçalhos PT-BR (Data, Histórico/Descrição, Valor, Entrada/Saída, Crédito/Débito…)
 * - valores 'R$ 1.234,56', negativos com '-' ou '(…)', separador decimal vírgula
 * - datas dd/mm/aaaa e aaaa-mm-dd
 *
 * Funções puras — sem I/O, sem rede (testável com tsx --test).
 */
import type { ConciliacaoMovimento } from './types';

/* ------------------------------------------------------------------ */
/* Delimitador e quebra de linhas (RFC4180: aspas e aspas dobradas)    */
/* ------------------------------------------------------------------ */

/** Conta ocorrências de cada candidato em linhas de cabeçalho e escolhe o vencedor. */
export function detectarDelimitador(conteudo: string): ';' | ',' | '\t' {
  const candidatos: Array<';' | ',' | '\t'> = [';', ',', '\t'];
  const amostra = conteudo.slice(0, 4000);
  let melhor: ';' | ',' | '\t' = ';';
  let melhorContagem = -1;
  for (const c of candidatos) {
    const contagem = contarForaDeAspas(amostra, c);
    if (contagem > melhorContagem) {
      melhor = c;
      melhorContagem = contagem;
    }
  }
  return melhor;
}

function contarForaDeAspas(texto: string, alvo: string): number {
  let dentro = false;
  let total = 0;
  for (const ch of texto) {
    if (ch === '"') dentro = !dentro;
    else if (!dentro && ch === alvo) total += 1;
  }
  return total;
}

/** Divide uma linha CSV respeitando aspas e aspas dobradas (""). */
export function dividirLinhaCsv(linha: string, delimitador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (dentro) {
      if (ch === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else dentro = false;
      } else atual += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === delimitador) {
      campos.push(atual);
      atual = '';
    } else atual += ch;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/* ------------------------------------------------------------------ */
/* Valores e datas                                                     */
/* ------------------------------------------------------------------ */

/**
 * 'R$ 1.234,56' → 1234.56 | '-1.234,56' → -1234.56 | '(1.234,56)' → -1234.56.
 * Heurística: quando '.' e ',' coexistem, o último é o decimal;
 * se só ',' → decimal; se só '.' → decimal quando ≤2 dígitos finais, senão milhar.
 */
export function parseValorBrl(bruto: string): number {
  let s = bruto.replace(/(r\$|\s)/gi, '').trim();
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negativo = true;
    s = s.slice(1);
  }
  s = s.replace(/[^0-9.,]/g, '');
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    const partes = s.split('.');
    if (partes.length > 2 || partes[partes.length - 1].length === 3) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Valor não numérico no extrato: '${bruto}'.`);
  return negativo ? -n : n;
}

/** 'dd/mm/aaaa' | 'aaaa-mm-dd' → 'aaaa-mm-dd' (contrato ConciliacaoMovimento.data). */
export function parseDataIso(bruto: string): string {
  const s = bruto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (m) {
    const dia = m[1].padStart(2, '0');
    const mes = m[2].padStart(2, '0');
    return `${m[3]}-${mes}-${dia}`;
  }
  throw new Error(`Data não reconhecida no extrato: '${bruto}'.`);
}

/* ------------------------------------------------------------------ */
/* Identificação de colunas (cabeçalhos PT-BR, tolerantes)             */
/* ------------------------------------------------------------------ */

type Colunas = {
  data?: number;
  descricao?: number;
  valor?: number;
  credito?: number;
  debito?: number;
  tipo?: number;
  idExterno?: number;
  txid?: number;
  nossoNumero?: number;
};

function normalizar(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function identificarColunas(cabecalho: string[]): Colunas {
  const norm = cabecalho.map(normalizar);
  const achar = (padroes: RegExp[]): number | undefined => {
    for (const p of padroes) {
      const idx = norm.findIndex((c) => p.test(c));
      if (idx >= 0) return idx;
    }
    return undefined;
  };
  return {
    data: achar([/^datamov/, /^data$/, /^data.*movim/, /^date/]),
    descricao: achar([/^descrica/, /^histori/, /^detalhe/, /^lancamento/, /^memo/, /^origem$/]),
    valor: achar([/^valor$/, /^valor.*r\$$/, /^valor.*movim/, /^amount/, /^montante/, /^valor/]),
    credito: achar([/^credito$/, /^entrada$/, /^deposito$/]),
    debito: achar([/^debito$/, /^saida$/, /^saída$/, /^retirada$/]),
    tipo: achar([/^tipo/, /^d /, /^dc$/]),
    idExterno: achar([/^idexterno/, /^id_?transacao/, /^nsu/, /^autenticacao/, /^documento$/, /^identificador$/]),
    txid: achar([/^txid$/, /^identificadorpix$/]),
    nossoNumero: achar([/^noss_numero/, /^nossonumero/, /^nossnumero/, /^seunumero$/]),
  };
}

/* ------------------------------------------------------------------ */
/* Extração de txid/nosso número da descrição (sem coluna dedicada)    */
/* ------------------------------------------------------------------ */

const RX_TXID = /(?:txid|identificador\s*pix)\s*[:=\-]?\s*([A-Za-z0-9]{10,40})/i;
const RX_NOSSO = /(?:nosso\s*n[uú]mero|nosson[uú]mero|seu\s*n[uú]mero)\s*[:=\-]?\s*([0-9]{5,25}[0-9Xx/\-]*)/i;

const RX_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const RX_DATA_BR = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/;

/** Testa data sem lançar (uso na detecção de cabeçalho). */
function parseDataIsoAceita(bruto: string): boolean {
  return RX_DATA_ISO.test(bruto.trim()) || RX_DATA_BR.test(bruto.trim());
}

/* ------------------------------------------------------------------ */
/* Parser principal                                                    */
/* ------------------------------------------------------------------ */

let sequenciaFallback = 0;

function idExternoDeterministico(m: Record<string, unknown>): string {
  // Estável para dedupe UNIQUE (conta_bancaria_id, id_externo) quando a linha
  // não traz id próprio: hash de conteúdo + data (não muda entre execuções).
  const base = JSON.stringify([m.data, m.tipo, m.valor, m.descricao]);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < base.length; i += 1) {
    h1 ^= base.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  sequenciaFallback += 1;
  return `csv-${h1.toString(16).padStart(8, '0')}${(sequenciaFallback % 10000).toString().padStart(4, '0')}`;
}

export interface OpcoesCsvExtrato {
  /** Força o delimitador; ausente → detecção automática. */
  delimitador?: ';' | ',' | '\t';
  /** Não há linha de cabeçalho: colunas posicionais Data;Descrição;Valor. */
  semCabecalho?: boolean;
}

/**
 * Converte o conteúdo de um extrato CSV em ConciliacaoMovimento[].
 * Lança Error com mensagem clara em CSV malformado (sem linhas válidas).
 */
export function parseCsvExtrato(
  conteudo: string,
  opcoes: OpcoesCsvExtrato = {},
): ConciliacaoMovimento[] {
  sequenciaFallback = 0;
  const linhas = conteudo.replace(/\r\n?/g, '\n').split('\n');
  const delimitador = opcoes.delimitador ?? detectarDelimitador(conteudo);

  let inicioDados = 0;
  let colunas: Colunas;
  if (opcoes.semCabecalho) {
    colunas = { data: 0, descricao: 1, valor: 2 };
  } else {
    const indicePrimeira = linhas.findIndex((l) => l.trim().length > 0);
    if (indicePrimeira < 0) throw new Error('Extrato CSV vazio.');
    const cabecalho = dividirLinhaCsv(linhas[indicePrimeira], delimitador);
    colunas = identificarColunas(cabecalho);
    // Cabeçalho de verdade exige colunas data + (valor | crédito | débito).
    const pareceCabecalho = colunas.data !== undefined && (colunas.valor !== undefined || colunas.credito !== undefined || colunas.debito !== undefined);
    if (!pareceCabecalho) {
      colunas = { data: 0, descricao: 1, valor: 2 };
      // Se a primeira linha nem começa com data, é cabeçalho/basura — pula.
      const primeiraCelula = dividirLinhaCsv(linhas[indicePrimeira], delimitador)[0] ?? '';
      inicioDados = parseDataIsoAceita(primeiraCelula) ? indicePrimeira : indicePrimeira + 1;
    } else {
      inicioDados = indicePrimeira + 1;
    }
  }

  const movimentos: ConciliacaoMovimento[] = [];
  for (let i = inicioDados; i < linhas.length; i += 1) {
    const linha = linhas[i];
    if (!linha || linha.trim().length === 0) continue;
    const c = dividirLinhaCsv(linha, delimitador);
    if (c.every((v) => v.length === 0)) continue;
    const col = (n?: number) => (n !== undefined ? (c[n] ?? '') : '');
    const brutoData = col(colunas.data);
    const brutoValor = col(colunas.valor);
    const brutoCredito = col(colunas.credito);
    const brutoDebito = col(colunas.debito);
    const brutoTipo = col(colunas.tipo).toLowerCase();
    if (!brutoData) continue; // linha sem data não é movimento

    let valor: number;
    let tipo: 'credito' | 'debito';
    if (brutoValor) {
      valor = parseValorBrl(brutoValor);
      tipo = valor >= 0 ? 'credito' : 'debito';
    } else {
      const cred = brutoCredito ? parseValorBrl(brutoCredito) : 0;
      const deb = brutoDebito ? parseValorBrl(brutoDebito) : 0;
      valor = cred - deb;
      tipo = deb > cred ? 'debito' : 'credito';
    }
    if (brutoTipo) {
      if (/^(c|credito|entrada|in)\b/.test(brutoTipo)) tipo = 'credito';
      else if (/^(d|debito|saida|out)\b/.test(brutoTipo)) tipo = 'debito';
    }
    const valorAbs = Math.abs(valor);

    const descricao = col(colunas.descricao) || 'Movimento sem descrição';
    const txidCol = col(colunas.txid) || undefined;
    const nossoCol = col(colunas.nossoNumero) || undefined;
    const txid = txidCol ?? RX_TXID.exec(descricao)?.[1];
    const nossoNumero = nossoCol ?? RX_NOSSO.exec(descricao)?.[1];
    const idExternoCol = col(colunas.idExterno);

    movimentos.push({
      idExterno: idExternoCol || idExternoDeterministico({ data: brutoData, tipo, valor: valorAbs, descricao }),
      data: parseDataIso(brutoData),
      tipo,
      valor: valorAbs,
      descricao,
      ...(nossoNumero ? { nossoNumero } : {}),
      ...(txid ? { txid } : {}),
      raw: { linha: i + 1, campos: c },
    });
  }
  if (movimentos.length === 0) {
    throw new Error('Extrato CSV não contém movimentos válidos (verifique delimitador/cabeçalho).');
  }
  return movimentos;
}
