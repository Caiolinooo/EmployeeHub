/**
 * Auth/permissões do módulo Folha (/api/payroll/**, /api/setup-payroll) —
 * mesmo padrão do módulo Indicadores (api-auth.ts + permissoes.ts):
 *
 *   1. ADMIN → sempre permitido;
 *   2. ACL: checkAclPermission(userId, role, 'folha', nivel);
 *   3. Fallback setor: usuário pertence a setor com nome DP-like
 *      (departamento pessoal / DP / RH) E `sectors.allowed_modules`
 *      incluindo 'folha' ou 'dp' — apenas para view/edit.
 *
 * Nível 'approve' NUNCA sai do fallback de setor: exige ADMIN, ACL
 * 'folha.approve' ou constar na config `payroll_aprovadores_config`
 * (tabela settings, JSONB [{ user_id, nome, papel, ordem }]).
 *
 * As consultas de setor usam supabaseAdmin (service_role) — padrão do repo:
 * as tabelas do módulo são acessadas via service_role nas rotas.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { TokenPayload } from '@/lib/auth';
import { checkAclPermission, extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export type NivelPayroll = 'view' | 'edit' | 'approve';

const MODULO_FOLHA = 'folha';
// DP-like: departamento pessoal, DP ou RH.
const DP_SETOR_REGEX = /(departamento.*pessoal|\bdp\b|\brh\b)/i;
const APROVADORES_CONFIG_KEY = 'payroll_aprovadores_config';

export interface SetorFolha {
  name?: string | null;
  allowed_modules?: unknown;
}

/** Item da config de aprovadores (tabela settings, chave payroll_aprovadores_config). */
export interface AprovadorFolhaConfig {
  user_id: string;
  nome: string;
  papel?: string | null;
  ordem?: number | null;
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

export function setorEhDP(name: string | null | undefined): boolean {
  return DP_SETOR_REGEX.test(String(name || ''));
}

export function setorTemModuloFolha(allowed: unknown): boolean {
  const list = Array.isArray(allowed) ? allowed : [];
  return list.some((m) => {
    const mod = String(m || '').trim().toLowerCase();
    return mod === MODULO_FOLHA || mod === 'dp';
  });
}

/** Lê a config de aprovadores da tabela settings (padrão evaluation-settings.ts). */
export async function carregarAprovadoresConfig(): Promise<AprovadorFolhaConfig[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', APROVADORES_CONFIG_KEY)
      .maybeSingle();
    if (error || !data) return [];

    const raw = (data as { value?: unknown }).value;
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item): AprovadorFolhaConfig | null => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const rec = item as Record<string, unknown>;
        const userId = typeof rec.user_id === 'string' ? rec.user_id.trim() : '';
        if (!userId) return null;
        return {
          user_id: userId,
          nome: typeof rec.nome === 'string' ? rec.nome : '',
          papel: typeof rec.papel === 'string' ? rec.papel : null,
          ordem: typeof rec.ordem === 'number' ? rec.ordem : null,
        };
      })
      .filter((a): a is AprovadorFolhaConfig => a !== null);
  } catch (err) {
    console.error('[payroll] falha ao ler config de aprovadores (best-effort):', err);
    return [];
  }
}

/** Usuário consta na config `payroll_aprovadores_config`? */
export async function usuarioEhAprovadorFolha(userId: string): Promise<boolean> {
  if (!userId) return false;
  const aprovadores = await carregarAprovadoresConfig();
  return aprovadores.some((a) => a.user_id === userId);
}

/**
 * Permissão de negócio do módulo Folha num passo.
 * ADMIN → ACL 'folha' → (view/edit) setor DP-like com 'folha'/'dp' nos
 * allowed_modules → (approve) config `payroll_aprovadores_config`.
 */
export async function podeNivelPayroll(
  userId: string,
  role: string | undefined,
  nivel: NivelPayroll,
): Promise<boolean> {
  if ((role || '').toUpperCase() === 'ADMIN') return true;
  if (!userId) return false;

  if (await checkAclPermission(userId, role || '', MODULO_FOLHA, nivel)) return true;

  // Aprovar nunca sai do fallback de setor: exige config de aprovadores.
  if (nivel === 'approve') {
    return usuarioEhAprovadorFolha(userId);
  }

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

  return setorEhDP((sector as SetorFolha).name) && setorTemModuloFolha((sector as SetorFolha).allowed_modules);
}

export interface PayrollAutorizado {
  userId: string;
  role: string;
}

export type GatePayroll =
  | { ok: true; user: PayrollAutorizado }
  | { ok: false; error: NextResponse };

/** Auth + permissão num passo. Gate de todas as rotas do módulo folha. */
export async function garantirNivelPayroll(
  request: NextRequest,
  nivel: NivelPayroll,
): Promise<GatePayroll> {
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
  const permitido = await podeNivelPayroll(userId, role, nivel);
  if (!permitido) {
    const acao = nivel === 'view' ? 'visualizar' : nivel === 'edit' ? 'editar' : 'aprovar';
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: `Sem permissão para ${acao} dados de folha de pagamento` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: { userId, role } };
}
