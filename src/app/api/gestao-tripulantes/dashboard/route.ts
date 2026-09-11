import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getDashboardData } from '@/lib/gestao-tripulantes/dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const result = await getDashboardData();
    if (!result.success || !result.data) {
      console.error('Erro ao buscar dados do dashboard:', result.error);
      return NextResponse.json({ error: 'Erro ao buscar dados do dashboard' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        module: 'gestao-tripulantes',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erro na API dashboard:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
