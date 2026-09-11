import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { consolidarEventosDaEmpresa } from '@/lib/e-social/esocial-consolidator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) token = tokenCookie.value;
    }
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const resultado = await consolidarEventosDaEmpresa();

    return NextResponse.json({
      success: resultado.sucesso,
      resultado,
      message: `${resultado.novosCriados} novos eventos consolidados e integrados ao e-Social. Total atual: ${resultado.totalEventosDepois} eventos.`
    });
  } catch (error: any) {
    console.error('Erro em POST /api/e-social/consolidar:', error);
    return NextResponse.json({ error: error.message || 'Erro ao consolidar eventos' }, { status: 500 });
  }
}
