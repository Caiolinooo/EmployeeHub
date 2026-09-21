/**
 * Sincronização WK Radar → tabelas payroll (pull-only, idempotente).
 *
 * Pipeline (uma passada, aborta ANTES de qualquer escrita quando precisa):
 *   1. coleta linhas — arquivo .xlsx (analisarWorkbook) ou Radar.API (allowlist);
 *   2. normaliza funcionários e lançamentos (normalize.ts);
 *   3. resolve payroll_codes por codigo_wk — faltante → ErroWkCodigosNaoMapeados
 *      (nada foi gravado; a rota vira 422 com a lista);
 *   4. garante sheet 'draft' da competência — approved/paid → ErroWkFolhaBloqueada (409);
 *   5. upsert de payroll_employees por UNIQUE(company_id, registration_number);
 *   6. DELETE itens origem='wk' da sheet + INSERT novos (re-sync idempotente,
 *      itens 'manual' e 'gt' sempre preservados);
 *   7. auditoria payroll_audit_log com origem_evento='wk_sync'.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { analisarWorkbook } from '@/lib/indicadores/xlsx-import';
import {
  ErroWkCredencial,
  WK_CANDIDATOS_FUNCIONARIOS,
  WK_CANDIDATOS_LANCAMENTOS,
  extrairListaWk,
  wkGet,
} from './api-client';
import {
  chavesCodigoWk,
  linhaPareceFuncionario,
  linhaPareceLancamento,
  mapearFuncionarios,
  mapearLancamentos,
  type WkFuncionario,
  type WkLancamento,
} from './normalize';

export { ErroWkCredencial };

/** Códigos WK sem rubrica mapeada no portal — aborta TUDO (rota → 422). */
export class ErroWkCodigosNaoMapeados extends Error {
  readonly codigosNaoMapeados: string[];

  constructor(codigos: string[]) {
    super(
      `Códigos WK sem rubrica mapeada no portal: ${codigos.join(', ')}. ` +
        'Preencha o campo "codigo_wk" na rubrica correspondente em /folha-pagamento ' +
        '(Configurações → Códigos) e sincronize novamente. Nada foi gravado.',
    );
    this.name = 'ErroWkCodigosNaoMapeados';
    this.codigosNaoMapeados = codigos;
  }
}

/** Sheet da competência em status que não aceita sync — rota → 409. */
export class ErroWkFolhaBloqueada extends Error {
  constructor(mes: number, ano: number, status: string) {
    super(
      `A folha ${String(mes).padStart(2, '0')}/${ano} está em status '${status}' e não ` +
        'aceita sincronização. Reabra para draft/calculated antes de sincronizar.',
    );
    this.name = 'ErroWkFolhaBloqueada';
  }
}

export interface CompetenciaWk {
  mes: number;
  ano: number;
}

export type EntradaSincronizarWk =
  | {
      fonte: 'api';
      competencia: CompetenciaWk;
      companyId: string;
      departmentId?: string | null;
      usuarioId?: string;
    }
  | {
      fonte: 'arquivo';
      competencia: CompetenciaWk;
      companyId: string;
      departmentId?: string | null;
      planilha: Buffer | ArrayBuffer;
      nomeArquivo?: string;
      usuarioId?: string;
    };

export interface ResultadoSincronizarWk {
  employeesUpsertados: number;
  itensCriados: number;
  sheetId: string;
  avisos: string[];
}

interface SheetRow {
  id: string;
  status: string;
  department_id: string | null;
}

interface CodigoMapeado {
  id: string;
  code: string;
  type: string;
  ativo: boolean;
}

const TAMANHO_CHUNK = 500;

function dividirEmChunks<T>(lista: T[], tamanho: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    chunks.push(lista.slice(i, i + tamanho));
  }
  return chunks;
}

/** Último dia civil do mês, local — 'YYYY-MM-DD'. */
function ultimoDiaDoMes(ano: number, mes: number): string {
  const data = new Date(ano, mes, 0);
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${String(mes).padStart(2, '0')}-${dia}`;
}

/** Validação de entrada comum (mensagem de erro ou null). */
function erroDeEntrada(companyId: string, competencia: CompetenciaWk): string | null {
  if (!companyId) return 'companyId é obrigatório';
  if (!Number.isInteger(competencia.mes) || competencia.mes < 1 || competencia.mes > 12) {
    return 'competencia.mes deve ser um inteiro entre 1 e 12';
  }
  if (!Number.isInteger(competencia.ano) || competencia.ano < 2024) {
    return 'competencia.ano deve ser um inteiro >= 2024';
  }
  return null;
}

/**
 * Coleta as linhas cruas (funcionários e lançamentos) da fonte.
 * Arquivo: abas com nome sugestivo vão inteiras; abas neutras caem na
 * detecção por linha. API: tenta os candidatos UNVERIFIED em ordem.
 */
async function coletarLinhas(
  entrada: EntradaSincronizarWk,
  avisos: string[],
): Promise<{ linhasFuncionarios: Array<Record<string, unknown>>; linhasLancamentos: Array<Record<string, unknown>> }> {
  if (entrada.fonte === 'arquivo') {
    const buffer = Buffer.isBuffer(entrada.planilha) ? entrada.planilha : Buffer.from(entrada.planilha);
    const analise = analisarWorkbook(buffer, { arquivoNome: entrada.nomeArquivo });
    if (analise.abas.length === 0) {
      avisos.push('Planilha sem abas com cabeçalho detectável — nada importado.');
    }

    const linhasFuncionarios: Array<Record<string, unknown>> = [];
    const linhasLancamentos: Array<Record<string, unknown>> = [];
    for (const aba of analise.abas) {
      const nomeAba = aba.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const sugereFuncionarios = /func|colab|empreg|pessoal/.test(nomeAba);
      const sugereLancamentos = /lanc|rubr|movim|evento|verba|folha/.test(nomeAba);
      for (const linha of aba.linhas) {
        if (sugereLancamentos && !sugereFuncionarios) linhasLancamentos.push(linha);
        else if (sugereFuncionarios && !sugereLancamentos) linhasFuncionarios.push(linha);
        else if (linhaPareceLancamento(linha)) linhasLancamentos.push(linha);
        else if (linhaPareceFuncionario(linha)) linhasFuncionarios.push(linha);
      }
    }
    return { linhasFuncionarios, linhasLancamentos };
  }

  // fonte 'api' — candidatos UNVERIFIED (ver WK_PULL_PATHS em api-client.ts)
  const queryCompetencia = {
    mes: entrada.competencia.mes,
    ano: entrada.competencia.ano,
    competencia: `${entrada.competencia.ano}-${String(entrada.competencia.mes).padStart(2, '0')}`,
  };

  const puxar = async (
    candidatos: string[],
    query: Record<string, string | number>,
    rotulo: string,
  ): Promise<Array<Record<string, unknown>>> => {
    const tentativas: string[] = [];
    for (const path of candidatos) {
      try {
        const json = await wkGet<unknown>(path, { query });
        const lista = extrairListaWk(json);
        if (lista.length > 0) return lista;
        tentativas.push(`${path}: resposta sem lista`);
      } catch (erro) {
        if (erro instanceof ErroWkCredencial) throw erro;
        tentativas.push(`${path}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
    avisos.push(
      `Nenhum endpoint de ${rotulo} retornou dados (paths UNVERIFIED — ajustar ` +
        `WK_PULL_PATHS conforme o swagger da instância). Tentativas: ${tentativas.join(' | ')}`,
    );
    return [];
  };

  const linhasFuncionarios = await puxar(WK_CANDIDATOS_FUNCIONARIOS, {}, 'funcionários');
  const linhasLancamentos = await puxar(WK_CANDIDATOS_LANCAMENTOS, queryCompetencia, 'lançamentos da competência');
  return { linhasFuncionarios, linhasLancamentos };
}

/**
 * Resolve os códigos WK contra payroll_codes.codigo_wk. Busca por todas as
 * chaves tolerantes (cru, só dígitos, sem zeros à esquerda). Códigos ausentes
 * → ErroWkCodigosNaoMapeados (chamado ANTES de qualquer escrita).
 */
async function resolverCodigosWk(lancamentos: WkLancamento[]): Promise<Map<string, CodigoMapeado>> {
  const distintos = [...new Set(lancamentos.map((l) => l.codigoWk))].filter(Boolean);
  const mapa = new Map<string, CodigoMapeado>();
  if (distintos.length === 0) return mapa;

  const chavesBusca = [...new Set(distintos.flatMap((codigo) => chavesCodigoWk(codigo)))];
  const { data, error } = await supabaseAdmin
    .from('payroll_codes')
    .select('id, code, type, is_active, codigo_wk')
    .in('codigo_wk', chavesBusca);
  if (error) throw new Error(`Falha ao consultar payroll_codes: ${error.message}`);

  for (const linha of (data || []) as Array<Record<string, unknown>>) {
    const codigoWk = typeof linha.codigo_wk === 'string' ? linha.codigo_wk : null;
    if (!codigoWk || typeof linha.id !== 'string') continue;
    const mapeado: CodigoMapeado = {
      id: linha.id,
      code: String(linha.code ?? ''),
      type: String(linha.type ?? ''),
      ativo: linha.is_active !== false,
    };
    for (const chave of chavesCodigoWk(codigoWk)) {
      mapa.set(chave, mapeado);
    }
  }

  const faltantes = distintos.filter((codigo) => !chavesCodigoWk(codigo).some((k) => mapa.has(k)));
  if (faltantes.length > 0) throw new ErroWkCodigosNaoMapeados(faltantes);
  return mapa;
}

/**
 * Garante a sheet da competência (UNIQUE company+mês+ano). Preferência:
 * department_id igual → sheet sem departamento → primeira existente.
 * approved/paid → ErroWkFolhaBloqueada. Inexistente → INSERT 'draft'.
 */
async function garantirSheet(
  companyId: string,
  departmentId: string | null | undefined,
  competencia: CompetenciaWk,
): Promise<{ sheet: SheetRow; criada: boolean }> {
  const { mes, ano } = competencia;
  const { data, error } = await supabaseAdmin
    .from('payroll_sheets')
    .select('id, status, department_id')
    .eq('company_id', companyId)
    .eq('reference_month', mes)
    .eq('reference_year', ano);
  if (error) throw new Error(`Falha ao consultar payroll_sheets: ${error.message}`);

  const existentes = (data || []) as SheetRow[];
  const dept = departmentId ?? null;
  const alvo =
    existentes.find((s) => (s.department_id ?? null) === dept) ||
    existentes.find((s) => !s.department_id) ||
    existentes[0];

  if (alvo) {
    if (alvo.status === 'approved' || alvo.status === 'paid') {
      throw new ErroWkFolhaBloqueada(mes, ano, alvo.status);
    }
    return { sheet: alvo, criada: false };
  }

  const { data: criada, error: erroInsert } = await supabaseAdmin
    .from('payroll_sheets')
    .insert({
      company_id: companyId,
      department_id: dept,
      reference_month: mes,
      reference_year: ano,
      period_start: `${ano}-${String(mes).padStart(2, '0')}-01`,
      period_end: ultimoDiaDoMes(ano, mes),
      status: 'draft',
    })
    .select('id, status, department_id')
    .single();
  if (erroInsert || !criada) {
    // Corrida com outro sync: unique estourou → reconsulta.
    const { data: apos } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id, status, department_id')
      .eq('company_id', companyId)
      .eq('reference_month', mes)
      .eq('reference_year', ano)
      .limit(1);
    const existente = ((apos || []) as SheetRow[])[0];
    if (existente) return { sheet: existente, criada: false };
    throw new Error(`Falha ao criar a folha da competência: ${erroInsert?.message || 'sem retorno'}`);
  }
  return { sheet: criada as SheetRow, criada: true };
}

/**
 * Grava os funcionários no payroll_employees. Com matrícula → upsert batch
 * por UNIQUE(company_id, registration_number). Sem matrícula → casa por CPF
 * com funcionário existente (update); sem correspondência → aviso, nunca
 * inventa matrícula. Retorna quantidade gravada.
 */
async function upsertFuncionarios(
  funcionarios: WkFuncionario[],
  companyId: string,
  departmentId: string | null | undefined,
  avisos: string[],
): Promise<number> {
  if (funcionarios.length === 0) return 0;

  const agora = new Date().toISOString();
  const dept = departmentId ?? null;
  const porMatricula = new Map<string, Record<string, unknown>>();
  for (const f of funcionarios) {
    if (!f.matricula) continue;
    porMatricula.set(f.matricula.trim(), {
      company_id: companyId,
      department_id: dept,
      registration_number: f.matricula.trim(),
      name: f.nome || `Colaborador ${f.matricula.trim()}`,
      cpf: f.cpf,
      position: f.cargo,
      base_salary: f.salarioBase,
      admission_date: f.admissao,
      termination_date: f.demissao,
      status: f.status,
      updated_at: agora,
    });
  }

  let gravados = 0;
  for (const chunk of dividirEmChunks([...porMatricula.values()], TAMANHO_CHUNK)) {
    const { error } = await supabaseAdmin
      .from('payroll_employees')
      .upsert(chunk, { onConflict: 'company_id,registration_number' });
    if (error) throw new Error(`Falha ao gravar funcionários (payroll_employees): ${error.message}`);
    gravados += chunk.length;
  }

  const semMatricula = funcionarios.filter((f) => !f.matricula && f.cpf);
  for (const f of semMatricula) {
    const { data: existente, error } = await supabaseAdmin
      .from('payroll_employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('cpf', f.cpf as string)
      .limit(1);
    if (error) throw new Error(`Falha ao buscar funcionário por CPF: ${error.message}`);
    const linha = (existente || [])[0] as { id?: string } | undefined;
    if (!linha?.id) {
      const mascaraCpf = f.cpf ? `***${f.cpf.slice(-3)}` : '?';
      avisos.push(
        `Funcionário '${f.nome}' (CPF ${mascaraCpf}) sem matrícula WK e sem correspondência por CPF — não gravado.`,
      );
      continue;
    }
    const { error: erroUpdate } = await supabaseAdmin
      .from('payroll_employees')
      .update({
        department_id: dept,
        name: f.nome,
        position: f.cargo,
        base_salary: f.salarioBase,
        admission_date: f.admissao,
        termination_date: f.demissao,
        status: f.status,
        updated_at: agora,
      })
      .eq('id', linha.id);
    if (erroUpdate) throw new Error(`Falha ao atualizar funcionário por CPF: ${erroUpdate.message}`);
    gravados += 1;
  }

  return gravados;
}

/** Índices de funcionários da empresa por matrícula e por CPF (para os lançamentos). */
async function indexarFuncionarios(
  companyId: string,
): Promise<{ porMatricula: Map<string, string>; porCpf: Map<string, string> }> {
  const { data, error } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, registration_number, cpf')
    .eq('company_id', companyId);
  if (error) throw new Error(`Falha ao indexar payroll_employees: ${error.message}`);

  const porMatricula = new Map<string, string>();
  const porCpf = new Map<string, string>();
  for (const linha of (data || []) as Array<Record<string, unknown>>) {
    if (typeof linha.id !== 'string') continue;
    if (typeof linha.registration_number === 'string' && linha.registration_number.trim()) {
      porMatricula.set(linha.registration_number.trim().toUpperCase(), linha.id);
    }
    if (typeof linha.cpf === 'string' && linha.cpf.trim()) {
      porCpf.set(linha.cpf.replace(/\D/g, ''), linha.id);
    }
  }
  return { porMatricula, porCpf };
}

/** Auditoria do sync — payroll_audit_log com origem_evento='wk_sync' (best-effort: falha não desfaz o sync). */
async function gravarAuditoria(opts: {
  sheetId: string;
  criada: boolean;
  fonte: 'api' | 'arquivo';
  competencia: CompetenciaWk;
  employeesUpsertados: number;
  itensCriados: number;
  avisos: string[];
  usuarioId?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('payroll_audit_log').insert({
    table_name: 'payroll_sheets',
    record_id: opts.sheetId,
    action: opts.criada ? 'INSERT' : 'UPDATE',
    old_values: null,
    new_values: {
      origem_evento: 'wk_sync',
      fonte: opts.fonte,
      competencia: opts.competencia,
      employees_upsertados: opts.employeesUpsertados,
      itens_criados: opts.itensCriados,
      avisos: opts.avisos,
      por: opts.usuarioId ?? null,
    },
    changed_by: opts.usuarioId ?? null,
  });
  if (error) console.error('[WK sync] auditoria não gravada (sync mantido):', error.message);
}

/**
 * Sincroniza a WK Radar para a competência (contrato 2). Idempotente:
 * re-executar apaga só itens origem='wk' da sheet e re-insere; itens
 * 'manual' e 'gt' nunca são tocados; employees são upsert por chave única.
 */
export async function sincronizarWk(entrada: EntradaSincronizarWk): Promise<ResultadoSincronizarWk> {
  const avisos: string[] = [];
  const erroEntrada = erroDeEntrada(entrada.companyId, entrada.competencia);
  if (erroEntrada) throw new Error(erroEntrada);

  // 1-2. Coleta + normalização (antes de qualquer escrita).
  const { linhasFuncionarios, linhasLancamentos } = await coletarLinhas(entrada, avisos);
  const mapeioFuncionarios = mapearFuncionarios(linhasFuncionarios);
  const mapeioLancamentos = mapearLancamentos(linhasLancamentos);
  if (mapeioFuncionarios.ignoradas > 0) {
    avisos.push(`${mapeioFuncionarios.ignoradas} linha(s) de funcionário ignorada(s) por falta de nome ou matrícula/CPF.`);
  }
  if (mapeioLancamentos.ignoradas > 0) {
    avisos.push(`${mapeioLancamentos.ignoradas} linha(s) de lançamento ignorada(s) por falta de código WK ou matrícula/CPF.`);
  }
  if (mapeioFuncionarios.registros.length === 0 && mapeioLancamentos.registros.length === 0) {
    avisos.push('Nenhum funcionário ou lançamento reconhecido na fonte — nada a gravar além da sheet.');
  }

  // 3. Códigos resolvidos antes de tocar no banco — 422 aborta sem gravar nada.
  const codigos = await resolverCodigosWk(mapeioLancamentos.registros);
  for (const [chave, codigo] of codigos) {
    if (!codigo.ativo) avisos.push(`Rubrica ${codigo.code} (${codigo.type}) mapeada por codigo_wk '${chave}' está inativa.`);
  }

  // 4. Sheet draft da competência — 409 se approved/paid.
  const { sheet, criada } = await garantirSheet(entrada.companyId, entrada.departmentId, entrada.competencia);

  // 5. Funcionários.
  const employeesUpsertados = await upsertFuncionarios(
    mapeioFuncionarios.registros,
    entrada.companyId,
    entrada.departmentId,
    avisos,
  );
  const { porMatricula, porCpf } = await indexarFuncionarios(entrada.companyId);

  // 6. Itens: DELETE só origem='wk', INSERT novos.
  const { error: erroDelete } = await supabaseAdmin
    .from('payroll_sheet_items')
    .delete()
    .eq('sheet_id', sheet.id)
    .eq('origem', 'wk');
  if (erroDelete) throw new Error(`Falha ao limpar itens WK anteriores da folha: ${erroDelete.message}`);

  const itens: Array<Record<string, unknown>> = [];
  for (const l of mapeioLancamentos.registros) {
    const codigo = chavesCodigoWk(l.codigoWk)
      .map((chave) => codigos.get(chave))
      .find(Boolean);
    if (!codigo) continue; // inalcançável (422 antes), proteção defensiva
    const employeeId =
      (l.matricula ? porMatricula.get(l.matricula.trim().toUpperCase()) : undefined) ??
      (l.cpf ? porCpf.get(l.cpf) : undefined);
    if (!employeeId) {
      avisos.push(
        `Lançamento da rubrica WK '${l.codigoWk}' para '${l.matricula || l.cpf}' sem funcionário na folha — ignorado.`,
      );
      continue;
    }
    const valor = Math.round(l.valor * 100) / 100;
    itens.push({
      sheet_id: sheet.id,
      employee_id: employeeId,
      code_id: codigo.id,
      quantity: l.quantidade,
      reference_value: valor,
      calculated_value: Math.round(l.quantidade * valor * 100) / 100,
      observation: l.observacao,
      origem: 'wk',
    });
  }

  let itensCriados = 0;
  for (const chunk of dividirEmChunks(itens, TAMANHO_CHUNK)) {
    const { error } = await supabaseAdmin.from('payroll_sheet_items').insert(chunk);
    if (error) throw new Error(`Falha ao gravar itens da folha (origem 'wk'): ${error.message}`);
    itensCriados += chunk.length;
  }

  // 7. Auditoria.
  await gravarAuditoria({
    sheetId: sheet.id,
    criada,
    fonte: entrada.fonte,
    competencia: entrada.competencia,
    employeesUpsertados,
    itensCriados,
    avisos,
    usuarioId: entrada.usuarioId,
  });

  return { employeesUpsertados, itensCriados, sheetId: sheet.id, avisos };
}
