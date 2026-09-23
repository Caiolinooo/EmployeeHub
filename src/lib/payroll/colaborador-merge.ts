/**
 * Ponto único de reconciliação de colaboradores na folha (design §3).
 *
 * Toda ingestão que grava em payroll_employees (GT, WK Radar API/XLSX/backup,
 * MIO, desligamento, cadastro manual) passa por aqui — nunca mais upsert
 * destrutivo nem insert duplicado por matrícula divergente.
 *
 * Regras (contrato FECHADO do design):
 * - Match: CPF normalizado (11 dígitos, strip \D) na mesma empresa; senão
 *   (company_id, registration_number).
 * - Merge ADITIVO: campo só é escrito se o atual é NULL/''/0 (salário: 0).
 *   Nunca sobrescreve valor existente não-vazio.
 * - Exceções de precedência (sempre atualizam quando a chave vem na entrada):
 *   data_demissao e status, apenas para fonte wk_* / desligamento (o WK é a
 *   fonte fiscal da rescisão; o desligamento é o canal oficial do GT).
 * - gt_colaborador_id preenche employee_id vazio (O VÍNCULO GT ↔ folha).
 * - Log por merge em payroll_audit_log (best-effort: falha de auditoria não
 *   desfaz o merge — mesmo padrão do sync WK).
 *
 * Observação: o contrato aceita email/data_nascimento, mas payroll_employees
 * não tem essas colunas — são ignoradas na persistência (vivem no GT).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCpf, normalizeCpf } from '@/lib/utils/identity';

export type FonteColaborador =
  | 'gt'
  | 'wk_api'
  | 'wk_xlsx'
  | 'wk_backup'
  | 'mio'
  | 'manual'
  | 'desligamento';

export interface ColaboradorFonte {
  company_id: string;
  registration_number?: string | null;
  cpf?: string | null;
  name?: string | null;
  email?: string | null;
  pis?: string | null;
  data_nascimento?: string | null;
  base_salary?: number | null;
  cargo?: string | null;
  departamento?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  gt_colaborador_id?: string | null; // vira employee_id (vínculo)
  [extra: string]: unknown;
}

export interface MergeResult {
  acao: 'criado' | 'merged' | 'intocado';
  id: string;
  campos_adicionados: string[];
}

/** Linha de payroll_employees lida para o match/merge. */
interface EmployeeRow {
  id: string;
  company_id: string;
  employee_id: string | null;
  department_id: string | null;
  registration_number: string | null;
  name: string | null;
  cpf: string | null;
  position: string | null;
  base_salary: number | null;
  admission_date: string | null;
  termination_date: string | null;
  status: string | null;
  pis_pasep: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  [col: string]: unknown;
}

/** Vazio para o merge aditivo: null/undefined/'' (trim) e 0 numérico. */
const vazio = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === 'string' && v.trim() === '') ||
  (typeof v === 'number' && v === 0);

/** Fonte com precedência fiscal de rescisão (design §3: "wk/desligamento"). */
const fonteComPrecedenciaRescisao = (fonte: FonteColaborador): boolean =>
  fonte === 'desligamento' || fonte.startsWith('wk');

/**
 * Campos aditivos simples: chave da entrada → coluna de payroll_employees.
 * Somente colunas que existem na tabela (DDL canônico + migrations).
 */
const CAMPOS_ADITIVOS: Array<{ chave: string; coluna: string }> = [
  { chave: 'registration_number', coluna: 'registration_number' },
  { chave: 'name', coluna: 'name' },
  { chave: 'pis', coluna: 'pis_pasep' },
  { chave: 'cargo', coluna: 'position' },
  { chave: 'data_admissao', coluna: 'admission_date' },
  { chave: 'department_id', coluna: 'department_id' },
  { chave: 'bank_code', coluna: 'bank_code' },
  { chave: 'bank_agency', coluna: 'bank_agency' },
  { chave: 'bank_account', coluna: 'bank_account' },
];

/** Busca o funcionário: 1º CPF normalizado (mais antigo em caso de duplicata), 2º matrícula. */
async function localizarEmployee(
  supabase: SupabaseClient,
  entrada: ColaboradorFonte,
  cpfDigits: string,
): Promise<EmployeeRow | null> {
  if (cpfDigits.length === 11) {
    // Tolerante à forma de armazenamento (dígitos puros ou com máscara).
    const { data, error } = await supabase
      .from('payroll_employees')
      .select('*')
      .eq('company_id', entrada.company_id)
      .in('cpf', [cpfDigits, formatCpf(cpfDigits)])
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw new Error(`payroll_employees (busca por CPF): ${error.message}`);
    const row = (data || [])[0] as EmployeeRow | undefined;
    if (row) return row;
  }

  const matricula = typeof entrada.registration_number === 'string'
    ? entrada.registration_number.trim()
    : '';
  if (matricula) {
    const { data, error } = await supabase
      .from('payroll_employees')
      .select('*')
      .eq('company_id', entrada.company_id)
      .eq('registration_number', matricula)
      .limit(1);
    if (error) throw new Error(`payroll_employees (busca por matrícula): ${error.message}`);
    const row = (data || [])[0] as EmployeeRow | undefined;
    if (row) return row;
  }

  return null;
}

/** Auditoria best-effort — falha não desfaz o merge (padrão gravarAuditoria do sync WK). */
async function gravarAuditoria(
  supabase: SupabaseClient,
  opts: {
    recordId: string;
    action: 'INSERT' | 'UPDATE';
    fonte: FonteColaborador;
    campos: string[];
    patch: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('payroll_audit_log').insert({
    table_name: 'payroll_employees',
    record_id: opts.recordId,
    action: opts.action,
    old_values: null,
    new_values: {
      origem_evento: 'colaborador_merge',
      fonte: opts.fonte,
      campos_adicionados: opts.campos,
      patch: opts.patch,
    },
    changed_by: null,
  });
  if (error) console.error('[colaborador-merge] auditoria não gravada (merge mantido):', error.message);
}

/**
 * Cria ou enriquece a ficha do colaborador em payroll_employees.
 * Idempotente: reexecutar com a mesma entrada retorna 'intocado'.
 */
export async function mergeColaborador(
  supabase: SupabaseClient,
  entrada: ColaboradorFonte,
  fonte: FonteColaborador,
): Promise<MergeResult> {
  if (!entrada?.company_id) {
    throw new Error('mergeColaborador: company_id é obrigatório');
  }

  const cpfDigits = normalizeCpf(String(entrada.cpf ?? ''));
  const existente = await localizarEmployee(supabase, entrada, cpfDigits);
  const precedenciaRescisao = fonteComPrecedenciaRescisao(fonte);

  if (existente) {
    const patch: Record<string, unknown> = {};

    // Aditivo simples: só preenche vazio.
    for (const { chave, coluna } of CAMPOS_ADITIVOS) {
      const novo = entrada[chave];
      if (vazio(existente[coluna]) && !vazio(novo)) {
        patch[coluna] = typeof novo === 'string' ? novo.trim() : novo;
      }
    }

    // CPF: só preenche quando o atual não tem 11 dígitos válidos.
    if (cpfDigits.length === 11 && normalizeCpf(String(existente.cpf ?? '')).length !== 11) {
      patch.cpf = formatCpf(cpfDigits);
    }

    // Salário: 0 na ficha é "sem dado"; valor positivo da fonte preenche.
    // Salário é dinheiro — nunca rebaixa nem zera um valor existente.
    const salarioAtual = Number(existente.base_salary) || 0;
    const salarioNovo = Number(entrada.base_salary) || 0;
    if (salarioAtual <= 0 && salarioNovo > 0) {
      patch.base_salary = salarioNovo;
    }

    // O VÍNCULO: employee_id vazio ← gt_colaboradores.id. Nunca zera/troca.
    if (vazio(existente.employee_id) && !vazio(entrada.gt_colaborador_id)) {
      patch.employee_id = entrada.gt_colaborador_id;
    }

    // Exceções de precedência (sempre atualizam para fonte wk/desligamento,
    // inclusive limpando: WK ativo sem demissão remove demissão stale).
    if (precedenciaRescisao) {
      if ('data_demissao' in entrada && entrada.data_demissao !== undefined) {
        patch.termination_date = entrada.data_demissao || null;
      }
      if ('status' in entrada && entrada.status !== undefined && entrada.status !== null) {
        patch.status = entrada.status;
      }
    } else {
      // Demais fontes: demissão/status seguem a regra aditiva normal.
      if (vazio(existente.termination_date) && !vazio(entrada.data_demissao)) {
        patch.termination_date = entrada.data_demissao;
      }
      if (vazio(existente.status) && !vazio(entrada.status)) {
        patch.status = entrada.status;
      }
    }

    const campos = Object.keys(patch);
    if (campos.length === 0) {
      return { acao: 'intocado', id: existente.id, campos_adicionados: [] };
    }

    patch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('payroll_employees')
      .update(patch)
      .eq('id', existente.id);
    if (error) throw new Error(`payroll_employees (merge ${existente.id}): ${error.message}`);

    await gravarAuditoria(supabase, {
      recordId: existente.id,
      action: 'UPDATE',
      fonte,
      campos,
      patch,
    });
    return { acao: 'merged', id: existente.id, campos_adicionados: campos };
  }

  // ---- criação ----
  const matricula = typeof entrada.registration_number === 'string'
    ? entrada.registration_number.trim()
    : '';
  const nome = (typeof entrada.name === 'string' ? entrada.name.trim() : '') ||
    (matricula ? `Colaborador ${matricula}` : '');
  if (!nome) {
    throw new Error('mergeColaborador: name (ou registration_number para fallback) é obrigatório para criar');
  }

  const statusEntrada = typeof entrada.status === 'string' && entrada.status.trim()
    ? entrada.status.trim()
    : null;
  const registro: Record<string, unknown> = {
    employee_id: vazio(entrada.gt_colaborador_id) ? null : entrada.gt_colaborador_id,
    company_id: entrada.company_id,
    department_id: vazio(entrada.department_id) ? null : entrada.department_id,
    registration_number: matricula || null,
    name: nome,
    cpf: cpfDigits.length === 11 ? formatCpf(cpfDigits) : (typeof entrada.cpf === 'string' && entrada.cpf.trim() ? entrada.cpf.trim() : null),
    position: vazio(entrada.cargo) ? null : String(entrada.cargo).trim(),
    base_salary: Number(entrada.base_salary) || 0,
    admission_date: entrada.data_admissao || null,
    termination_date: entrada.data_demissao || null,
    status: statusEntrada || (entrada.data_demissao ? 'terminated' : 'active'),
    pis_pasep: vazio(entrada.pis) ? null : String(entrada.pis).trim(),
    bank_code: vazio(entrada.bank_code) ? null : entrada.bank_code,
    bank_agency: vazio(entrada.bank_agency) ? null : entrada.bank_agency,
    bank_account: vazio(entrada.bank_account) ? null : entrada.bank_account,
  };

  const { data: criado, error } = await supabase
    .from('payroll_employees')
    .insert(registro)
    .select('id')
    .single();
  if (error || !criado?.id) {
    throw new Error(`payroll_employees (insert ${nome}): ${error?.message || 'sem id retornado'}`);
  }

  const campos = Object.entries(registro)
    .filter(([, v]) => !vazio(v))
    .map(([coluna]) => coluna);
  await gravarAuditoria(supabase, {
    recordId: criado.id as string,
    action: 'INSERT',
    fonte,
    campos,
    patch: registro,
  });
  return { acao: 'criado', id: criado.id as string, campos_adicionados: campos };
}
