import { NextRequest, NextResponse } from 'next/server';
import type { TokenPayload } from '@/lib/auth';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  isLogisticaRole,
  setorPermiteAsoLogistica,
  type SetorAsoLogistica,
} from './aso-agendamento-logistica';

export {
  isLogisticaRole,
  mensagemErroAsoLogisticaNegada,
  setorEhLogistica,
  setorPermiteAsoLogistica,
  setorTemModuloGestaoTripulantes,
  type AsoLogisticaAcao,
  type SetorAsoLogistica,
} from './aso-agendamento-logistica';

export function tokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || undefined;
  return (
    extractTokenFromHeader(authHeader) ||
    request.cookies.get('abzToken')?.value ||
    request.cookies.get('token')?.value ||
    null
  );
}

export function requireAsoAgendamentoAuth(request: NextRequest): {
  payload?: TokenPayload;
  error?: NextResponse;
} {
  const token = tokenFromRequest(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }
  return { payload };
}

export function resolveAuthUserId(payload: TokenPayload): string {
  return payload.userId || payload.user_id || payload.id || payload.sub || '';
}

export async function podeAprovarAsoLogistica(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (isLogisticaRole(role)) return true;
  if (!userId) return false;

  const { data: user, error: userError } = await supabaseAdmin
    .from('users_unified')
    .select('sector_id')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user?.sector_id) return false;

  const { data: sector, error: sectorError } = await supabaseAdmin
    .from('sectors')
    .select('name, allowed_modules')
    .eq('id', user.sector_id)
    .maybeSingle();

  if (sectorError || !sector) return false;
  return setorPermiteAsoLogistica(sector as SetorAsoLogistica);
}

export function clientIpFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
