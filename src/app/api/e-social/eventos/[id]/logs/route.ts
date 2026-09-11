import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { data: logs, error } = await supabaseAdmin
      .from('esocial_envios_log')
      .select('*')
      .eq('evento_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar logs do evento:', error);
      return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
    });
  } catch (error) {
    console.error('Erro em GET /api/e-social/eventos/[id]/logs:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
