import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/gestao-tripulantes/escala-tipos';
import { extractEscalaDias } from '@/lib/gestao-tripulantes/regime-escala';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import {
  calcularFechamentoColaborador,
  montarRubricasFolha,
  somarTotaisFechamento,
  statusSemanaFechamento,
  type CalculoFechamentoColaborador,
  type ChecagensFechamento,
  type CicloEmbarqueCalculo,
  type PendenciasProximoPeriodo,
  type RubricasDiasFechamento,
  type TotaisConsolidadosFechamento,
} from '@/lib/gestao-tripulantes/fechamento-calculo';

export { extractEscalaDias };
export type { RubricasDiasFechamento, TotaisConsolidadosFechamento };

export interface AprovadorRegistro {
  nome: string;
  cpf?: string;
  email?: string;
  cargo?: string;
  dataHora: string;
  ip?: string;
  assinaturaUrl?: string;
  assinaturaHash?: string;
}

export interface RelatorioEscalaOptions {
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
  empresa?: string;
  embarcacao?: string;
  /** GT v2: multi-embarcações (OR). Vazio/não informado = sem filtro extra. */
  embarcacoes?: string[];
  cargo?: string;
  statusAtivo?: 'ativos' | 'inativos' | 'todos';
  busca?: string;
  colaboradorId?: string;
  /** GT v2 (R5): base set explícito — lista confirmada do mês entra só com
   * estes ids. Vazio/não informado = comportamento legado (todos os filtros). */
  colaboradorIds?: string[];
  aprovador?: AprovadorRegistro;
  aprovadores?: AprovadorRegistro[];
}

export interface ColaboradorTotaisEscala {
  /** GT v2: id em gt_colaboradores (base do vínculo de pendências/marcados). */
  colaborador_id: string;
  matricula: string;
  cpf: string;
  cpf_formatado: string;
  nome: string;
  cargo: string;
  centro_custo: string;
  empresa: string;
  embarcacao: string;
  regime_escala: string;
  escala_embarque: number;
  escala_folga: number;
  total_dias_on: number;
  total_dias_dba: number;
  total_dias_fi: number;
  total_dias_fi_evento: number;
  total_dias_fi_deficit: number;
  total_dias_tre: number;
  total_dias_fer?: number;
  total_dias_stb: number;
  total_dias_folga: number;
  embarques: CicloEmbarqueCalculo[];
  checagens: ChecagensFechamento;
  /** R1/R4 — folga que cruza data_fim: FI/DBA pendentes do próximo período
   * (não debitem este fechamento; a UI/exibição consome via pendências). */
  pendenciasProximoPeriodo: PendenciasProximoPeriodo;
  semanas: Record<string, string>;
}

/** Agregado das pendências do próximo período (R1/R4) de todos os colaboradores. */
export interface TotaisPendenciasFechamento {
  /** Σ déficit FI pendente (janelas de folga além de data_fim). */
  fi: number;
  /** Σ dias de DBA pendentes (trabalho além de data_fim que reduz a folga seguinte). */
  dba: number;
}

export interface RelatorioEscalaResult {
  buffer: Buffer;
  totaisConsolidados: TotaisConsolidadosFechamento;
  /** GT v2 (R1/R4): Σ fiDeficit e Σ dias DBA pendentes do próximo período. */
  totaisPendencias: TotaisPendenciasFechamento;
  colaboradoresTotais: ColaboradorTotaisEscala[];
  calculosFolha: RubricasDiasFechamento[];
  semanas: string[];
}

const ID_COLS = 8;
const METRIC_COLS = 9;
/** R1/R4 — pendências do próximo período (FI déficit + DBA/folga aberta). */
const PEND_COLS = 2;
const FIXED_COLS = ID_COLS + METRIC_COLS + PEND_COLS;

function parseLocalDate(str: string | null | undefined): Date | null {
  if (!str || typeof str !== 'string' || str.trim() === '') return null;
  const clean = str.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const parsed = new Date(y, m, d, 0, 0, 0, 0);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function formatCpfDisplay(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}

function labelCheck(ok: boolean): string {
  return ok ? 'OK' : 'ALERTA';
}

/** Subtítulo: período fechado (datas resolvidas) com fallback para mês de referência. */
function formatarPeriodoFechado(inicio?: string | null, fim?: string | null, mesAno?: string): string {
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dtIni = parseLocalDate(inicio);
  const dtFim = parseLocalDate(fim);
  if (dtIni && dtFim) {
    return `Período fechado: ${fmt(dtIni)} a ${fmt(dtFim)}`;
  }
  return `Período: mês de referência ${mesAno || 'atual'}`;
}

/** R1/R4 — pendências do próximo período em string compacta p/ XLSX. */
function formatarPendenciasProximoPeriodo(p: PendenciasProximoPeriodo): string {
  const partes: string[] = [];
  if (p.dbaDias.length > 0) partes.push(`${p.dbaDias.length} DBA`);
  if (p.folgaAberta) partes.push('folga aberta');
  return partes.length > 0 ? partes.join(' + ') : '—';
}

interface ColabRelatorioRow {
  id: string;
  cpf: string | null;
  nome_completo: string | null;
  matricula: string | null;
  ativo: boolean | null;
  escala_embarque: number | string | null;
  escala_folga: number | string | null;
  regime_trabalho: string | null;
  cargo: unknown;
  empresa: unknown;
  embarcacao_atual: unknown;
  centro_custo: unknown;
}

interface EmbarqueRelatorioRow {
  id: string;
  colaborador_id: string;
  tipo: string | null;
  data_embarque: string | null;
  data_desembarque: string | null;
  data_prevista_desembarque: string | null;
  local_embarque: string | null;
  local_desembarque: string | null;
  observacoes: string | null;
  origem: string | null;
}

interface AfastamentoRelatorioRow {
  id: string;
  colaborador_id: string;
  tipo_afastamento: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  data_prevista_retorno: string | null;
  motivo: string | null;
}

export async function gerarRelatorioEscalaMensal(
  options: RelatorioEscalaOptions = {},
): Promise<RelatorioEscalaResult> {
  const xlsxMod = (await import('xlsx-js-style')) as { utils?: unknown; default?: { utils?: unknown } };
  const XLSX = (xlsxMod.utils ? xlsxMod : (xlsxMod as any).default) as typeof import('xlsx-js-style');

  let dtInicio: Date;
  let dtFim: Date;

  if (options.dataInicio && options.dataFim) {
    dtInicio = parseLocalDate(options.dataInicio) || new Date();
    dtFim = parseLocalDate(options.dataFim) || new Date();
  } else if (options.mesAno) {
    const [y, m] = options.mesAno.split('-').map(Number);
    dtInicio = new Date(y, m - 1, 1, 0, 0, 0, 0);
    dtFim = new Date(y, m, 0, 23, 59, 59, 999);
  } else {
    const now = new Date();
    dtInicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    dtFim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  dtInicio.setHours(0, 0, 0, 0);
  dtFim.setHours(23, 59, 59, 999);

  const snapToSaturday = (d: Date) => {
    const res = new Date(d);
    const day = res.getDay();
    const diff = day >= 6 ? day - 6 : day + 1;
    res.setDate(res.getDate() - diff);
    res.setHours(0, 0, 0, 0);
    return res;
  };

  const timelineStart = snapToSaturday(new Date(dtInicio));
  const weeks: { dateStr: string; label: string; date: Date }[] = [];
  const curWeek = new Date(timelineStart);

  while (curWeek <= dtFim || weeks.length < 4) {
    const dStr = curWeek.toISOString().slice(0, 10);
    const dayStr = String(curWeek.getDate()).padStart(2, '0');
    const monthStr = curWeek.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const yrStr = String(curWeek.getFullYear()).slice(2);
    weeks.push({
      dateStr: dStr,
      label: `${dayStr}-${monthStr}-${yrStr}`,
      date: new Date(curWeek),
    });
    curWeek.setDate(curWeek.getDate() + 7);
  }

  // PostgREST trunca em 1000 linhas (db-max-rows=1000): paginar tudo e ordenar
  // por coluna estável para páginas determinísticas.
  const [colabsRes, embarquesRes, afastamentosRes] = await Promise.all([
    paginarSelect<ColabRelatorioRow>(async (from, to) => {
      const r = await supabaseAdmin
        .from('gt_colaboradores')
        .select(`
          id, cpf, nome_completo, matricula, ativo, escala_embarque, escala_folga, regime_trabalho,
          cargo:gt_cargos(nome),
          empresa:gt_empresas(nome),
          embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome),
          centro_custo:gt_centros_custo(codigo, nome)
        `)
        .is('deleted_at', null)
        .order('nome_completo')
        .order('id')
        .range(from, to);
      return { data: r.data, error: r.error };
    }),
    paginarSelect<EmbarqueRelatorioRow>(async (from, to) => {
      const r = await supabaseAdmin
        .from('gt_historico_embarques')
        .select(`
          id, colaborador_id, tipo, data_embarque, data_desembarque,
          data_prevista_desembarque, local_embarque, local_desembarque,
          observacoes, origem
        `)
        .is('deleted_at', null)
        .order('id')
        .range(from, to);
      return { data: r.data, error: r.error };
    }),
    paginarSelect<AfastamentoRelatorioRow>(async (from, to) => {
      const r = await supabaseAdmin
        .from('gt_afastamentos')
        .select('id, colaborador_id, tipo_afastamento, data_inicio, data_fim, data_prevista_retorno, motivo')
        .is('deleted_at', null)
        .order('id')
        .range(from, to);
      return { data: r.data, error: r.error };
    }),
  ]);

  if (colabsRes.error) throw new Error(`Erro ao carregar colaboradores: ${colabsRes.error}`);
  if (embarquesRes.error) throw new Error(`Erro ao carregar embarques: ${embarquesRes.error}`);
  if (afastamentosRes.error) throw new Error(`Erro ao carregar afastamentos: ${afastamentosRes.error}`);

  let colaboradores = colabsRes.rows;
  const hist = embarquesRes.rows;
  const afastamentos = afastamentosRes.rows;

  if (options.empresa) {
    const emp = options.empresa.toLowerCase().trim();
    colaboradores = colaboradores.filter((c) => ((c.empresa as any)?.nome || '').toLowerCase().trim() === emp);
  }
  if (options.embarcacao) {
    const emb = options.embarcacao.toLowerCase().trim();
    colaboradores = colaboradores.filter((c) => ((c.embarcacao_atual as any)?.nome || '').toLowerCase().trim() === emb);
  }
  // GT v2: multi-embarcações (qualquer uma da lista entra).
  if (options.embarcacoes && options.embarcacoes.length > 0) {
    const embSet = new Set(options.embarcacoes.map((e) => e.toLowerCase().trim()).filter(Boolean));
    if (embSet.size > 0) {
      colaboradores = colaboradores.filter((c) => embSet.has(((c.embarcacao_atual as any)?.nome || '').toLowerCase().trim()));
    }
  }
  if (options.cargo) {
    const car = options.cargo.toLowerCase().trim();
    colaboradores = colaboradores.filter((c) => ((c.cargo as any)?.nome || '').toLowerCase().trim() === car);
  }
  if (options.statusAtivo === 'ativos') {
    colaboradores = colaboradores.filter((c) => c.ativo !== false);
  } else if (options.statusAtivo === 'inativos') {
    colaboradores = colaboradores.filter((c) => c.ativo === false);
  }
  if (options.colaboradorId) {
    colaboradores = colaboradores.filter((c) => c.id === options.colaboradorId);
  }
  // GT v2 (R5): lista de marcados confirmada — só estes colaboradores entram.
  if (options.colaboradorIds) {
    const idSet = new Set(options.colaboradorIds);
    colaboradores = colaboradores.filter((c) => idSet.has(c.id));
  }
  if (options.busca) {
    const q = options.busca.toLowerCase().trim();
    colaboradores = colaboradores.filter((c) =>
      (c.nome_completo || '').toLowerCase().includes(q)
      || (c.cpf || '').includes(q)
      || (c.matricula || '').toLowerCase().includes(q),
    );
  }

  const histPorColab = new Map<string, any[]>();
  for (const h of hist) {
    const arr = histPorColab.get(h.colaborador_id) || [];
    arr.push(h);
    histPorColab.set(h.colaborador_id, arr);
  }

  const afastPorColab = new Map<string, any[]>();
  for (const a of afastamentos) {
    const arr = afastPorColab.get(a.colaborador_id) || [];
    arr.push(a);
    afastPorColab.set(a.colaborador_id, arr);
  }

  const colabTotais: ColaboradorTotaisEscala[] = [];
  const calculosFolha: RubricasDiasFechamento[] = [];
  const calculos: CalculoFechamentoColaborador[] = [];

  for (const c of colaboradores) {
    const cpfNorm = normalizeCpf(c.cpf || '');
    const cHist = histPorColab.get(c.id) || [];
    const cAfast = afastPorColab.get(c.id) || [];
    const calc = calcularFechamentoColaborador(c, cHist, cAfast, { dataInicio: dtInicio, dataFim: dtFim });
    calculos.push(calc);

    const semanasMap: Record<string, string> = {};
    for (const w of weeks) {
      semanasMap[w.dateStr] = statusSemanaFechamento(calc.statusPorDia, w.date);
    }

    const ccObj = c.centro_custo as any;
    const ccLabel = ccObj ? `${ccObj.codigo ? `${ccObj.codigo} - ` : ''}${ccObj.nome || ''}` : 'NÃO DEFINIDO';
    const nome = (c.nome_completo || '').toUpperCase();
    const cargo = ((c.cargo as any)?.nome || 'SEM CARGO').toUpperCase();
    const centroCusto = ccLabel.toUpperCase();

    colabTotais.push({
      colaborador_id: c.id,
      matricula: c.matricula || '-',
      cpf: cpfNorm,
      cpf_formatado: formatCpfDisplay(cpfNorm),
      nome,
      cargo,
      centro_custo: centroCusto,
      empresa: ((c.empresa as any)?.nome || 'ABZ').toUpperCase(),
      embarcacao: ((c.embarcacao_atual as any)?.nome || options.embarcacao || 'TODAS').toUpperCase(),
      regime_escala: calc.regime_escala,
      escala_embarque: calc.dias_embarque_escala,
      escala_folga: calc.dias_folga_escala,
      total_dias_on: calc.dias_on,
      total_dias_dba: calc.dias_dba,
      total_dias_fi: calc.dias_fi,
      total_dias_fi_evento: calc.dias_fi_evento,
      total_dias_fi_deficit: calc.dias_fi_deficit,
      total_dias_tre: calc.dias_tre,
      total_dias_fer: calc.dias_fer,
      total_dias_stb: calc.dias_stb,
      total_dias_folga: calc.dias_folga,
      embarques: calc.embarques,
      checagens: calc.checagens,
      pendenciasProximoPeriodo: calc.pendenciasProximoPeriodo,
      semanas: semanasMap,
    });

    calculosFolha.push(montarRubricasFolha(
      { matricula: c.matricula || '-', cpf: cpfNorm, nome, cargo, centro_custo: centroCusto },
      calc,
    ));
  }

  const totaisConsolidados: TotaisConsolidadosFechamento = {
    totalColaboradores: colabTotais.length,
    ...somarTotaisFechamento(calculos),
  };

  // R1/R4 — pendências do próximo período (janelas de folga cortadas em
  // data_fim e folga aberta): nunca debitem este fechamento; viajam na
  // resposta para o DP planejar o mês seguinte.
  const totaisPendencias: TotaisPendenciasFechamento = calculos.reduce(
    (acc, c) => {
      acc.fi += c.pendenciasProximoPeriodo.fiDeficit;
      acc.dba += c.pendenciasProximoPeriodo.dbaDias.length;
      return acc;
    },
    { fi: 0, dba: 0 },
  );

  const wb = XLSX.utils.book_new();
  const totalCols = weeks.length + FIXED_COLS;

  const headerTitle = [
    'RELATÓRIO OFICIAL DE FECHAMENTO DE ESCALAS — DEPARTAMENTO PESSOAL & FOLHA',
    ...Array(totalCols - 1).fill(''),
  ];

  const embLabel = options.embarcacoes && options.embarcacoes.length > 0
    ? options.embarcacoes.join(', ')
    : (options.embarcacao || 'Todas');
  const filtroSub = [
    `${formatarPeriodoFechado(options.dataInicio, options.dataFim, options.mesAno)}  |  Comparativo NxN por dt início/dt fim  |  Embarcação: ${embLabel}  |  Empresa: ${options.empresa || 'Todas'}  |  Emissão: ${new Date().toLocaleString('pt-BR')}`,
    ...Array(totalCols - 1).fill(''),
  ];

  const colHeaders = [
    'MATRÍCULA',
    'NOME DO COLABORADOR',
    'CPF',
    'CARGO',
    'CENTRO DE CUSTO',
    'EMPRESA',
    'EMBARCAÇÃO',
    'REGIME / ESCALA',
    'DIAS ON',
    'DIAS DBA',
    'DIAS FI',
    'DIAS FOLGA',
    'DIAS STB',
    'DIAS TRE',
    'DIAS FER',
    'CHECK ESCALA',
    'CHECK SOMA',
    'PEND. FI PRÓX. PERÍODO',
    'PEND. PRÓX. (DBA/FOLGA)',
    ...weeks.map((w) => w.label),
  ];

  const wsData: any[][] = [headerTitle, filtroSub, [], colHeaders];

  for (const c of colabTotais) {
    wsData.push([
      c.matricula,
      c.nome,
      c.cpf_formatado,
      c.cargo,
      c.centro_custo,
      c.empresa,
      c.embarcacao,
      c.regime_escala,
      c.total_dias_on,
      c.total_dias_dba,
      c.total_dias_fi,
      c.total_dias_folga,
      c.total_dias_stb,
      c.total_dias_tre,
      c.total_dias_fer ?? 0,
      labelCheck(c.checagens.escala_ok),
      labelCheck(c.checagens.soma_ok),
      c.pendenciasProximoPeriodo.fiDeficit,
      formatarPendenciasProximoPeriodo(c.pendenciasProximoPeriodo),
      ...weeks.map((w) => c.semanas[w.dateStr] || '-'),
    ]);
  }

  wsData.push([
    'TOTAL GERAL CONSOLIDADO (DIAS)',
    `${colabTotais.length} Colaboradores`,
    '',
    '',
    '',
    '',
    '',
    '',
    totaisConsolidados.totalON,
    totaisConsolidados.totalDBA,
    totaisConsolidados.totalFI,
    totaisConsolidados.totalFOLGA,
    totaisConsolidados.totalSTB,
    totaisConsolidados.totalTRE,
    totaisConsolidados.totalFER,
    `${totaisConsolidados.colaboradoresComAlerta} alerta(s)`,
    '',
    totaisPendencias.fi,
    totaisPendencias.dba > 0 ? `${totaisPendencias.dba} DBA` : '—',
    ...weeks.map(() => ''),
  ]);

  const listaAprovadores: AprovadorRegistro[] = options.aprovadores && options.aprovadores.length > 0
    ? options.aprovadores
    : (options.aprovador ? [options.aprovador] : []);

  const signatureStartRow = wsData.length + 1;
  if (listaAprovadores.length > 0) {
    wsData.push([]);
    wsData.push(['AUTENTICAÇÃO & ASSINATURAS DIGITAIS DE FECHAMENTO — AUDITORIA CRIPTOGRÁFICA', ...Array(totalCols - 1).fill('')]);
    for (const apr of listaAprovadores) {
      wsData.push([
        `✓ Assinado Digitalmente por: ${apr.nome} ${apr.cargo ? `(${apr.cargo})` : ''} | CPF: ${apr.cpf || 'N/A'} | Data/Hora: ${apr.dataHora} | IP: ${apr.ip || '127.0.0.1'} | Hash: ${apr.assinaturaHash || 'N/A'}`,
        ...Array(totalCols - 1).fill(''),
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 34 },
    { wch: 18 },
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    ...weeks.map(() => ({ wch: 12 })),
  ];

  const rowHeights = [{ hpt: 32 }, { hpt: 20 }, { hpt: 8 }, { hpt: 26 }];
  for (let i = 0; i < colabTotais.length; i++) rowHeights.push({ hpt: 20 });
  rowHeights.push({ hpt: 24 });
  ws['!rows'] = rowHeights;

  const merges: any[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];
  if (listaAprovadores.length > 0) {
    merges.push({ s: { r: signatureStartRow, c: 0 }, e: { r: signatureStartRow, c: totalCols - 1 } });
    for (let idx = 0; idx < listaAprovadores.length; idx++) {
      merges.push({ s: { r: signatureStartRow + 1 + idx, c: 0 }, e: { r: signatureStartRow + 1 + idx, c: totalCols - 1 } });
    }
  }
  ws['!merges'] = merges;

  const defaultBorder = {
    top: { style: 'thin', color: { rgb: 'D0D7DE' } },
    bottom: { style: 'thin', color: { rgb: 'D0D7DE' } },
    left: { style: 'thin', color: { rgb: 'D0D7DE' } },
    right: { style: 'thin', color: { rgb: 'D0D7DE' } },
  };

  const colorMap: Record<string, { bg: string; text: string }> = {
    ON: { bg: 'D9EAD3', text: '274E13' },
    DBA: { bg: 'FCE5CD', text: '783F04' },
    FI: { bg: 'CFE2F3', text: '0B5394' },
    TRE: { bg: 'EFEFEF', text: '434343' },
    STB: { bg: 'FFF2CC', text: '7F6000' },
    FOLGA: { bg: 'DEEBF7', text: '1F4E79' },
    'OFF-C': { bg: 'F4CCCC', text: '990000' },
    FER: { bg: 'D9D2E9', text: '351C75' },
    AFAST: { bg: 'F4CCCC', text: '990000' },
    OK: { bg: 'D9EAD3', text: '274E13' },
    ALERTA: { bg: 'F4CCCC', text: '990000' },
  };

  const metricFill: Record<number, { bg: string; text: string }> = {
    8: { bg: 'E2EFDA', text: '274E13' },
    9: { bg: 'FCE5CD', text: '783F04' },
    10: { bg: 'CFE2F3', text: '0B5394' },
    11: { bg: 'DEEBF7', text: '1F4E79' },
    12: { bg: 'FFF2CC', text: '7F6000' },
    13: { bg: 'EFEFEF', text: '434343' },
    14: { bg: 'D9D2E9', text: '351C75' },
  };

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z100');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
      const cell = ws[cellRef];
      if (!cell) continue;

      const cellStyle: any = {
        alignment: { vertical: 'center', horizontal: C === 1 ? 'left' : 'center', wrapText: true },
      };

      if (R === 0) {
        cellStyle.font = { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Segoe UI' };
        cellStyle.fill = { fgColor: { rgb: '002060' } };
        cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
      } else if (R === 1) {
        cellStyle.font = { italic: true, color: { rgb: '334155' }, sz: 9, name: 'Segoe UI' };
        cellStyle.fill = { fgColor: { rgb: 'F1F5F9' } };
        cellStyle.alignment = { vertical: 'center', horizontal: 'center' };
      } else if (R === 3) {
        cellStyle.font = { bold: true, color: { rgb: C < ID_COLS ? 'FFFFFF' : (C < FIXED_COLS ? '002060' : '000000') }, sz: 9, name: 'Segoe UI' };
        cellStyle.fill = { fgColor: { rgb: C < ID_COLS ? '002060' : (C < FIXED_COLS ? 'BDD7EE' : 'E2EFDA') } };
        cellStyle.border = defaultBorder;
      } else if (R === 4 + colabTotais.length) {
        cellStyle.font = { bold: true, color: { rgb: '002060' }, sz: 10, name: 'Segoe UI' };
        cellStyle.fill = { fgColor: { rgb: 'D9E1F2' } };
        cellStyle.border = defaultBorder;
      } else if (R > 3 && R < 4 + colabTotais.length) {
        cellStyle.font = { sz: 9, name: 'Segoe UI' };
        cellStyle.border = defaultBorder;
        const metric = metricFill[C];
        if (metric) {
          cellStyle.fill = { fgColor: { rgb: metric.bg } };
          cellStyle.font = { bold: true, color: { rgb: metric.text } };
        } else if (C >= ID_COLS && C < FIXED_COLS && typeof cell.v === 'string' && colorMap[cell.v]) {
          cellStyle.fill = { fgColor: { rgb: colorMap[cell.v].bg } };
          cellStyle.font = { color: { rgb: colorMap[cell.v].text }, bold: true, sz: 9 };
        } else if (C >= FIXED_COLS && typeof cell.v === 'string' && colorMap[cell.v]) {
          cellStyle.fill = { fgColor: { rgb: colorMap[cell.v].bg } };
          cellStyle.font = { color: { rgb: colorMap[cell.v].text }, bold: true, sz: 9 };
        }
      } else if (R >= signatureStartRow) {
        cellStyle.font = { sz: 8, color: { rgb: '0F5132' }, name: 'Segoe UI' };
        cellStyle.fill = { fgColor: { rgb: 'D1E7DD' } };
        cellStyle.alignment = { vertical: 'center', horizontal: 'left' };
      }

      cell.s = cellStyle;
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Fechamento DP');

  const cicloHeaders = [
    'MATRÍCULA',
    'NOME',
    'CPF',
    'REGIME',
    'ESCALA EMB',
    'ESCALA FOLGA',
    'DT INÍCIO',
    'DT FIM',
    'DIAS TOTAIS',
    'ON NO PERÍODO',
    'DBA NO PERÍODO',
    'FOLGA ESPERADA',
    'FOLGA REAL',
    'FI DÉFICIT',
    'CHECK ESCALA',
    'CHECK SOMA',
    'ALERTAS',
  ];
  const cicloData: any[][] = [
    ['CICLOS COMPARATIVOS NxN — dt início e dt fim de cada embarque', ...Array(cicloHeaders.length - 1).fill('')],
    cicloHeaders,
  ];
  for (const c of colabTotais) {
    if (c.embarques.length === 0) {
      cicloData.push([
        c.matricula,
        c.nome,
        c.cpf_formatado,
        c.regime_escala,
        c.escala_embarque,
        c.escala_folga,
        '',
        '',
        0,
        c.total_dias_on,
        c.total_dias_dba,
        c.escala_folga,
        c.total_dias_folga,
        c.total_dias_fi_deficit,
        labelCheck(c.checagens.escala_ok),
        labelCheck(c.checagens.soma_ok),
        c.checagens.alertas.join(' | ') || 'sem embarque com dt início e dt fim',
      ]);
      continue;
    }
    for (const emb of c.embarques) {
      cicloData.push([
        c.matricula,
        c.nome,
        c.cpf_formatado,
        c.regime_escala,
        c.escala_embarque,
        c.escala_folga,
        emb.data_inicio,
        emb.data_fim,
        emb.dias_totais,
        emb.dias_on,
        emb.dias_dba,
        emb.dias_folga_esperada,
        emb.dias_folga_real,
        emb.dias_fi_deficit,
        labelCheck(emb.escala_ok),
        labelCheck(emb.soma_ok),
        emb.alertas.join(' | '),
      ]);
    }
  }
  const wsCiclos = XLSX.utils.aoa_to_sheet(cicloData);
  wsCiclos['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cicloHeaders.length - 1 } }];
  wsCiclos['!cols'] = cicloHeaders.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsCiclos, 'Ciclos NxN');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return {
    buffer: Buffer.from(buffer),
    totaisConsolidados,
    totaisPendencias,
    colaboradoresTotais: colabTotais,
    calculosFolha,
    semanas: weeks.map((w) => w.dateStr),
  };
}
