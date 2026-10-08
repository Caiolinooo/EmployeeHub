/**
 * API: /api/ia/sessions/cleanup
 * POST — Limpar sessões inativas de TODOS os usuários (para cron/admin)
 * GET  — Retorna estatísticas de sessões inativas
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const INACTIVE_THRESHOLD_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;

    const { data: user } = await supabaseAdmin
      .from('users_unified')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || !(await canWithGrant(userId, user.role, ['ia-assistant.sessions.cleanup'], 'admin'))) {
      return NextResponse.json({ error: 'Apenas administradores podem executar cleanup global' }, { status: 403 });
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - INACTIVE_THRESHOLD_DAYS);
    const thresholdISO = threshold.toISOString();

    const { data: oldSessions, error: fetchError } = await supabaseAdmin
      .from('ia_chat_sessions')
      .select('id, user_id')
      .is('deleted_at', null)
      .lt('updated_at', thresholdISO)
      .limit(1000);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!oldSessions || oldSessions.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma sessão inativa encontrada',
        archived: 0,
        threshold_days: INACTIVE_THRESHOLD_DAYS,
      });
    }

    const ids = oldSessions.map(s => s.id);
    const uniqueUsers = new Set(oldSessions.map(s => s.user_id));

    const { error: updateError } = await supabaseAdmin
      .from('ia_chat_sessions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[IA Sessions Cleanup] Cleanup global: ${ids.length} sessões arquivadas de ${uniqueUsers.size} usuário(s).`);

    return NextResponse.json({
      message: `${ids.length} sessão(ões) inativa(s) arquivada(s)`,
      archived: ids.length,
      users_affected: uniqueUsers.size,
      threshold_days: INACTIVE_THRESHOLD_DAYS,
    });
  } catch (err) {
    console.error('[API IA Sessions Cleanup]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - INACTIVE_THRESHOLD_DAYS);
    const thresholdISO = threshold.toISOString();

    const { count, error } = await supabaseAdmin
      .from('ia_chat_sessions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .lt('updated_at', thresholdISO);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      inactive_count: count || 0,
      threshold_days: INACTIVE_THRESHOLD_DAYS,
    });
  } catch (err) {
    console.error('[API IA Sessions Cleanup GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
