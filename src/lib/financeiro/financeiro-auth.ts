/**
 * Auth/permissões do módulo Financeiro (/api/financeiro/**) — cópia adaptada
 * de src/lib/payroll/payroll-auth.ts (mesmo padrão do módulo Indicadores):
 *
 *   1. ADMIN → sempre permitido;
 *   2. ACL: checkAclPermission(userId, role, 'financeiro', nivel);
 *   3. Fallback setor: usuário pertence a setor com nome financeiro/contábil-like
 *      (financeiro / contabil / contabilidade) E `sectors.allowed_modules`
 *      incluindo 'financeiro' — apenas para view/edit.
 *
 * MÓDULO PRÓPRIO: NÃO herda gates nem fallback de setor da Folha/DP (§6).
 * Níveis: view (leitura) · edit (faturas/emissões/cobranças/conciliação) ·
 * admin (credenciais, certificados, municípios, templates, config NFS-e).
 *
 * As consultas de setor usam supabaseAdmin (service_role) — padrão do repo:
 * as tabelas do módulo são acessadas via service_role nas rotas.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { TokenPayload } from '@/lib/auth';
import { checkAclPermission, extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export type NivelFinanceiro = 'view' | 'edit' | 'admin';

const MODULO_FINANCEIRO = 'financeiro';
// Financeiro/contábil-like: financeiro, contabil, contabilidade.
const FINANCEIRO_SETOR_REGEX = /(financeiro|contabil|contabilidade)/i;

export interface SetorFinanceiro {
  name?: string | null;
  allowed_modules?: unknown;
}

export function tokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || undefined;
  return (
    extractTokenFromHeader(authHeader) ||
    request.cookies.get('abzToken')?.value ||
    request.cookies.get('token')?.value ||
    null
  );
}

export function resolveAuthUserId(payload: TokenPayload): string {
  return payload.userId || payload.user_id || payload.id || payload.sub || '';
}

export function setorEhFinanceiro(name: string | null | undefined): boolean {
  return FINANCEIRO_SETOR_REGEX.test(String(name || ''));
}

export function setorTemModuloFinanceiro(allowed: unknown): boolean {
  const list = Array.isArray(allowed) ? allowed : [];
  return list.some((m) => String(m || '').trim().toLowerCase() === MODULO_FINANCEIRO);
}

/**
 * Permissão de negócio do módulo Financeiro num passo.
 * ADMIN → ACL 'financeiro' → (view/edit) setor financeiro/contábil-like com
 * 'financeiro' nos allowed_modules. 'admin' NUNCA sai do fallback de setor.
 */
export async function podeNivelFinanceiro(
  userId: string,
  role: string | undefined,
  nivel: NivelFinanceiro,
): Promise<boolean> {
  if ((role || '').toUpperCase() === 'ADMIN') return true;
  if (!userId) return false;

  if (await checkAclPermission(userId, role || '', MODULO_FINANCEIRO, nivel)) return true;

  // Nível admin nunca sai do fallback de setor.
  if (nivel === 'admin') return false;

  const { data: user } = await supabaseAdmin
    .from('users_unified')
    .select('sector_id')
    .eq('id', userId)
    .maybeSingle();
  if (!user?.sector_id) return false;

  const { data: sector } = await supabaseAdmin
    .from('sectors')
    .select('name, allowed_modules')
    .eq('id', user.sector_id)
    .maybeSingle();
  if (!sector) return false;

  return (
    setorEhFinanceiro((sector as SetorFinanceiro).name) &&
    setorTemModuloFinanceiro((sector as SetorFinanceiro).allowed_modules)
  );
}

export interface FinanceiroAutorizado {
  userId: string;
  role: string;
}

export type GateFinanceiro =
  | { ok: true; user: FinanceiroAutorizado }
  | { ok: false; error: NextResponse };

/** Auth + permissão num passo. Gate de TODAS as rotas /api/financeiro/**. */
export async function garantirNivelFinanceiro(
  request: NextRequest,
  nivel: NivelFinanceiro,
): Promise<GateFinanceiro> {
  const token = tokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: 'Token de autorização necessário' },
        { status: 401 },
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 },
      ),
    };
  }

  const userId = resolveAuthUserId(payload);
  const role = payload.role || '';
  const permitido = await podeNivelFinanceiro(userId, role, nivel);
  if (!permitido) {
    const acao = nivel === 'view' ? 'visualizar' : nivel === 'edit' ? 'editar' : 'administrar';
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: `Sem permissão para ${acao} dados financeiros` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: { userId, role } };
}
