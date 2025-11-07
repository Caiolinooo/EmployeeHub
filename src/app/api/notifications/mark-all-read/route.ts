import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// PUT - Marcar todas as notificações como lidas
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, type } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Notifications - Marcando todas as notificações como lidas para usuário ${user_id}`);

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Construir query para marcar como lidas
    let query = supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .is('read_at', null); // Apenas as não lidas

    // Filtrar por tipo se especificado
    if (type) {
      query = query.eq('type', type);
    }

    // Filtrar notificações não expiradas
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { data: updatedNotifications, error: updateError, count } = await query.select();

    if (updateError) {
      console.error('Erro ao marcar notificações como lidas:', updateError);
      return NextResponse.json(
        { error: 'Erro ao marcar notificações como lidas' },
        { status: 500 }
      );
    }

    const updatedCount = updatedNotifications?.length || 0;

    console.log(`✅ ${updatedCount} notificações marcadas como lidas para ${user.first_name}`);

    // Buscar nova contagem de não lidas
    const { count: newUnreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .is('read_at', null)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    return NextResponse.json({
      success: true,
      message: `${updatedCount} notificações marcadas como lidas`,
      updatedCount,
      newUnreadCount: newUnreadCount || 0
    });

  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
