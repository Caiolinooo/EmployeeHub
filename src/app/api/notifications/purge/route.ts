import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST - Purge (delete) old notifications for a user
// Body: { user_id: string; olderThanDays?: number; onlyRead?: boolean }
// Default: olderThanDays=30, onlyRead=true
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Configuração do banco ausente' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { user_id, olderThanDays = 30, onlyRead = true } = body || {};

    if (!user_id) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 });
    }

    const days = Number.isFinite(olderThanDays) && olderThanDays >= 0 ? olderThanDays : 30;
    
    console.log(`🗑️ Iniciando purge para usuário ${user_id}: ${days} dias, onlyRead: ${onlyRead}`);

    // Build delete query
    let query = supabaseAdmin
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);

    // Se olderThanDays > 0, aplicar filtro de data
    if (days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('created_at', cutoff);
    }

    // Se onlyRead=true, apenas notificações lidas
    if (onlyRead) {
      query = query.not('read_at', 'is', null);
    }

    const { error, count } = await query;

    if (error) {
      console.error('Erro ao purgar notificações:', error);
      return NextResponse.json({ error: 'Erro ao apagar notificações antigas' }, { status: 500 });
    }

    const deletedCount = count || 0;
    console.log(`✅ Purge concluído: ${deletedCount} notificações apagadas para usuário ${user_id}`);

    const headers = new Headers();
    headers.append('Cache-Control', 'no-store');

    return NextResponse.json(
      { success: true, deletedCount, olderThanDays: days, onlyRead },
      { status: 200, headers }
    );
  } catch (err) {
    console.error('Erro no purge de notificações:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

