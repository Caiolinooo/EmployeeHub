/**
 * Fontes DP → Folha — a conversa entre os módulos existentes do portal
 * (fechamento GT de escala/embarque e férias de gt_afastamentos) e a folha
 * (payroll_sheets / payroll_sheet_items).
 *
 * Fonte única server-side: chama as libs de cálculo DIRETO (sem HTTP self-call),
 * exatamente como o GET /api/gestao-tripulantes/relatorio-mensal lê os dados.
 *
 * Códigos usados (seed-payroll-data.sql / migration 20260921_000001 — NÃO inventar):
 *   001 Dias Normais                 ← dias_embarcado (ON)      — diária × dias
 *   138 Dobra                        ← dias_dobra (DBA)         — dia pago EM DOBRO: diária × 2 × dias
 *   125 Folga Indenizada             ← dias_fi (FI a pagar)     — diária × dias
 *   063 Adicional Sobreaviso 20%     ← dias_stb (STB)           — diária × 20% × dias
 *   131 Adicional Noturno 20%        ← dias_tre (TRE)           — diária × 20% × dias
 *   005 Férias                       ← dias de férias na competência (gt_afastamentos) — diária × dias
 *   006 1/3 Férias                   ← terço constitucional     — (diária × dias) / 3
 *
 * `dias_fer` (FER pintado no statusPorDia do fechamento) NÃO gera item aqui:
 * férias entra EXCLUSIVAMENTE por coletarFerias (evita lançamento duplo).
 * `dias_fi_deficit` de janelas além de data_fim NÃO é rubrica (pendência do
 * próximo período — R1/R4); `dias_fi` já embute o déficit DENTRO do período.
 * `dias_folga` (folga realizada) não é rubrica — é descanso, não pagamento.
 *
 * Diária = payroll_employees.base_salary / 30 (convenção do portal).
 * Casamento GT ↔ folha SEMPRE por CPF (gt_colaboradores.cpf ↔ payroll_employees.cpf,
 * ambos normalizados para 11 dígitos). Sem casamento → pendência listada,
 * NUNCA inventado lançamento.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/utils/identity';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import {
  calcularFechamentoColaborador,
  daysInclusive,
  montarRubricasFolha,
  overlapInclusive,
  type AfastamentoCalculo,
  type EventoEscalaCalculo,
  type RubricasDiasFechamento,
} from '@/lib/gestao-tripulantes/fechamento-calculo';
import { type CamposEscalaColaborador } from '@/lib/gestao-tripulantes/regime-escala';
import {
  carregarMarcadosDoMes,
  resolverPeriodoFechamento,
} from '@/lib/gestao-tripulantes/fechamento-periodo-resolver';

// ============================================================
// Tipos públicos
// ============================================================

/** Competência da folha (mês 1-12, ano ≥ 2024 — CHECK da tabela). */
export interface CompetenciaFolha {
  mes: number;
  ano: number;
}

/** Pendência de casamento/lançamento — nunca bloqueia as demais linhas. */
export interface PendenciaCpf {
  cpf: string;
  nome: string;
  motivo: string;
}

/** Lançamento proposto por uma fonte DP — ids resolvidos na gravação. */
export interface ItemPropostoFolha {
  /** CPF normalizado (11 dígitos) do colaborador GT. */
  cpf: string;
  nome: string;
  /** payroll_codes.code (001/138/125/063/131/005/006). */
  code: string;
  quantity: number;
  /** Diária (base_salary/30) ou base do adicional. */
  referenceValue: number;
  calculatedValue: number;
}

/** Filtro de coleta — companyId é obrigatório (destino dos itens na folha). */
export interface FiltroFontesDp {
  companyId: string;
  /** Nome exato (case-insensitive) da empresa GT (gt_empresas.nome). */
  empresa?: string;
  /** Nome ou código (case-insensitive) do centro de custo GT — restringe a coleta ao pessoal dele. */
  centroCusto?: string;
  /** Restringe a colaboradores GT específicos (ex.: lista confirmada R5). */
  colaboradorIds?: string[];
}

/**
 * Quadro de dias do fechamento — o que o relatório mostra por pessoa,
 * inclusive folga (descanso: não vira rubrica paga).
 */
export interface QuadroOperacional {
  cpf: string;
  nome: string;
  centroCusto: string;
  diasEmbarcado: number;
  diasDobra: number;
  diasFolga: number;
  diasFolgaIndenizada: number;
  diasFerias: number;
  diasStandby: number;
  diasTreinamento: number;
}

/** Resultado de uma coleta (antes de gravar na sheet). */
export interface ColetaFontesDp {
  itens: ItemPropostoFolha[];
  pendencias: PendenciaCpf[];
  /** Período efetivamente fechado (explicit > gt_fechamento_periodos > mês civil). */
  periodo: { dataInicio: string; dataFim: string };
  /** Quem teve movimento no período (algum dia > 0), com o centro de custo do GT. */
  quadros: QuadroOperacional[];
}

export interface ResultadoSincronizacaoModulos {
  sheetId: string;
  /** Itens origem='gt' gravados na sheet da competência. */
  inseridos: number;
  /** Itens gt descartados porque employee+code já veio de WK (precedência WK). */
  descartadosPrecedencia: number;
  pendencias: PendenciaCpf[];
  /** Dias apurados (embarque, dobra, folga, férias…) por CPF, para o relatório. */
  quadros: QuadroOperacional[];
}

/** Sheet da competência já aprovada/paga — nova consolidação é bloqueada (409-like). */
export class ErroFolhaBloqueada extends Error {
  readonly status = 409;
  readonly sheetId: string;
  readonly statusFolha: string;

  constructor(sheetId: string, statusFolha: string) {
    super(
      `Folha da competência está '${statusFolha}' — consolidação bloqueada (só draft/calculated/cancelled recebem itens)`,
    );
    this.name = 'ErroFolhaBloqueada';
    this.sheetId = sheetId;
    this.statusFolha = statusFolha;
  }
}

/** Payload inválido (competência/empresa) — mapeia para HTTP 400. */
export class ErroValidacaoFontes extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ErroValidacaoFontes';
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Salário mensal: ficha da folha quando preenchida; senão o cadastro GT. */
function salarioMensal(baseFolha: number | null | undefined, salarioGt: number | string | null | undefined): number {
  const folha = Number(baseFolha || 0);
  if (folha > 0) return folha;
  const gt = Number(salarioGt || 0);
  return Number.isFinite(gt) && gt > 0 ? gt : 0;
}



const CODE_DIAS_NORMAIS = '001';
const CODE_DOBA = '138';
const CODE_FOLGA_INDENIZADA = '125';
const CODE_SOBREAVISO = '063';
const CODE_NOTURNO = '131';
const CODE_FERIAS = '005';
const CODE_TERCO_FERIAS = '006';

/** Adicionais definidos pelos NOMES das rubricas do seed (063/131 = 20%). */
const FATOR_SOBREAVISO = 0.2;
const FATOR_NOTURNO = 0.2;

function validarCompetencia(comp: CompetenciaFolha): void {
  if (!comp || !Number.isInteger(comp.mes) || comp.mes < 1 || comp.mes > 12) {
    throw new ErroValidacaoFontes('Competência inválida: mes deve ser 1-12');
  }
  if (!Number.isInteger(comp.ano) || comp.ano < 2024) {
    throw new ErroValidacaoFontes('Competência inválida: ano deve ser ≥ 2024');
  }
}

function mesAnoDe(comp: CompetenciaFolha): string {
  return `${comp.ano}-${String(comp.mes).padStart(2, '0')}`;
}

// ============================================================
// Leitura de dados GT — MESMAS queries do relatorio-mensal
// (relatorio-escala-generator.ts), paginadas (PostgREST corta em 1000).
// ============================================================

interface ColabGtRow extends CamposEscalaColaborador {
  id: string;
  cpf: string | null;
  nome_completo: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  matricula: string | null;
  ativo: boolean | null;
  /** Salário mensal no cadastro GT. Usado quando a ficha da folha ainda não tem base. */
  salario?: number | string | null;
  cargo: { nome: string | null } | Array<{ nome: string | null }> | null;
  empresa: { nome: string | null } | Array<{ nome: string | null }> | null;
  centro_custo:
    | { codigo: string | null; nome: string | null }
    | Array<{ codigo: string | null; nome: string | null }>
    | null;
}

/** PostgREST devolve embed belongs-to como objeto (tipagem supabase diz array). */
function embedNome(v: ColabGtRow['cargo']): string {
  const obj = Array.isArray(v) ? v[0] : v;
  return (obj?.nome || '').trim();
}

function embedCentroCusto(v: ColabGtRow['centro_custo']): string {
  const obj = Array.isArray(v) ? v[0] : v;
  if (!obj) return 'NÃO DEFINIDO';
  return `${obj.codigo ? `${obj.codigo} - ` : ''}${obj.nome || ''}`;
}

interface EmbarqueGtRow extends EventoEscalaCalculo {
  id: string;
  colaborador_id: string;
}

interface AfastamentoGtRow extends AfastamentoCalculo {
  id: string;
  colaborador_id: string;
  tipo_afastamento: string | null;
}

async function carregarColaboradoresGt(filtroEmpresa?: string, colaboradorIds?: string[], filtroCentroCusto?: string): Promise<ColabGtRow[]> {
  const res = await paginarSelect<ColabGtRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_colaboradores')
      .select(`
        id, cpf, nome_completo, matricula, ativo, salario, escala_embarque, escala_folga, regime_trabalho,
        cargo:gt_cargos(nome),
        empresa:gt_empresas(nome),
        centro_custo:gt_centros_custo(codigo, nome)
      `)
      .is('deleted_at', null)
      .order('nome_completo')
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (res.error) throw new Error(`Erro ao carregar gt_colaboradores: ${res.error}`);

  let cols = res.rows;
  if (filtroEmpresa) {
    const emp = filtroEmpresa.toLowerCase().trim();
    cols = cols.filter((c) => embedNome(c.empresa).toLowerCase() === emp);
  }
  if (filtroCentroCusto) {
    const alvo = filtroCentroCusto.toLowerCase().trim();
    cols = cols.filter((c) => {
      const obj = Array.isArray(c.centro_custo) ? c.centro_custo[0] : c.centro_custo;
      return (obj?.nome || '').toLowerCase() === alvo || (obj?.codigo || '').toLowerCase() === alvo;
    });
  }
  if (colaboradorIds && colaboradorIds.length > 0) {
    const ids = new Set(colaboradorIds);
    cols = cols.filter((c) => ids.has(c.id));
  }
  return cols;
}

async function carregarEventosGt(colaboradorIds: Set<string>): Promise<Map<string, EmbarqueGtRow[]>> {
  const res = await paginarSelect<EmbarqueGtRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_historico_embarques')
      .select(`
        id, colaborador_id, tipo, data_embarque, data_desembarque,
        data_prevista_desembarque, observacoes
      `)
      .is('deleted_at', null)
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (res.error) throw new Error(`Erro ao carregar gt_historico_embarques: ${res.error}`);

  const porColab = new Map<string, EmbarqueGtRow[]>();
  for (const row of res.rows) {
    if (!colaboradorIds.has(row.colaborador_id)) continue;
    const arr = porColab.get(row.colaborador_id) || [];
    arr.push(row);
    porColab.set(row.colaborador_id, arr);
  }
  return porColab;
}

async function carregarAfastamentosGt(colaboradorIds: Set<string>): Promise<Map<string, AfastamentoGtRow[]>> {
  const res = await paginarSelect<AfastamentoGtRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_afastamentos')
      .select('id, colaborador_id, tipo_afastamento, data_inicio, data_fim, data_prevista_retorno, motivo')
      .is('deleted_at', null)
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (res.error) throw new Error(`Erro ao carregar gt_afastamentos: ${res.error}`);

  const porColab = new Map<string, AfastamentoGtRow[]>();
  for (const row of res.rows) {
    if (!colaboradorIds.has(row.colaborador_id)) continue;
    const arr = porColab.get(row.colaborador_id) || [];
    arr.push(row);
    porColab.set(row.colaborador_id, arr);
  }
  return porColab;
}

// ============================================================
// payroll_employees — casamento por CPF (digits OU formatado 000.000.000-00)
// ============================================================

interface EmployeeFolhaRow {
  id: string;
  cpf: string | null;
  base_salary: number | null;
  status: string | null;
  admission_date: string | null;
}

interface EmployeeFolha {
  id: string;
  baseSalary: number;
  status: string | null;
  admissionDate: string | null;
}

/**
 * Mapa CPF (11 dígitos) → employee da folha da empresa. Qualquer status entra
 * (desligado no meio da competência ainda tem dias a pagar); em CPF duplicado
 * prevalece o 'active', depois a admissão mais recente.
 */
async function carregarEmployeesPorCpf(companyId: string): Promise<Map<string, EmployeeFolha>> {
  const res = await paginarSelect<EmployeeFolhaRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('payroll_employees')
      .select('id, cpf, base_salary, status, admission_date')
      .eq('company_id', companyId)
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (res.error) throw new Error(`Erro ao carregar payroll_employees: ${res.error}`);

  const mapa = new Map<string, EmployeeFolha>();
  for (const row of res.rows) {
    const cpf = normalizeCpf(row.cpf || '');
    if (cpf.length !== 11) continue;
    const candidato: EmployeeFolha = {
      id: row.id,
      baseSalary: Number(row.base_salary || 0),
      status: row.status,
      admissionDate: row.admission_date,
    };
    const atual = mapa.get(cpf);
    if (!atual) {
      mapa.set(cpf, candidato);
      continue;
    }
    const atualAtivo = atual.status === 'active';
    const candidatoAtivo = candidato.status === 'active';
    if (candidatoAtivo && !atualAtivo) mapa.set(cpf, candidato);
    else if (candidatoAtivo === atualAtivo && (candidato.admissionDate || '') > (atual.admissionDate || '')) {
      mapa.set(cpf, candidato);
    }
  }
  return mapa;
}

// ============================================================
// coletarRubricasEscala — fechamento GT → rubricas de dias
// ============================================================

/**
 * Coleta os MESMOS dados do GET /api/gestao-tripulantes/relatorio-mensal
 * (gt_colaboradores + gt_historico_embarques + gt_afastamentos, período
 * explicit > gt_fechamento_periodos > mês civil, lista confirmada R5),
 * roda calcularFechamentoColaborador + montarRubricasFolha por colaborador
 * e converte os dias em itens de folha (diária = base_salary/30).
 *
 * Idempotente por construção: devolve propostas; a gravação (sincronizarModulosInternos)
 * substitui todo o conjunto origem='gt' da sheet.
 */
export async function coletarRubricasEscala(
  competencia: CompetenciaFolha,
  filtro: FiltroFontesDp,
): Promise<ColetaFontesDp> {
  validarCompetencia(competencia);
  if (!filtro?.companyId) throw new ErroValidacaoFontes('companyId é obrigatório');

  const mesAno = mesAnoDe(competencia);

  // GT v2: período explícito > gt_fechamento_periodos do mês > mês civil;
  // lista confirmada → SOMENTE os marcados entram (mesma regra da rota).
  const periodo = await resolverPeriodoFechamento({ mesAno });
  const marcados = await carregarMarcadosDoMes(mesAno);
  const idsFiltro = marcados.listaConfirmada
    ? marcados.idsMarcados
    : filtro.colaboradorIds;

  const colaboradores = await carregarColaboradoresGt(filtro.empresa, idsFiltro, filtro.centroCusto);
  const idsColab = new Set(colaboradores.map((c) => c.id));
  const [histPorColab, afastPorColab, employees] = await Promise.all([
    carregarEventosGt(idsColab),
    carregarAfastamentosGt(idsColab),
    carregarEmployeesPorCpf(filtro.companyId),
  ]);

  const itens: ItemPropostoFolha[] = [];
  const pendencias: PendenciaCpf[] = [];
  const quadros: QuadroOperacional[] = [];

  for (const c of colaboradores) {
    const cpfNorm = normalizeCpf(c.cpf || '');
    const nome = (c.nome_completo || '').trim() || 'SEM NOME';

    const employee = cpfNorm.length === 11 ? employees.get(cpfNorm) : undefined;
    if (!employee) {
      pendencias.push({
        cpf: cpfNorm || (c.cpf || ''),
        nome,
        motivo: 'Sem ficha na folha para esta empresa (CPF não casado) — escala não lançada. Rode "Sincronizar colaboradores do GT" para criar a ficha.',
      });
      continue;
    }

    const calc = calcularFechamentoColaborador(
      c,
      histPorColab.get(c.id) || [],
      afastPorColab.get(c.id) || [],
      { dataInicio: new Date(`${periodo.dataInicio}T00:00:00`), dataFim: new Date(`${periodo.dataFim}T00:00:00`) },
    );

    // Conversão canônica dias → contadores de rubrica (montarRubricasFolha).
    const rubricas = montarRubricasFolha(
      {
        matricula: c.matricula || '-',
        cpf: cpfNorm,
        nome: nome.toUpperCase(),
        cargo: (embedNome(c.cargo) || 'SEM CARGO').toUpperCase(),
        centro_custo: embedCentroCusto(c.centro_custo).toUpperCase(),
      },
      calc,
    );

    const dias = rubricas.rubricas;
    const movimento =
      dias.dias_embarcado + dias.dias_dobra + dias.dias_folga + dias.dias_folga_indenizada +
      dias.dias_ferias + dias.dias_standby + dias.dias_treinamento;
    if (movimento > 0) {
      quadros.push({
        cpf: cpfNorm,
        nome,
        centroCusto: rubricas.centro_custo || 'NÃO DEFINIDO',
        diasEmbarcado: dias.dias_embarcado,
        diasDobra: dias.dias_dobra,
        diasFolga: dias.dias_folga,
        diasFolgaIndenizada: dias.dias_folga_indenizada,
        diasFerias: dias.dias_ferias,
        diasStandby: dias.dias_standby,
        diasTreinamento: dias.dias_treinamento,
      });
      if (salarioMensal(employee.baseSalary, c.salario) <= 0) {
        pendencias.push({
          cpf: cpfNorm,
          nome,
          motivo: 'Sem salário base (folha e cadastro GT) — dias apurados, mas os valores não foram lançados',
        });
      }
    }

    // Administrativo (sem rotação, escala_embarque = 0) sem nenhum movimento
    // offshore no período: paga o mês como CLT mensalista — rubrica 001 com os
    // dias ativos (mês civil completo, ou proporcional admissão/demissão).
    // Offshore com escala NxN mas sem embarque no mês NÃO entra aqui: ficou em
    // casa e a folga é informativa, não paga.
    const ehAdministrativo = !Number(c.escala_embarque) || Number(c.escala_embarque) === 0;
    if (movimento === 0 && ehAdministrativo) {
      const base = salarioMensal(employee.baseSalary, c.salario);
      const inicioPeriodo = new Date(`${periodo.dataInicio}T00:00:00`);
      const fimPeriodo = new Date(`${periodo.dataFim}T00:00:00`);
      const adm = c.data_admissao ? new Date(`${c.data_admissao}T00:00:00`) : null;
      const dem = c.data_demissao ? new Date(`${c.data_demissao}T00:00:00`) : null;
      const inicioAtivo = adm && adm > inicioPeriodo ? adm : inicioPeriodo;
      const fimAtivo = dem && dem < fimPeriodo ? dem : fimPeriodo;
      const diasAtivos =
        fimAtivo >= inicioAtivo
          ? Math.round((fimAtivo.getTime() - inicioAtivo.getTime()) / 86_400_000) + 1
          : 0;
      if (diasAtivos > 0) {
        quadros.push({
          cpf: cpfNorm,
          nome,
          centroCusto: rubricas.centro_custo || 'NÃO DEFINIDO',
          diasEmbarcado: 0,
          diasDobra: 0,
          diasFolga: 0,
          diasFolgaIndenizada: 0,
          diasFerias: 0,
          diasStandby: 0,
          diasTreinamento: 0,
        });
        if (base <= 0) {
          pendencias.push({
            cpf: cpfNorm,
            nome,
            motivo: 'Sem salário base (folha e cadastro GT) — administrativo apurado, mas os valores não foram lançados',
          });
        } else {
          const diaria = round2(base / 30);
          itens.push({
            cpf: cpfNorm,
            nome,
            code: CODE_DIAS_NORMAIS,
            quantity: diasAtivos,
            referenceValue: diaria,
            calculatedValue: round2(diaria * diasAtivos),
          });
        }
      }
    }

    itens.push(...converterRubricasDias(rubricas, salarioMensal(employee.baseSalary, c.salario), cpfNorm, nome));
  }

  return { itens, pendencias, quadros, periodo: { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim } };
}

/** Dias do fechamento → propostas de item (só dias > 0; arredondado 2 casas). */
function converterRubricasDias(
  rubricas: RubricasDiasFechamento,
  baseSalary: number,
  cpf: string,
  nome: string,
): ItemPropostoFolha[] {
  const diaria = round2(baseSalary / 30);
  const r = rubricas.rubricas;
  const bruto: Array<{ code: string; quantity: number; fator: number }> = [
    { code: CODE_DIAS_NORMAIS, quantity: r.dias_embarcado, fator: 1 },
    // Dobra = dia trabalhado além da escala pago EM DOBRO (descrição do seed).
    { code: CODE_DOBA, quantity: r.dias_dobra, fator: 2 },
    { code: CODE_FOLGA_INDENIZADA, quantity: r.dias_folga_indenizada, fator: 1 },
    { code: CODE_SOBREAVISO, quantity: r.dias_standby, fator: FATOR_SOBREAVISO },
    { code: CODE_NOTURNO, quantity: r.dias_treinamento, fator: FATOR_NOTURNO },
  ];

  const itens: ItemPropostoFolha[] = [];
  for (const b of bruto) {
    const quantity = Math.max(0, b.quantity || 0);
    if (quantity <= 0) continue;
    const valor = round2(diaria * b.fator * quantity);
    if (valor <= 0) continue;
    itens.push({
      cpf,
      nome,
      code: b.code,
      quantity,
      referenceValue: diaria,
      calculatedValue: valor,
    });
  }
  return itens;
}

// ============================================================
// coletarFerias — gt_afastamentos tipo='ferias' → 005 + 006
// ============================================================

interface ColabCpfRow {
  id: string;
  cpf: string | null;
  nome_completo: string | null;
  centro?: string;
  salario?: number;
}

interface AfastamentoFeriasRow {
  id: string;
  data_inicio: string | null;
  data_fim?: string | null;
  data_prevista_retorno?: string | null;
}

/** Interseção civil inclusive entre [inicio,fim] do afastamento e o período. */
function diasFeriasNoMes(af: AfastamentoFeriasRow, periodo: { dataInicio: Date; dataFim: Date }): number {
  if (!af.data_inicio) return 0;
  const inicio = new Date(`${af.data_inicio.slice(0, 10)}T00:00:00`);
  // Fim aberto → assume em curso até o fim do período (data_fim é a data canônica
  // gravada pelo leaveService; data_prevista_retorno é o fallback).
  const fimBruto = af.data_fim || af.data_prevista_retorno;
  const fim = fimBruto ? new Date(`${fimBruto.slice(0, 10)}T00:00:00`) : periodo.dataFim;
  const ov = overlapInclusive(inicio, fim, periodo.dataInicio, periodo.dataFim);
  if (!ov) return 0;
  return daysInclusive(ov.start, ov.end);
}

/**
 * Férias da competência: gt_afastamentos tipo_afastamento='ferias'
 * (deleted_at IS NULL) cujo período intersecta o período fechado da
 * competência (mesmo resolvedor do relatorio-mensal). Colaborador casado
 * com payroll_employees por CPF; sem casamento → pendência, nunca inventa.
 *
 * Gera 005 Férias (diária × dias) e 006 1/3 Férias ((diária × dias)/3).
 */
export async function coletarFerias(
  competencia: CompetenciaFolha,
  filtro: FiltroFontesDp,
): Promise<ColetaFontesDp> {
  validarCompetencia(competencia);
  if (!filtro?.companyId) throw new ErroValidacaoFontes('companyId é obrigatório');

  const mesAno = mesAnoDe(competencia);
  const periodo = await resolverPeriodoFechamento({ mesAno });
  const periodoDatas = {
    dataInicio: new Date(`${periodo.dataInicio}T00:00:00`),
    dataFim: new Date(`${periodo.dataFim}T00:00:00`),
  };

  // Colaboradores GT → CPF (join feito aqui, o afastamento referencia por id).
  const colaboradores = await carregarColaboradoresGt(filtro.empresa, filtro.colaboradorIds, filtro.centroCusto);
  const colabPorId = new Map<string, ColabCpfRow>();
  for (const c of colaboradores) {
    colabPorId.set(c.id, {
      id: c.id,
      cpf: c.cpf,
      nome_completo: c.nome_completo,
      centro: embedCentroCusto(c.centro_custo).toUpperCase(),
      salario: Number(c.salario || 0),
    });
  }

  const afastamentos = await carregarAfastamentosGt(new Set(colabPorId.keys()));
  const employees = await carregarEmployeesPorCpf(filtro.companyId);

  const itens: ItemPropostoFolha[] = [];
  const pendencias: PendenciaCpf[] = [];
  const quadros: QuadroOperacional[] = [];

  for (const [colaboradorId, lista] of afastamentos) {
    const colab = colabPorId.get(colaboradorId);
    const cpfNorm = normalizeCpf(colab?.cpf || '');
    const nome = (colab?.nome_completo || '').trim() || 'SEM NOME';

    let diasNoMes = 0;
    for (const af of lista) {
      if ((af.tipo_afastamento || '').toLowerCase() !== 'ferias') continue;
      diasNoMes += diasFeriasNoMes(af, periodoDatas);
    }
    if (diasNoMes <= 0) continue;

    const employee = cpfNorm.length === 11 ? employees.get(cpfNorm) : undefined;
    if (!employee) {
      pendencias.push({
        cpf: cpfNorm || (colab?.cpf || ''),
        nome,
        motivo: `Férias (${diasNoMes} dia(s) na competência) sem ficha na folha (CPF não casado) — não lançada. Rode "Sincronizar colaboradores do GT".`,
      });
      continue;
    }

    quadros.push({
      cpf: cpfNorm,
      nome,
      centroCusto: colab?.centro || 'NÃO DEFINIDO',
      diasEmbarcado: 0,
      diasDobra: 0,
      diasFolga: 0,
      diasFolgaIndenizada: 0,
      diasFerias: diasNoMes,
      diasStandby: 0,
      diasTreinamento: 0,
    });

    const salario = salarioMensal(employee.baseSalary, colab?.salario);
    const diaria = round2(salario / 30);
    const valorFerias = round2(diaria * diasNoMes);
    if (valorFerias <= 0) {
      pendencias.push({
        cpf: cpfNorm,
        nome,
        motivo: `Férias (${diasNoMes} dia(s)) sem salário base — dias no relatório, valor não lançado`,
      });
      continue;
    }

    itens.push({
      cpf: cpfNorm,
      nome,
      code: CODE_FERIAS,
      quantity: diasNoMes,
      referenceValue: diaria,
      calculatedValue: valorFerias,
    });
    // Terço constitucional (sempre devido quando há férias no mês).
    const terco = round2(valorFerias / 3);
    if (terco > 0) {
      itens.push({
        cpf: cpfNorm,
        nome,
        code: CODE_TERCO_FERIAS,
        quantity: diasNoMes,
        referenceValue: diaria,
        calculatedValue: terco,
      });
    }
  }

  return { itens, pendencias, quadros, periodo: { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim } };
}

// ============================================================
// coletarSaldosFerias — ciclos aquisitivos × gozo (rescisão 306)
// ============================================================

interface PeriodoGozo {
  inicio: Date;
  fim: Date;
}

function adicionarMeses(d: Date, meses: number): Date {
  const diaOriginal = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1, 0, 0, 0, 0);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(diaOriginal, ultimoDia));
  return alvo;
}

/** Funde intervalos sobrepostos/adjacentes (evita dupla contagem GT + leave). */
function fundirPeriodos(periodos: PeriodoGozo[]): PeriodoGozo[] {
  const ordenados = [...periodos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const fundidos: PeriodoGozo[] = [];
  for (const p of ordenados) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo) {
      const proximoDiaUltimo = new Date(ultimo.fim.getFullYear(), ultimo.fim.getMonth(), ultimo.fim.getDate() + 1).getTime();
      if (p.inicio.getTime() <= proximoDiaUltimo) {
        if (p.fim.getTime() > ultimo.fim.getTime()) ultimo.fim = p.fim;
        continue;
      }
    }
    fundidos.push({ ...p });
  }
  return fundidos;
}

/**
 * Ciclos aquisitivos vencidos e NÃO integralmente gozados desde `admissao`
 * (para calcularRescisao → rubrica 306 Férias Vencidas + 1/3).
 *
 * Gozo considerado: gt_afastamentos tipo='ferias' (deleted_at IS NULL, casado
 * por CPF em gt_colaboradores) + leave_requests APPROVED do usuário cujo
 * users_unified.tax_id = CPF (períodos[].start_date/end_date ou start/end).
 * Fontes fundidas por sobreposição — o gozo sincronizado não conta em dobro.
 *
 * Um ciclo [admissão+12k, admissão+12(k+1)) conta como quitado com ≥ 30 dias
 * gozados dentro dele; vencido = já concluído com menos de 30 dias gozados.
 * CPF inválido → 0.
 */
export async function coletarSaldosFerias(cpf: string, admissao: Date | string): Promise<number> {
  const digits = normalizeCpf(cpf || '');
  if (digits.length !== 11) return 0;

  const adm = typeof admissao === 'string' ? new Date(`${admissao.slice(0, 10)}T00:00:00`) : admissao;
  if (!adm || Number.isNaN(adm.getTime())) return 0;

  const hoje = new Date();
  const hojeTs = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  if (hojeTs < adm.getTime()) return 0;

  // Gozo fonte 1: gt_afastamentos do colaborador com esse CPF.
  const gozo: PeriodoGozo[] = [];
  const colabRes = await paginarSelect<ColabCpfRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, cpf, nome_completo')
      .is('deleted_at', null)
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (colabRes.error) throw new Error(`Erro ao carregar gt_colaboradores: ${colabRes.error}`);
  const colab = colabRes.rows.find((c) => normalizeCpf(c.cpf || '') === digits);
  if (colab) {
    const afastRes = await supabaseAdmin
      .from('gt_afastamentos')
      .select('id, data_inicio, data_fim, data_prevista_retorno')
      .eq('colaborador_id', colab.id)
      .eq('tipo_afastamento', 'ferias')
      .is('deleted_at', null);
    if (afastRes.error) throw new Error(`Erro ao carregar gt_afastamentos: ${afastRes.error.message}`);
    for (const af of afastRes.data || []) {
      if (!af.data_inicio) continue;
      const fim = af.data_fim || af.data_prevista_retorno;
      gozo.push({
        inicio: new Date(`${af.data_inicio.slice(0, 10)}T00:00:00`),
        fim: new Date(`${(fim || af.data_inicio).slice(0, 10)}T00:00:00`),
      });
    }
  }

  // Gozo fonte 2: leave_requests APPROVED via users_unified.tax_id = CPF
  // (tax_id pode estar digits ou mascarado — mesmas duas formas do lookup GT).
  const formatado = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  const userRes = await supabaseAdmin
    .from('users_unified')
    .select('id')
    .in('tax_id', [digits, formatado])
    .limit(2);
  if (userRes.error) throw new Error(`Erro ao carregar users_unified: ${userRes.error.message}`);
  const userId = userRes.data?.[0]?.id;
  if (userId) {
    const leaveRes = await supabaseAdmin
      .from('leave_requests')
      .select('start_date, end_date, periods')
      .eq('user_id', userId)
      .eq('status', 'APPROVED');
    if (leaveRes.error) throw new Error(`Erro ao carregar leave_requests: ${leaveRes.error.message}`);
    for (const lr of leaveRes.data || []) {
      const periodos: Array<{ start_date: string; end_date: string }> =
        Array.isArray(lr.periods) && lr.periods.length > 0
          ? lr.periods
          : [{ start_date: lr.start_date, end_date: lr.end_date }];
      for (const p of periodos) {
        if (!p?.start_date || !p?.end_date) continue;
        gozo.push({
          inicio: new Date(`${p.start_date.slice(0, 10)}T00:00:00`),
          fim: new Date(`${p.end_date.slice(0, 10)}T00:00:00`),
        });
      }
    }
  }

  const gozoFundido = fundirPeriodos(gozo.filter((g) => g.fim.getTime() >= g.inicio.getTime()));

  // Ciclos aquisitivos concluídos até hoje; cada um precisa de 30 dias gozados.
  let ciclosVencidos = 0;
  for (let k = 0; ; k += 1) {
    const inicio = adicionarMeses(adm, 12 * k);
    const fimExclusivo = adicionarMeses(adm, 12 * (k + 1));
    const fim = new Date(fimExclusivo.getTime() - 86_400_000);
    if (inicio.getTime() > hojeTs) break;
    // Ciclo ainda em curso (fim no futuro) não é "vencido" ainda.
    if (fim.getTime() > hojeTs) break;

    let gozados = 0;
    for (const g of gozoFundido) {
      const ov = overlapInclusive(g.inicio, g.fim, inicio, fim);
      if (ov) gozados += daysInclusive(ov.start, ov.end);
      if (gozados >= 30) break;
    }
    if (gozados < 30) ciclosVencidos += 1;
  }

  return ciclosVencidos;
}


/** Une quadros da escala e das férias pelo CPF. O mesmo dia não soma duas vezes. */
function fundirQuadros(listas: QuadroOperacional[][]): QuadroOperacional[] {
  const map = new Map<string, QuadroOperacional>();
  for (const lista of listas) {
    for (const q of lista) {
      const atual = map.get(q.cpf);
      if (!atual) {
        map.set(q.cpf, { ...q });
        continue;
      }
      atual.diasEmbarcado = Math.max(atual.diasEmbarcado, q.diasEmbarcado);
      atual.diasDobra = Math.max(atual.diasDobra, q.diasDobra);
      atual.diasFolga = Math.max(atual.diasFolga, q.diasFolga);
      atual.diasFolgaIndenizada = Math.max(atual.diasFolgaIndenizada, q.diasFolgaIndenizada);
      atual.diasFerias = Math.max(atual.diasFerias, q.diasFerias);
      atual.diasStandby = Math.max(atual.diasStandby, q.diasStandby);
      atual.diasTreinamento = Math.max(atual.diasTreinamento, q.diasTreinamento);
      if ((!atual.centroCusto || atual.centroCusto === 'NÃO DEFINIDO') && q.centroCusto) {
        atual.centroCusto = q.centroCusto;
      }
      if ((atual.nome === 'SEM NOME' || !atual.nome) && q.nome) atual.nome = q.nome;
    }
  }
  return [...map.values()];
}

// ============================================================
// sincronizarModulosInternos — gravação idempotente na sheet (CONTRATO 1)
// ============================================================

interface SheetFolhaRow {
  id: string;
  status: string | null;
  department_id: string | null;
}

/**
 * Garante a sheet draft da competência (empresa+mes+ano). Preferência de
 * departamento quando houver mais de uma sheet no período; sem nenhuma,
 * cria draft com os limites civis do mês.
 */
async function garantirSheetDraft(
  companyId: string,
  competencia: CompetenciaFolha,
  departmentId: string | null,
  usuarioId?: string,
): Promise<SheetFolhaRow> {
  const { data: sheets, error } = await supabaseAdmin
    .from('payroll_sheets')
    .select('id, status, department_id')
    .eq('company_id', companyId)
    .eq('reference_month', competencia.mes)
    .eq('reference_year', competencia.ano)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erro ao buscar payroll_sheets: ${error.message}`);

  const existente =
    (departmentId ? sheets?.find((s) => s.department_id === departmentId) : undefined) ||
    sheets?.find((s) => !s.department_id) ||
    sheets?.[0];

  if (existente) {
    const statusAtual = String(existente.status || '');
    if (statusAtual === 'approved' || statusAtual === 'paid') {
      throw new ErroFolhaBloqueada(existente.id, statusAtual);
    }
    return existente as SheetFolhaRow;
  }

  const { data: criada, error: insertError } = await supabaseAdmin
    .from('payroll_sheets')
    .insert({
      company_id: companyId,
      department_id: departmentId,
      reference_month: competencia.mes,
      reference_year: competencia.ano,
      period_start: `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}-01`,
      period_end: ymdFimMes(competencia.ano, competencia.mes),
      status: 'draft',
      notes: 'Consolidação dos módulos internos (GT: escala + férias)',
      created_by: usuarioId || null,
    })
    .select('id, status, department_id')
    .single();

  if (insertError) throw new Error(`Erro ao criar payroll_sheet da competência: ${insertError.message}`);
  return criada as SheetFolhaRow;
}

function ymdFimMes(ano: number, mes: number): string {
  const fim = new Date(ano, mes, 0); // dia 0 do mês seguinte = último dia do mês
  const day = String(fim.getDate()).padStart(2, '0');
  return `${ano}-${String(mes).padStart(2, '0')}-${day}`;
}

/** Grava a auditoria da consolidação (origem_evento='consolidacao'). */
async function auditarConsolidacao(params: {
  sheetId: string;
  acao: 'INSERT' | 'UPDATE';
  usuarioId?: string;
  detalhes: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('payroll_audit_log').insert({
    table_name: 'payroll_sheets',
    record_id: params.sheetId,
    action: params.acao,
    old_values: null,
    new_values: { origem_evento: 'consolidacao', ...params.detalhes },
    changed_by: params.usuarioId || null,
  });
  if (error) {
    // Auditoria nunca bloqueia a operação de negócio — mas é logada.
    console.error('[fontes-dp] falha ao gravar payroll_audit_log:', error.message);
  }
}

/** Colunas created_by/changed_by são UUID — descarta valor não-UUID sem quebrar o sync. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CONTRATO 1 — consolida os módulos internos (escala GT + férias) na sheet da
 * competência, itens origem='gt':
 *   1. garante sheet draft (approved/paid → ErroFolhaBloqueada 409-like);
 *   2. coleta escala (relatorio-mensal) + férias (gt_afastamentos);
 *   3. DELETE itens origem='gt' da sheet (itens 'manual' e 'wk' preservados);
 *   4. INSERT novos — item gt cujo employee+code já exista como origem='wk'
 *      é DESCARTADO (precedência WK vence) e conta em descartadosPrecedencia;
 *   5. auditoria payroll_audit_log com origem_evento='consolidacao'.
 *
 * Idempotente: re-executar apaga e reinsere o mesmo conjunto 'gt' — estado
 * final estável, sem duplicação.
 */
export async function sincronizarModulosInternos(opts: {
  competencia: CompetenciaFolha;
  companyId: string;
  departmentId?: string | null;
  usuarioId?: string;
}): Promise<ResultadoSincronizacaoModulos> {
  const { competencia, companyId } = opts;
  validarCompetencia(competencia);
  if (!companyId) throw new ErroValidacaoFontes('companyId é obrigatório');

  const departmentId = opts.departmentId ?? null;
  const usuarioUuid = opts.usuarioId && UUID_RE.test(opts.usuarioId) ? opts.usuarioId : undefined;
  const sheet = await garantirSheetDraft(companyId, competencia, departmentId, usuarioUuid);

  // Sheet de um centro de custo → coleta restrita ao pessoal desse centro
  // (payroll_departments.name espelha gt_centros_custo.nome via sync-payroll-empresas).
  let centroCustoFiltro: string | undefined;
  if (departmentId) {
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('payroll_departments')
      .select('name')
      .eq('id', departmentId)
      .maybeSingle();
    if (deptError) throw new Error(`Erro ao carregar payroll_departments: ${deptError.message}`);
    centroCustoFiltro = dept?.name?.trim() || undefined;
  }

  const [escala, ferias] = await Promise.all([
    coletarRubricasEscala(competencia, { companyId, centroCusto: centroCustoFiltro }),
    coletarFerias(competencia, { companyId, centroCusto: centroCustoFiltro }),
  ]);

  const pendencias = [...escala.pendencias, ...ferias.pendencias];

  // Rubricas envolvidas → ids (códigos do seed; ausente vira pendência, não erro).
  const codigosNecessarios = [...new Set([...escala.itens, ...ferias.itens].map((i) => i.code))];
  const { data: codes, error: codesError } = await supabaseAdmin
    .from('payroll_codes')
    .select('id, code, name')
    .in('code', codigosNecessarios)
    .eq('is_active', true);
  if (codesError) throw new Error(`Erro ao carregar payroll_codes: ${codesError.message}`);

  const codeIdPorCodigo = new Map<string, string>();
  for (const c of codes || []) {
    if (!codeIdPorCodigo.has(c.code)) codeIdPorCodigo.set(c.code, c.id);
  }
  for (const code of codigosNecessarios) {
    if (!codeIdPorCodigo.has(code)) {
      pendencias.push({
        cpf: '',
        nome: `Rubrica ${code}`,
        motivo: `Rubrica ${code} inexistente/inativa em payroll_codes — itens desse código não lançados`,
      });
    }
  }

  // Employees por CPF (de novo aqui — resolve id + valida vínculo dos itens).
  const employees = await carregarEmployeesPorCpf(companyId);

  // Itens WK vigentes: precedência WK vence → gt com mesmo employee+code é descartado.
  const { data: itensWk, error: wkError } = await supabaseAdmin
    .from('payroll_sheet_items')
    .select('employee_id, code_id')
    .eq('sheet_id', sheet.id)
    .eq('origem', 'wk');
  if (wkError) throw new Error(`Erro ao ler itens WK da sheet: ${wkError.message}`);
  const chavesWk = new Set((itensWk || []).map((i) => `${i.employee_id}|${i.code_id}`));

  // 1) limpa o conjunto 'gt' anterior (base da idempotência).
  const { error: deleteError } = await supabaseAdmin
    .from('payroll_sheet_items')
    .delete()
    .eq('sheet_id', sheet.id)
    .eq('origem', 'gt');
  if (deleteError) throw new Error(`Erro ao limpar itens 'gt' da sheet: ${deleteError.message}`);

  // 2) grava os novos, aplicando precedência e listando pendências de CPF.
  const vistos = new Set<string>();
  const linhas: Array<{
    sheet_id: string;
    employee_id: string;
    code_id: string;
    quantity: number;
    reference_value: number;
    calculated_value: number;
    origem: 'gt';
  }> = [];

  let descartadosPrecedencia = 0;
  const avisosPrecedencia: string[] = [];

  for (const item of [...escala.itens, ...ferias.itens]) {
    const codeId = codeIdPorCodigo.get(item.code);
    if (!codeId) continue; // pendência já registrada acima
    const employee = employees.get(item.cpf);
    if (!employee) continue; // pendência já registrada na coleta

    const chave = `${employee.id}|${codeId}`;
    if (chavesWk.has(chave)) {
      descartadosPrecedencia += 1;
      avisosPrecedencia.push(`${item.nome} (${item.cpf}): rubrica ${item.code} já lançada pelo WK — item GT descartado`);
      continue;
    }
    if (vistos.has(chave)) continue; // dedupe intra-lote (escala+férias)
    vistos.add(chave);

    linhas.push({
      sheet_id: sheet.id,
      employee_id: employee.id,
      code_id: codeId,
      quantity: item.quantity,
      reference_value: item.referenceValue,
      calculated_value: item.calculatedValue,
      origem: 'gt',
    });
  }

  // INSERT paginado (PostgREST aceita grandes lotes, mas paginar evita payload gigante).
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500);
    const { error: insertItensError } = await supabaseAdmin
      .from('payroll_sheet_items')
      .insert(lote);
    if (insertItensError) throw new Error(`Erro ao inserir itens 'gt': ${insertItensError.message}`);
  }

  await auditarConsolidacao({
    sheetId: sheet.id,
    acao: 'UPDATE',
    usuarioId: usuarioUuid,
    detalhes: {
      competencia: { mes: competencia.mes, ano: competencia.ano },
      companyId,
      departmentId,
      inseridos: linhas.length,
      descartadosPrecedencia,
      totalPendencias: pendencias.length,
      pendencias,
      avisos: avisosPrecedencia,
      fontes: { escala: escala.itens.length, ferias: ferias.itens.length },
      periodo: escala.periodo,
    },
  });

  return {
    sheetId: sheet.id,
    inseridos: linhas.length,
    descartadosPrecedencia,
    pendencias,
    quadros: fundirQuadros([escala.quadros || [], ferias.quadros || []]),
  };
}
