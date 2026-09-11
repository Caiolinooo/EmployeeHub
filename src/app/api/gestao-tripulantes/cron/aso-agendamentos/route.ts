import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAsoAgendamentoConfig } from '@/lib/gestao-tripulantes/aso-agendamento-config';
import { gerarSugestoesEmLote } from '@/lib/gestao-tripulantes/aso-agendamento-service';
import { isLogisticaRole } from '@/lib/gestao-tripulantes/aso-agendamento-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-vercel-cron-secret');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron =
      Boolean(cronSecret) &&
      (cronSecretHeader === cronSecret || authHeader === `Bearer ${cronSecret}`);

    let isAdmin = false;
    if (authHeader?.startsWith('Bearer ') && authHeader !== `Bearer ${cronSecret}`) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded && isLogisticaRole(decoded.role)) isAdmin = true;
    }

    const isLocalDevelopment = process.env.NODE_ENV === 'development';
    if (!isVercelCron && !isAdmin && !isLocalDevelopment) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const cfg = await getAsoAgendamentoConfig();
    if (!cfg.gerar_sugestoes_automatico && !isAdmin) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Geração automática de sugestões de ASO desligada na configuração.',
      });
    }

    const stats = await gerarSugestoesEmLote();
    return NextResponse.json({
      success: true,
      antecedencia_dias: cfg.antecedencia_dias,
      ...stats,
    });
  } catch (error) {
    console.error('[cron aso-agendamentos]', error);
    return NextResponse.json({ error: 'Erro interno no cron de ASO' }, { status: 500 });
  }
}
