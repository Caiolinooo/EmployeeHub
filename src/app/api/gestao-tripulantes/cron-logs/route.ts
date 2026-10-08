import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { GT_CONFIG_GRANT } from '@/lib/gestao-tripulantes/gt-route-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !(await canWithGrant(payload.userId, payload.role, [GT_CONFIG_GRANT]))) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { data, error } = await supabaseAdmin
      .from('gt_cron_log')
      .select('*')
      .order('iniciado_em', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar logs de cron:', error);
      return NextResponse.json({ error: 'Erro ao buscar logs de cron' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro na API logs de cron:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
