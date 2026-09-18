/**
 * Auth/ator das rotas /api/indicadores — mesmo padrão de
 * aso-agendamento-auth.ts (token de header/cookie + verifyToken) e de
 * carregarAtorEscala (JWT verificado + users_unified + IP, best-effort).
 */
import { NextRequest, NextResponse } from 'next/server';
import type { TokenPayload } from '@/lib/auth';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  podeEditarIndicadores,
  podeImportarIndicadores,
  podeVerIndicadores,
  type NivelIndicadores,
} from './permissoes';

export interface AtorIndicadores {
  id: string | null;
  nome: string | null;
  role: string | null;
  ip: string;
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

export function requireIndicadoresAuth(request: NextRequest): {
  payload?: TokenPayload;
  error?: NextResponse;
} {
  const token = tokenFromRequest(request);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: 'Token de autorização necessário' }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 }) };
  }
  return { payload };
}

export function resolveAuthUserId(payload: TokenPayload): string {
  return payload.userId || payload.user_id || payload.id || payload.sub || '';
}

/** Ator das trilhas criado_por/atualizado_por/ator (best-effort, nunca falha a rota). */
export async function carregarAtorIndicadores(
  payload: TokenPayload,
  request: NextRequest,
): Promise<AtorIndicadores> {
  const userId = resolveAuthUserId(payload);
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const ator: AtorIndicadores = { id: userId || null, nome: payload.email || null, role: payload.role || null, ip };
  if (!userId) return ator;
  try {
    const { data } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, name, role')
      .eq('id', userId)
      .maybeSingle();
    const row = (data || {}) as {
      first_name?: string | null;
      last_name?: string | null;
      name?: string | null;
      role?: string | null;
    };
    const composto = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    ator.nome = composto || (row.name || '').trim() || ator.nome;
    ator.role = row.role || ator.role;
  } catch (err) {
    console.error('[indicadores] falha ao carregar ator (best-effort):', err);
  }
  return ator;
}

/** Auth + permissão de negócio num passo. Gate de todas as rotas do módulo. */
export async function garantirNivelIndicadores(
  request: NextRequest,
  nivel: NivelIndicadores,
): Promise<{ payload?: TokenPayload; ator?: AtorIndicadores; error?: NextResponse }> {
  const auth = requireIndicadoresAuth(request);
  if (auth.error || !auth.payload) return { error: auth.error };
  const payload = auth.payload;
  const userId = resolveAuthUserId(payload);
  const role = payload.role || undefined;

  const permitido =
    nivel === 'import'
      ? await podeImportarIndicadores(userId, role)
      : nivel === 'edit'
        ? await podeEditarIndicadores(userId, role)
        : await podeVerIndicadores(userId, role);
  if (!permitido) {
    return { error: NextResponse.json({ success: false, error: 'Sem permissão para este módulo' }, { status: 403 }) };
  }

  const ator = await carregarAtorIndicadores(payload, request);
  return { payload, ator };
}
