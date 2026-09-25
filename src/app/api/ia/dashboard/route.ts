/**
 * API: /api/ia/dashboard
 * GET — Dados do dashboard inteligente com KPIs, pendências e resumo
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { generateDashboard } from '@/lib/ia/dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const role = tokenResult.payload.role;
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const type = request.nextUrl.searchParams.get('type');
    const format = request.nextUrl.searchParams.get('format');

    const result = await generateDashboard(userId, role, forceRefresh);

    // Se for exportação
    if (format === 'pdf' || format === 'xlsx') {
      const { exportKPIsToPDF, exportKPIsToXLSX } = await import('@/lib/ia/dashboard-service');
      const buffer = format === 'pdf' 
        ? await exportKPIsToPDF(result.data)
        : await exportKPIsToXLSX(result.data);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="dashboard-kpi.${format}"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API IA Dashboard GET]', err);
    return NextResponse.json(
      { error: 'Erro ao gerar o dashboard' },
      { status: 500 }
    );
  }
}
