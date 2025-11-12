import { NextResponse } from 'next/server';
import { EvaluationSettingsService } from '@/lib/services/evaluation-settings';

// GET /api/avaliacao/settings?periodoId=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const settings = await EvaluationSettingsService.getEffectiveSettings(periodoId);

    return NextResponse.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Erro ao obter configurações',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
