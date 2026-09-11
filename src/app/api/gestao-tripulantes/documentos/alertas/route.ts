import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { listarColaboradoresDashboardAtivos } from '@/lib/gestao-tripulantes/dashboard-service';
import { listarDocumentosAlertas } from '@/lib/gestao-tripulantes/documentos-alertas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const colaboradorId = request.nextUrl.searchParams.get('colaborador_id');
    const ids = colaboradorId
      ? [colaboradorId]
      : (await listarColaboradoresDashboardAtivos()).ids;

    const data = await listarDocumentosAlertas({ colaboradorIds: ids });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GT GET /documentos/alertas]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar alertas' },
      { status: 500 },
    );
  }
}
