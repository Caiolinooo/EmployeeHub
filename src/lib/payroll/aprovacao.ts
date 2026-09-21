/**
 * Aprovação da Folha de Pagamento — fechamento GT v2 clonado sobre
 * `payroll_sheets.aprovacao` (JSONB, NULL = não iniciada).
 *
 * Mesmo formato/fluxo de `src/lib/gestao-tripulantes/fechamento-assinatura.ts`:
 *   - lista nominada de aprovadores (AprovadorObrigatorio) OU fallback gestor
 *     (ADMIN/MANAGER) quando a lista fica vazia;
 *   - cada assinatura recebe carimbo SHA-256 (mesmo formato GT: prefixo,
 *     identificação do signatário e carimbo de data/IP);
 *   - 100% das assinaturas → sheet `status='approved'` + approved_by/approved_at
 *     (CHECK existente de status é respeitado: draft → calculated → approved);
 *   - rejeição → `aprovacao.rejeicao` e a sheet permanece `'calculated'`;
 *     reenvio (iniciarAprovacaoSheet de novo) limpa a rejeição e zera assinaturas.
 *
 * Auditoria: payroll_audit_log (table_name='payroll_sheets', action='UPDATE',
 * new_values.origem_evento = 'assinatura' | 'aprovacao' | 'rejeicao').
 *
 * Esta lib é server-side pura (supabaseAdmin) — as rotas apenas fazem o gate
 * `garantirNivelPayroll` e adaptam HTTP ↔ funções.
 */
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/utils/identity';
import {
  avaliarAssinaturasFechamento,
  displayNameFromUser,
  mesclarAssinaturaFechamento,
  mensagemErroAssinaturaNegada,
  normalizeAprovadoresObrigatorios,
  podeAssinarFechamento,
  type AprovadorObrigatorio,
  type AssinaturaFechamento,
  type PortalUserNameRow,
  type ResultadoPodeAssinarFechamento,
} from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarAprovadoresConfig,
  setorEhDP,
  setorTemModuloFolha,
  type AprovadorFolhaConfig,
} from '@/lib/payroll/payroll-auth';

// ==================== Tipos ====================

/** Guard estrutural (padrão evaluation-settings.ts) — preserva narrowing. */
function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

/** Rejeição registrada no JSONB `aprovacao` da sheet. */
export interface RejeicaoFolha {
  por: string;
  motivo: string;
  em: string;
}

/** Estado completo de aprovação persistido em `payroll_sheets.aprovacao`. */
export interface AprovacaoFolha {
  aprovadores: AprovadorObrigatorio[];
  assinaturas: AssinaturaFechamento[];
  rejeicao?: RejeicaoFolha;
  hash?: string;
}

/** Linha bruta (snake_case) de payroll_sheets relevante para aprovação. */
export interface PayrollSheetDbRow {
  id: string;
  company_id: string | null;
  department_id: string | null;
  reference_month: number;
  reference_year: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  approved_by: string | null;
  approved_at: string | null;
  aprovacao: unknown;
}

/** Erro de negócio com status HTTP mapeável — rotas transformam em resposta. */
export class ErroAprovacaoFolha extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'ErroAprovacaoFolha';
    this.status = status;
  }
}

/** Normaliza o JSONB `aprovacao` da sheet para AprovacaoFolha. */
export function normalizarAprovacaoFolha(raw: unknown): AprovacaoFolha | null {
  if (!ehRegistro(raw)) return null;
  const aprovadores = normalizeAprovadoresObrigatorios(raw.aprovadores);
  const assinaturas = Array.isArray(raw.assinaturas)
    ? (raw.assinaturas.filter(
        (s): s is AssinaturaFechamento => ehRegistro(s),
      ) as AssinaturaFechamento[])
    : [];
  if (!ehRegistro(raw.rejeicao)) {
    return {
      aprovadores,
      assinaturas,
      ...(typeof raw.hash === 'string' && raw.hash ? { hash: raw.hash } : {}),
    };
  }
  const rejeicao: RejeicaoFolha = {
    por: String(raw.rejeicao.por || ''),
    motivo: String(raw.rejeicao.motivo || ''),
    em: String(raw.rejeicao.em || ''),
  };
  return {
    aprovadores,
    assinaturas,
    rejeicao,
    ...(typeof raw.hash === 'string' && raw.hash ? { hash: raw.hash } : {}),
  };
}

// ==================== Hash (mesmo formato do fechamento GT) ====================

function sha256Hex(valor: string): string {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

/**
 * SHA-256 no mesmo formato do fechamento GT
 * (`PREFIXO:competencia:nome:cpf:dataIso:ip:fingerprint` → hex):
 * - fingerprint = SHA-256 dos itens + totais da sheet (integridade do conteúdo);
 * - `assinaturaHash` de cada signatário e `aprovacao.hash` final (100%) usam
 *   esta função, variando o prefixo.
 */
export function montarHashSheet(input: {
  sheet: Pick<PayrollSheetDbRow, 'id' | 'reference_month' | 'reference_year'>;
  itens: Array<{
    employee_id?: string | null;
    code_id?: string | null;
    quantity?: number | null;
    calculated_value?: number | null;
  }>;
  totais?: { total_gross?: number | null; total_deductions?: number | null; total_net?: number | null } | null;
  nome: string;
  cpf: string;
  dataIso: string;
  ip: string;
  /** Prefixo do carimbo: 'PAYROLL_FOLHA' (assinatura) ou outro (ex.: fechada). */
  prefixo?: string;
}): string {
  const prefixo = input.prefixo || 'PAYROLL_FOLHA';
  const competencia = `${String(input.sheet.reference_month).padStart(2, '0')}/${input.sheet.reference_year}`;
  const fingerprint = sha256Hex(
    JSON.stringify({ itens: input.itens || [], totais: input.totais || null }),
  );
  const cpf = normalizeCpf(input.cpf || '') || (input.cpf || '');
  const base = `${prefixo}:${competencia}:${input.sheet.id}:${input.nome}:${cpf}:${input.dataIso}:${input.ip}:${fingerprint}`;
  return sha256Hex(base);
}

// ==================== Ator / aprovadores ====================

const PORTAL_USER_SELECT = 'id, first_name, last_name, name, email, role, tax_id, signature_url, active';

/** Linha do select acima — mesmas colunas (boundary Supabase). */
interface AtorDbRow extends PortalUserNameRow {
  id: string;
  role?: string | null;
  tax_id?: string | null;
  signature_url?: string | null;
}

interface AtorFolha {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  role: string;
  signatureUrl: string;
}

/** Carrega o usuário do portal (nome/email/cpf) — padrão loadFechamentoAtor. */
async function carregarAtorFolha(userId: string): Promise<AtorFolha> {
  if (!userId) throw new ErroAprovacaoFolha('Usuário não identificado', 401);
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(PORTAL_USER_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) {
    throw new ErroAprovacaoFolha('Usuário do portal não encontrado', 401);
  }
  const row = data as AtorDbRow; // colunas exatas do select acima
  return {
    id: row.id,
    nome: displayNameFromUser(row),
    email: String(row.email || '').trim().toLowerCase(),
    cpf: row.tax_id || '',
    role: String(row.role || ''),
    signatureUrl: row.signature_url || '',
  };
}

/**
 * Monta a lista de aprovadores da sheet:
 * 1. config `payroll_aprovadores_config` (tabela settings) — fonte canônica;
 * 2. default vazio → usuários ADMIN + usuários de setor DP-like com
 *    'folha'/'dp' nos allowed_modules (mesma regra de fallback do gate).
 */
export async function montarAprovadoresFolha(): Promise<AprovadorObrigatorio[]> {
  const config = await carregarAprovadoresConfig();

  if (config.length === 0) {
    return montarAprovadoresDefault();
  }

  return aprovadoresFromConfig(config);
}

/** Config nomeada → AprovadorObrigatorio, completando email pela users_unified. */
async function aprovadoresFromConfig(config: AprovadorFolhaConfig[]): Promise<AprovadorObrigatorio[]> {
  const ids = config.map((c) => c.user_id);
  const { data: users } = await supabaseAdmin
    .from('users_unified')
    .select('id, first_name, last_name, name, email')
    .in('id', ids);

  const linhas = (users || []) as UsuarioBasicoRow[]; // colunas exatas do select acima
  const emailById = new Map<string, string>();
  for (const u of linhas) {
    emailById.set(u.id, String(u.email || '').trim().toLowerCase());
  }

  const brutos = config
    .slice()
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
    .map((c) => ({
      id: c.user_id,
      nome: c.nome || 'Aprovador',
      email: emailById.get(c.user_id) || '',
    }));

  return normalizeAprovadoresObrigatorios(brutos);
}

/** Colunas mínimas de users_unified para montar aprovadores (boundary Supabase). */
interface UsuarioBasicoRow extends PortalUserNameRow {
  id: string;
  role?: string | null;
  sector_id?: string | null;
  active?: boolean | null;
}

/** Colunas de sectors para o fallback DP-like. */
interface SetorRow {
  id: string;
  name?: string | null;
  allowed_modules?: unknown;
}

/** Default sem config: ADMIN + setores DP-like com módulo folha/dp. */
async function montarAprovadoresDefault(): Promise<AprovadorObrigatorio[]> {
  const [usersRes, sectorsRes] = await Promise.all([
    supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, name, email, role, sector_id, active')
      .eq('active', true),
    supabaseAdmin.from('sectors').select('id, name, allowed_modules'),
  ]);

  const linhasSetores = (sectorsRes.data || []) as SetorRow[]; // colunas do select acima
  const setorInfo = new Map<string, { nome: string; allowed: unknown }>();
  for (const s of linhasSetores) {
    setorInfo.set(s.id, { nome: String(s.name || ''), allowed: s.allowed_modules });
  }

  const linhasUsuarios = (usersRes.data || []) as UsuarioBasicoRow[];
  const vistos = new Set<string>();
  const brutos: Array<{ id: string; nome: string; email: string }> = [];
  for (const u of linhasUsuarios) {
    if (!u.id || vistos.has(u.id)) continue;
    const role = String(u.role || '').toUpperCase();
    const setor = u.sector_id ? setorInfo.get(u.sector_id) : undefined;
    const ehDpSetor = Boolean(setor && setorEhDP(setor.nome) && setorTemModuloFolha(setor.allowed));
    if (role !== 'ADMIN' && !ehDpSetor) continue;
    vistos.add(u.id);
    brutos.push({
      id: u.id,
      nome: displayNameFromUser(u),
      email: String(u.email || '').trim().toLowerCase(),
    });
  }

  return normalizeAprovadoresObrigatorios(brutos);
}

// ==================== Autorização ====================

/**
 * Quem pode assinar/rejeitar: mesma regra do fechamento — lista nominada vale
 * por id/email; lista vazia exige role de gestor (ADMIN/MANAGER).
 */
export function podeAssinarSheet(
  ator: { userId?: string; email?: string; role?: string | null },
  aprovacao: AprovacaoFolha,
): ResultadoPodeAssinarFechamento {
  return podeAssinarFechamento(aprovacao.aprovadores, ator);
}

// ==================== Auditoria ====================

export type OrigemEventoFolha = 'wk_sync' | 'consolidacao' | 'assinatura' | 'rejeicao' | 'aprovacao';

/** Grava evento em payroll_audit_log (padrão do plano: sheet + origem_evento). */
export async function gravarAuditoriaFolha(input: {
  sheetId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  origemEvento: OrigemEventoFolha;
  changedBy?: string | null;
  newValues?: Record<string, unknown>;
  oldValues?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from('payroll_audit_log').insert({
      table_name: 'payroll_sheets',
      record_id: input.sheetId,
      action: input.action,
      old_values: input.oldValues ?? null,
      new_values: { ...(input.newValues || {}), origem_evento: input.origemEvento },
      changed_by: input.changedBy || null,
    });
  } catch (err) {
    // Auditoria é best-effort: nunca bloqueia o fluxo de negócio.
    console.error('[payroll] falha ao gravar payroll_audit_log (best-effort):', err);
  }
}

// ==================== Estado / fluxo ====================

async function carregarSheet(sheetId: string): Promise<PayrollSheetDbRow> {
  const { data, error } = await supabaseAdmin
    .from('payroll_sheets')
    .select(
      'id, company_id, department_id, reference_month, reference_year, status, total_gross, total_deductions, total_net, approved_by, approved_at, aprovacao',
    )
    .eq('id', sheetId)
    .maybeSingle();
  if (error || !data) {
    throw new ErroAprovacaoFolha('Folha de pagamento não encontrada', 404);
  }
  return data as PayrollSheetDbRow;
}

/** Itens + totais da sheet para o fingerprint do hash (ordem determinística). */
async function carregarItensParaHash(sheetId: string) {
  const { data: itens } = await supabaseAdmin
    .from('payroll_sheet_items')
    .select('employee_id, code_id, quantity, calculated_value')
    .eq('sheet_id', sheetId)
    .order('employee_id')
    .order('code_id');
  return (itens || []) as Array<{
    employee_id: string | null;
    code_id: string | null;
    quantity: number | null;
    calculated_value: number | null;
  }>;
}

function exigirCalculada(sheet: PayrollSheetDbRow): void {
  if (sheet.status === 'approved') {
    throw new ErroAprovacaoFolha('Esta folha já está aprovada.');
  }
  if (sheet.status !== 'calculated') {
    throw new ErroAprovacaoFolha(
      'A folha precisa estar no status "calculated" para entrar em aprovação. Calcule a folha primeiro.',
    );
  }
}

/** Estado completo para GET/Modal: sheet + aprovação + faltantes. */
export async function carregarEstadoAprovacao(sheetId: string): Promise<{
  sheet: PayrollSheetDbRow;
  aprovacao: AprovacaoFolha | null;
  pendentes: AprovadorObrigatorio[];
  assinados: number;
  obrigatorios: number;
  todosAssinaram: boolean;
  aprovado: boolean;
}> {
  const sheet = await carregarSheet(sheetId);
  const aprovacao = normalizarAprovacaoFolha(sheet.aprovacao);
  if (!aprovacao) {
    return {
      sheet,
      aprovacao: null,
      pendentes: [],
      assinados: 0,
      obrigatorios: 0,
      todosAssinaram: false,
      aprovado: sheet.status === 'approved',
    };
  }
  const { todosAssinaram, pendentes } = avaliarAssinaturasFechamento(
    aprovacao.aprovadores,
    aprovacao.assinaturas,
  );
  return {
    sheet,
    aprovacao,
    pendentes,
    assinados: aprovacao.assinaturas.length,
    obrigatorios: aprovacao.aprovadores.length,
    todosAssinaram,
    aprovado: sheet.status === 'approved',
  };
}

/**
 * Inicia (ou reinicia) a aprovação da sheet:
 * - exige status 'calculated' (rejeição mantém calculated, então reenvio funciona);
 * - grava `aprovacao` com aprovadores da config (ou default ADMIN/DP), assinaturas
 *   zeradas e sem rejeição — reenvio limpa tudo;
 * - auditoria com origem_evento 'assinatura'.
 */
export async function iniciarAprovacaoSheet(
  sheetId: string,
  usuario: { userId: string },
): Promise<AprovacaoFolha> {
  const sheet = await carregarSheet(sheetId);
  exigirCalculada(sheet);

  const aprovadores = await montarAprovadoresFolha();
  const aprovacao: AprovacaoFolha = { aprovadores, assinaturas: [] };

  const { error } = await supabaseAdmin
    .from('payroll_sheets')
    .update({ aprovacao, updated_at: new Date().toISOString() })
    .eq('id', sheetId);
  if (error) {
    throw new ErroAprovacaoFolha(`Falha ao iniciar aprovação: ${error.message}`, 500);
  }

  await gravarAuditoriaFolha({
    sheetId,
    action: 'UPDATE',
    origemEvento: 'assinatura',
    changedBy: usuario.userId,
    newValues: {
      acao: 'iniciar_aprovacao',
      aprovadores,
      status: sheet.status,
    },
    oldValues: { aprovacao: sheet.aprovacao ?? null },
  });

  return aprovacao;
}

/**
 * Registra a assinatura do usuário na sheet:
 * - exige status 'calculated' e ausência de rejeição (reinicie a aprovação);
 * - autorização via podeAssinarSheet (lista nominada ou fallback gestor);
 * - cada assinatura recebe carimbo SHA-256 sobre itens+totais da sheet;
 * - 100% → status 'approved' + approved_by/approved_at + aprovacao.hash final
 *   (evento final 'aprovacao' auditado além do 'assinatura' por assinatura).
 */
export async function assinarSheet(
  sheetId: string,
  opts: {
    userId: string;
    role?: string;
    signatureUrl?: string;
    ip?: string;
  },
): Promise<{
  aprovacao: AprovacaoFolha;
  aprovado: boolean;
  pendentes: AprovadorObrigatorio[];
  hash: string;
}> {
  const sheet = await carregarSheet(sheetId);
  exigirCalculada(sheet);

  const aprovacaoAtual = normalizarAprovacaoFolha(sheet.aprovacao);
  if (!aprovacaoAtual) {
    throw new ErroAprovacaoFolha('Aprovação não iniciada para esta folha.');
  }
  if (aprovacaoAtual.rejeicao) {
    throw new ErroAprovacaoFolha(
      'Esta folha foi rejeitada. Reinicie a aprovação antes de assinar novamente.',
    );
  }

  const ator = await carregarAtorFolha(opts.userId);
  const autorizacao = podeAssinarSheet(
    { userId: ator.id, email: ator.email, role: opts.role ?? ator.role },
    aprovacaoAtual,
  );
  if (!autorizacao.permitido) {
    throw new ErroAprovacaoFolha(mensagemErroAssinaturaNegada(autorizacao.motivo), 403);
  }

  if (aprovacaoAtual.assinaturas.some((s) => String(s.userId || '') === ator.id)) {
    throw new ErroAprovacaoFolha('Você já assinou esta folha.');
  }

  const ip = opts.ip || 'internal';
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const [itens] = await Promise.all([carregarItensParaHash(sheetId)]);
  const signatureHash = montarHashSheet({
    sheet,
    itens,
    totais: {
      total_gross: sheet.total_gross,
      total_deductions: sheet.total_deductions,
      total_net: sheet.total_net,
    },
    nome: ator.nome,
    cpf: ator.cpf,
    dataIso: agoraIso,
    ip,
  });

  const novaAssinatura: AssinaturaFechamento = {
    userId: ator.id,
    email: ator.email,
    nome: ator.nome,
    cpf: ator.cpf,
    cargo: ator.role || 'Aprovador',
    role: ator.role,
    assinado_em: agoraIso,
    dataHora: agora.toLocaleString('pt-BR'),
    ip,
    assinaturaUrl: opts.signatureUrl || ator.signatureUrl || '',
    assinaturaHash: signatureHash,
  };

  const assinaturas = mesclarAssinaturaFechamento(aprovacaoAtual.assinaturas, novaAssinatura);
  const { todosAssinaram, pendentes } = avaliarAssinaturasFechamento(
    aprovacaoAtual.aprovadores,
    assinaturas,
  );

  if (!todosAssinaram) {
    const aprovacaoParcial: AprovacaoFolha = { ...aprovacaoAtual, assinaturas };
    const { error } = await supabaseAdmin
      .from('payroll_sheets')
      .update({ aprovacao: aprovacaoParcial, updated_at: agoraIso })
      .eq('id', sheetId);
    if (error) {
      throw new ErroAprovacaoFolha(`Falha ao registrar assinatura: ${error.message}`, 500);
    }
    await gravarAuditoriaFolha({
      sheetId,
      action: 'UPDATE',
      origemEvento: 'assinatura',
      changedBy: ator.id,
      newValues: {
        acao: 'assinar',
        assinado_por: ator.nome,
        assinados: assinaturas.length,
        obrigatorios: aprovacaoAtual.aprovadores.length,
        pendentes: pendentes.map((p) => p.nome),
      },
    });
    return {
      aprovacao: aprovacaoParcial,
      aprovado: false,
      pendentes,
      hash: signatureHash,
    };
  }

  // 100% — fecha a aprovação: hash final sobre assinaturas + conteúdo.
  const hashFinal = montarHashSheet({
    sheet,
    itens,
    totais: {
      total_gross: sheet.total_gross,
      total_deductions: sheet.total_deductions,
      total_net: sheet.total_net,
    },
    nome: ator.nome,
    cpf: ator.cpf,
    dataIso: agoraIso,
    ip,
    prefixo: 'PAYROLL_FOLHA_FECHADA',
  });
  const aprovacaoFinal: AprovacaoFolha = { ...aprovacaoAtual, assinaturas, hash: hashFinal };

  const { error } = await supabaseAdmin
    .from('payroll_sheets')
    .update({
      aprovacao: aprovacaoFinal,
      status: 'approved',
      approved_by: ator.id,
      approved_at: agoraIso,
      updated_at: agoraIso,
    })
    .eq('id', sheetId);
  if (error) {
    throw new ErroAprovacaoFolha(`Falha ao aprovar folha: ${error.message}`, 500);
  }

  await gravarAuditoriaFolha({
    sheetId,
    action: 'UPDATE',
    origemEvento: 'assinatura',
    changedBy: ator.id,
    newValues: {
      acao: 'assinar',
      assinado_por: ator.nome,
      assinados: assinaturas.length,
      obrigatorios: aprovacaoAtual.aprovadores.length,
      pendentes: [],
    },
  });
  await gravarAuditoriaFolha({
    sheetId,
    action: 'UPDATE',
    origemEvento: 'aprovacao',
    changedBy: ator.id,
    newValues: {
      acao: 'aprovacao_concluida',
      status: 'approved',
      approved_by: ator.id,
      hash: hashFinal,
      assinaturas: assinaturas.map((s) => ({
        userId: s.userId,
        nome: s.nome,
        assinaturaHash: s.assinaturaHash,
      })),
    },
  });

  return { aprovacao: aprovacaoFinal, aprovado: true, pendentes: [], hash: hashFinal };
}

/**
 * Rejeita a aprovação: grava `aprovacao.rejeicao = { por, motivo, em }` e a
 * sheet permanece 'calculated' (reenvio = iniciarAprovacaoSheet de novo).
 */
export async function rejeitarSheet(
  sheetId: string,
  opts: { userId: string; role?: string; motivo: string },
): Promise<AprovacaoFolha> {
  const motivo = String(opts.motivo || '').trim();
  if (!motivo) {
    throw new ErroAprovacaoFolha('Motivo da rejeição é obrigatório.', 400);
  }

  const sheet = await carregarSheet(sheetId);
  exigirCalculada(sheet);

  const aprovacaoAtual = normalizarAprovacaoFolha(sheet.aprovacao);
  if (!aprovacaoAtual) {
    throw new ErroAprovacaoFolha('Aprovação não iniciada para esta folha.');
  }
  if (aprovacaoAtual.rejeicao) {
    throw new ErroAprovacaoFolha('Esta folha já foi rejeitada.');
  }

  const ator = await carregarAtorFolha(opts.userId);
  const autorizacao = podeAssinarSheet(
    { userId: ator.id, email: ator.email, role: opts.role ?? ator.role },
    aprovacaoAtual,
  );
  if (!autorizacao.permitido) {
    throw new ErroAprovacaoFolha(mensagemErroAssinaturaNegada(autorizacao.motivo), 403);
  }

  const agoraIso = new Date().toISOString();
  const aprovacaoRejeitada: AprovacaoFolha = {
    ...aprovacaoAtual,
    rejeicao: { por: ator.nome, motivo, em: agoraIso },
  };

  const { error } = await supabaseAdmin
    .from('payroll_sheets')
    .update({ aprovacao: aprovacaoRejeitada, updated_at: agoraIso })
    .eq('id', sheetId);
  if (error) {
    throw new ErroAprovacaoFolha(`Falha ao registrar rejeição: ${error.message}`, 500);
  }

  await gravarAuditoriaFolha({
    sheetId,
    action: 'UPDATE',
    origemEvento: 'rejeicao',
    changedBy: ator.id,
    newValues: {
      acao: 'rejeitar',
      rejeicao: aprovacaoRejeitada.rejeicao,
      status: sheet.status,
    },
  });

  return aprovacaoRejeitada;
}
