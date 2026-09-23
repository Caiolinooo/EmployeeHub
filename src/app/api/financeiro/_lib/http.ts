/**
 * Helpers HTTP compartilhados das rotas /api/financeiro/** (owner dev-Back).
 * Padrão do repo: {success:true,data} / {success:false,error}; NextResponse do
 * gate é repassado direto; FinanceiroHttpError (service) → status/código certo.
 */
import { NextResponse } from 'next/server';
import { FinanceiroHttpError } from '@/lib/financeiro/service';

export function finOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function finFail(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/** Mapa única de exceções (service/DB) → resposta HTTP padrão. */
export function finErro(e: unknown): NextResponse {
  if (e instanceof FinanceiroHttpError) {
    return finFail(e.message, e.status);
  }
  console.error('[api/financeiro] erro inesperado:', e);
  const message = e instanceof Error ? e.message : 'Erro na operação financeira';
  return finFail(message, 500);
}

export function paginacao(url: string): { page: number; limit: number; from: number; to: number } {
  const { searchParams } = new URL(url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

/** Corpo JSON tolerante (fetch sem body → objeto vazio, não exceção). */
export async function corpoJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function texto(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}
