/**
 * Motor de KPIs do módulo Indicadores (R&S) — PURA (sem Supabase/Next),
 * mesmo padrão de xlsx-import.ts: testável offline e reutilizável por API,
 * scripts e futuras integrações (IA, dashboard-bi).
 *
 * As colunas das abas são dinâmicas (definidas no import XLSX), então o
 * motor RESOLVE colunas canônicas por slug, tolerando variações reais já
 * observadas entre planilhas:
 *   - abertura:  'vaga-aberta' | 'abertura-da-vaga'
 *   - prazo:     'prazo-final-de-atendimento-em-dias' | 'prazo-final-de-atendimento-dias'
 *   - admissão:  'admissao-e-cancelamento' | 'admissao'
 *
 * O KPI central do processo (AN-QUA-006) é a EFICÁCIA DE ATENDIMENTO:
 * % de vagas enviadas ao cliente dentro do prazo estabelecido
 * (tempo-de-envio ≤ prazo-final). Meta de referência: 7 dias.
 */

export interface KpiColuna {
  key: string;
  tipo?: string;
  label?: string;
}

export interface KpiLinha {
  id: string;
  dados: Record<string, unknown>;
}

export type KpiTipoAba = 'vagas' | 'substituicoes' | 'retencao' | 'dados';

/** Meta contratual: "Até 7 dias para envio dos candidatos para o cliente". */
export const META_ENVIO_DIAS = 7;

// ---------------------------------------------------------------------------
// Resolução de colunas canônicas
// ---------------------------------------------------------------------------

/** Candidatos canônicos → chave real da aba (primeira existente vence). */
const CANONICAS: Record<string, string[]> = {
  tipoVaga: ['tipo-da-vaga'],
  cliente: ['cliente'],
  funcao: ['funcao'],
  nome: ['nome'],
  vagaAberta: ['vaga-aberta', 'abertura-da-vaga'],
  dataEnvio: ['data-de-envio-para-o-cliente-pela-abz'],
  admissao: ['admissao-e-cancelamento', 'admissao', 'admissao-2'],
  prazoDias: ['prazo-final-de-atendimento-em-dias', 'prazo-final-de-atendimento-dias'],
  tempoEnvio: ['tempo-de-envio-para-o-cliente-abz'],
  antecipacao: ['antecipacao-de-atendimentos'],
  status: ['status-da-vaga'],
  substituidoPor: ['substituido-por'],
  retencao: ['retencao-em'],
  permaneceram: ['permaneceram'],
  substituicao: ['substituicao'],
  total: ['total'],
};

export type KpiColunasCanonicas = Partial<Record<keyof typeof CANONICAS, string>>;

export function resolverColunas(colunas: KpiColuna[] | unknown): KpiColunasCanonicas {
  const lista = Array.isArray(colunas) ? colunas : [];
  const presentes = new Set(lista.map((c) => String(c?.key || '')));
  const out: KpiColunasCanonicas = {};
  for (const [canonica, candidatas] of Object.entries(CANONICAS)) {
    const achada = candidatas.find((c) => presentes.has(c));
    if (achada) out[canonica as keyof typeof CANONICAS] = achada;
  }
  return out;
}

/** União de resoluções de várias abas — primeira chave canônica achada vence. */
function unirColunas(resolucoes: KpiColunasCanonicas[]): KpiColunasCanonicas {
  const out: KpiColunasCanonicas = {};
  for (const res of resolucoes) {
    for (const [canonica, chave] of Object.entries(res)) {
      const k = canonica as keyof KpiColunasCanonicas;
      if (!out[k] && chave) out[k] = chave;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalização de valores
// ---------------------------------------------------------------------------

function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paraTexto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function semAcentoMaiusculas(v: unknown): string {
  return paraTexto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

/** 'YYYY-MM' a partir de ISO 'YYYY-MM-DD' (datas gravam ISO local no import). */
export function mesIso(v: unknown): string | null {
  const s = paraTexto(v);
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
}

export type KpiStatusVaga = 'fechada' | 'cancelada' | 'aberta' | 'outros';

export function normalizarStatus(v: unknown): KpiStatusVaga {
  const s = semAcentoMaiusculas(v);
  if (s.startsWith('FECHAD') || s.startsWith('CONCLUID') || s.startsWith('ATENDID')) return 'fechada';
  if (s.startsWith('CANCELAD') || s.startsWith('CANC.')) return 'cancelada';
  if (s.startsWith('ABERT') || s.startsWith('EM PROCESSO')) return 'aberta';
  return 'outros';
}

function media(soma: number, n: number): number | null {
  return n > 0 ? soma / n : null;
}

// ---------------------------------------------------------------------------
// Classificação da aba
// ---------------------------------------------------------------------------

export function classificarAba(colunas: KpiColunasCanonicas): KpiTipoAba {
  if (colunas.retencao && (colunas.permaneceram || colunas.total)) return 'retencao';
  if (colunas.tempoEnvio && colunas.status) {
    return colunas.substituidoPor ? 'substituicoes' : 'vagas';
  }
  return 'dados';
}

// ---------------------------------------------------------------------------
// KPIs de vagas / substituições
// ---------------------------------------------------------------------------

export interface KpiMes {
  mes: string; // 'YYYY-MM'
  total: number;
  noPrazo: number;
  tempoMedio: number | null;
}

export interface KpiGrupoContagem {
  nome: string;
  total: number;
  tempoMedio: number | null;
}

export interface KpiVagas {
  total: number;
  porStatus: Record<KpiStatusVaga, number>;
  /** Vagas com medição válida (tempo ≥ 0 e prazo presentes). */
  medidos: number;
  noPrazo: number;
  atrasadas: number;
  /** noPrazo/medidos em fração [0..1]; null sem medições. */
  taxaEficacia: number | null;
  /** Média de dias entre abertura e envio ao cliente; null sem medições. */
  tempoMedioEnvio: number | null;
  antecipacaoMedia: number | null;
  porMes: KpiMes[];
  porCliente: KpiGrupoContagem[];
  porFuncao: KpiGrupoContagem[];
  porTipo: KpiGrupoContagem[];
}

export interface KpiSubstituicoes extends KpiVagas {
  /** Linhas que de fato registram substituição (tem "substituído por"). */
  comSubstituicao: number;
}

interface Agregacao {
  porMes: Map<string, { total: number; noPrazo: number; tempoSoma: number; tempoN: number }>;
  grupos: Map<string, { total: number; tempoSoma: number; tempoN: number }>;
}

function registrar(agg: Agregacao, grupo: string | null, tempo: number | null) {
  if (!grupo) return;
  const g =
    agg.grupos.get(grupo) ||
    (() => {
      const novo = { total: 0, tempoSoma: 0, tempoN: 0 };
      agg.grupos.set(grupo, novo);
      return novo;
    })();
  g.total += 1;
  if (tempo !== null) {
    g.tempoSoma += tempo;
    g.tempoN += 1;
  }
}

function topGrupo(agg: Agregacao, limite: number): KpiGrupoContagem[] {
  return [...agg.grupos.entries()]
    .map(([nome, g]) => ({ nome, total: g.total, tempoMedio: media(g.tempoSoma, g.tempoN) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
}

function agregarVagas(
  linhas: KpiLinha[],
  colunas: KpiColunasCanonicas,
  ehSubstituicao: boolean,
): KpiVagas | KpiSubstituicoes {
  const get = (l: KpiLinha, canonica: keyof KpiColunasCanonicas) =>
    colunas[canonica] ? l.dados[colunas[canonica]!] : undefined;

  const porStatus: Record<KpiStatusVaga, number> = { fechada: 0, cancelada: 0, aberta: 0, outros: 0 };
  let medidos = 0;
  let noPrazo = 0;
  let tempoSoma = 0;
  let tempoN = 0;
  let antecipSoma = 0;
  let antecipN = 0;
  let comSubstituicao = 0;
  const meses = new Map<string, { total: number; noPrazo: number; tempoSoma: number; tempoN: number }>();
  const aggClientes: Agregacao = { porMes: new Map(), grupos: new Map() };
  const aggFuncoes: Agregacao = { porMes: new Map(), grupos: new Map() };
  const aggTipos: Agregacao = { porMes: new Map(), grupos: new Map() };

  for (const l of linhas) {
    const status = normalizarStatus(get(l, 'status'));
    porStatus[status] += 1;

    const tempo = paraNumero(get(l, 'tempoEnvio'));
    const prazo = paraNumero(get(l, 'prazoDias'));
    // Tempo negativo = inconsistência da planilha (envio antes da abertura
    // por erro de digitação) — sai da medição para não poluir o KPI.
    const tempoValido = tempo !== null && tempo >= 0 ? tempo : null;

    if (tempoValido !== null) {
      tempoSoma += tempoValido;
      tempoN += 1;
    }
    const antecip = paraNumero(get(l, 'antecipacao'));
    if (antecip !== null && antecip >= 0) {
      antecipSoma += antecip;
      antecipN += 1;
    }
    if (tempoValido !== null && prazo !== null && prazo >= 0) {
      medidos += 1;
      if (tempoValido <= prazo) noPrazo += 1;
    }
    if (ehSubstituicao && paraTexto(get(l, 'substituidoPor'))) comSubstituicao += 1;

    const mes = mesIso(get(l, 'vagaAberta'));
    if (mes) {
      const m = meses.get(mes) || { total: 0, noPrazo: 0, tempoSoma: 0, tempoN: 0 };
      m.total += 1;
      if (tempoValido !== null) {
        m.tempoSoma += tempoValido;
        m.tempoN += 1;
      }
      if (tempoValido !== null && prazo !== null && prazo >= 0 && tempoValido <= prazo) m.noPrazo += 1;
      meses.set(mes, m);
    }

    const cliente = semAcentoMaiusculas(get(l, 'cliente'));
    if (cliente) registrar(aggClientes, cliente, tempoValido);
    const funcao = paraTexto(get(l, 'funcao'));
    if (funcao) registrar(aggFuncoes, funcao.toUpperCase(), tempoValido);
    const tipo = semAcentoMaiusculas(get(l, 'tipoVaga'));
    if (tipo) registrar(aggTipos, tipo, tempoValido);
  }

  const porMes: KpiMes[] = [...meses.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, m]) => ({ mes, total: m.total, noPrazo: m.noPrazo, tempoMedio: media(m.tempoSoma, m.tempoN) }));

  const base: KpiVagas = {
    total: linhas.length,
    porStatus,
    medidos,
    noPrazo,
    atrasadas: medidos - noPrazo,
    taxaEficacia: medidos > 0 ? noPrazo / medidos : null,
    tempoMedioEnvio: media(tempoSoma, tempoN),
    antecipacaoMedia: media(antecipSoma, antecipN),
    porMes,
    porCliente: topGrupo(aggClientes, 10),
    porFuncao: topGrupo(aggFuncoes, 10),
    porTipo: topGrupo(aggTipos, 6),
  };

  return ehSubstituicao ? { ...base, comSubstituicao } : base;
}

// ---------------------------------------------------------------------------
// KPIs de retenção (aba "KPI Eficácia")
// ---------------------------------------------------------------------------

export interface KpiRetencao {
  totalColaboradores: number;
  totalSubstituicoes: number;
  totalPermaneceram: number;
  /** Retenção geral ponderada por colaboradores, fração [0..1]; null sem dados. */
  taxaRetencao: number | null;
  porCliente: Array<{ cliente: string; total: number; substituicoes: number; permaneceram: number; retencao: number | null }>;
}

export function agregarRetencao(linhas: KpiLinha[], colunas: KpiColunasCanonicas): KpiRetencao {
  const get = (l: KpiLinha, canonica: keyof KpiColunasCanonicas) =>
    colunas[canonica] ? l.dados[colunas[canonica]!] : undefined;

  const porCliente: KpiRetencao['porCliente'] = [];
  let total = 0;
  let substituicoes = 0;
  let permaneceram = 0;

  for (const l of linhas) {
    const cliente = paraTexto(get(l, 'cliente'));
    const totalLinha = paraNumero(get(l, 'total')) ?? 0;
    const substituicoesLinha = paraNumero(get(l, 'substituicao')) ?? 0;
    const permaneceramLinha = paraNumero(get(l, 'permaneceram')) ?? 0;
    // Linha de agregação sem cliente (ex.: totalizador) entra só na média geral.
    const retencao = totalLinha > 0 ? permaneceramLinha / totalLinha : null;

    if (cliente) {
      porCliente.push({ cliente, total: totalLinha, substituicoes: substituicoesLinha, permaneceram: permaneceramLinha, retencao });
    }
    total += totalLinha;
    substituicoes += substituicoesLinha;
    permaneceram += permaneceramLinha;
  }

  porCliente.sort((a, b) => b.total - a.total || a.cliente.localeCompare(b.cliente, 'pt-BR'));

  return {
    totalColaboradores: total,
    totalSubstituicoes: substituicoes,
    totalPermaneceram: permaneceram,
    taxaRetencao: total > 0 ? permaneceram / total : null,
    porCliente,
  };
}

// ---------------------------------------------------------------------------
// Avaliação do processo (veredito)
// ---------------------------------------------------------------------------

export type KpiNivelAvaliacao = 'excelente' | 'bom' | 'atencao' | 'critico';

export interface KpiAvaliacao {
  nivel: KpiNivelAvaliacao;
  /** fração [0..1] consolidada de vagas no prazo; null sem medições */
  taxaEficacia: number | null;
  tempoMedioEnvio: number | null;
  metaDias: number;
}

/** Cortes: ≥90% excelente, ≥75% bom, ≥55% atenção, abaixo crítico. */
export function avaliarProcesso(consolidado: KpiVagas | null): KpiAvaliacao {
  const taxaEficacia = consolidado?.taxaEficacia ?? null;
  const tempoMedioEnvio = consolidado?.tempoMedioEnvio ?? null;
  const nivel: KpiNivelAvaliacao =
    taxaEficacia === null
      ? 'critico'
      : taxaEficacia >= 0.9
        ? 'excelente'
        : taxaEficacia >= 0.75
          ? 'bom'
          : taxaEficacia >= 0.55
            ? 'atencao'
            : 'critico';
  return { nivel, taxaEficacia, tempoMedioEnvio, metaDias: META_ENVIO_DIAS };
}

// ---------------------------------------------------------------------------
// Resultado consolidado de uma planilha
// ---------------------------------------------------------------------------

export interface KpiResultadoAba {
  id: string;
  nome: string;
  tipo: KpiTipoAba;
  totalLinhas: number;
  vagas?: KpiVagas;
  substituicoes?: KpiSubstituicoes;
  retencao?: KpiRetencao;
}

export interface KpiResultado {
  planilha: { id: string; nome: string };
  geradoEm: string;
  abas: KpiResultadoAba[];
  /** Re-agregação exata de todas as linhas das abas vagas/substituições. */
  consolidado: KpiVagas | null;
  avaliacao: KpiAvaliacao;
}

export function calcularKpisPlanilha(
  planilha: { id: string; nome: string },
  abas: Array<{ id: string; nome: string; colunas: KpiColuna[] | unknown; linhas: KpiLinha[] }>,
): KpiResultado {
  const resultadoAbas: KpiResultadoAba[] = [];
  const linhasVagas: KpiLinha[] = [];
  const resolucoes: KpiColunasCanonicas[] = [];

  for (const aba of abas) {
    const colunas = resolverColunas(aba.colunas);
    const tipo = classificarAba(colunas);
    const res: KpiResultadoAba = { id: aba.id, nome: aba.nome, tipo, totalLinhas: aba.linhas.length };

    if (tipo === 'vagas') {
      res.vagas = agregarVagas(aba.linhas, colunas, false);
      linhasVagas.push(...aba.linhas);
      resolucoes.push(colunas);
    } else if (tipo === 'substituicoes') {
      res.substituicoes = agregarVagas(aba.linhas, colunas, true) as KpiSubstituicoes;
      linhasVagas.push(...aba.linhas);
      resolucoes.push(colunas);
    } else if (tipo === 'retencao') {
      res.retencao = agregarRetencao(aba.linhas, colunas);
    }
    resultadoAbas.push(res);
  }

  // Consolidação re-agrega as linhas brutas — médias exatas, não média de médias.
  const consolidado =
    linhasVagas.length > 0 ? (agregarVagas(linhasVagas, unirColunas(resolucoes), false) as KpiVagas) : null;

  return {
    planilha,
    geradoEm: new Date().toISOString(),
    abas: resultadoAbas,
    consolidado,
    avaliacao: avaliarProcesso(consolidado),
  };
}
