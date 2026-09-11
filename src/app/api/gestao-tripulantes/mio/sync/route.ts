import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { syncAllFromMIO } from '@/lib/gestao-tripulantes/mio-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Explicit admin MIO → portal pull. Never writes back to MIO.
 * POST /api/gestao-tripulantes/mio/sync
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const decoded = token ? verifyToken(token) : null;
    const cronOk =
      request.headers.get('x-vercel-cron-secret') === process.env.CRON_SECRET ||
      (Boolean(process.env.CRON_SECRET) &&
        request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`);
    const isAdmin = decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER');
    const isDev = process.env.NODE_ENV === 'development';

    if (!isAdmin && !cronOk && !isDev) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[MIO pull] Admin full pull requested');
    const result = await syncAllFromMIO();
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? 'Pull MIO → banco local concluído (MIO não foi alterado).'
        : result.error,
      data: result.data,
    }, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error('[MIO pull] Admin sync failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
