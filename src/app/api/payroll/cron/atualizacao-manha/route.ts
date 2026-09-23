import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { atualizarFolhaDaManha } from '@/lib/payroll/folha-manha';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET/POST /api/payroll/cron/atualizacao-manha
 * Vercel Cron: todo dia 11:00 UTC = 08:00 BRT.
 * Espelha empresa/centro de custo do GT e recalcula a competência aberta.
 */
export async function GET(request: NextRequest) {
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}

async function executar(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-vercel-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    Boolean(cronSecret) &&
    (cronSecretHeader === cronSecret || authHeader === `Bearer ${cronSecret}`);

  let isAdmin = false;
  if (authHeader?.startsWith('Bearer ') && authHeader !== `Bearer ${cronSecret}`) {
    const decoded = verifyToken(authHeader.slice(7));
    if (decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER')) isAdmin = true;
  }

  if (!isVercelCron && !isAdmin && process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado ao agendador cron.' },
      { status: 401 },
    );
  }

  try {
    const data = await atualizarFolhaDaManha();
    const falhas = data.folhas.filter((f) => f.status === 'erro').length;
    return NextResponse.json({ success: falhas === 0, data });
  } catch (error) {
    console.error('[payroll/cron/atualizacao-manha]', error);
    const mensagem = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
