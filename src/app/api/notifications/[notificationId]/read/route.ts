import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// PUT - Marcar notificação como lida
export async function PUT(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const notificationId = params.notificationId;
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Notifications - Marcando notificação ${notificationId} como lida`);

    // Verificar se a notificação existe e pertence ao usuário
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      );
    }

    // Se já estiver lida, retornar sucesso
    if (notification.read_at) {
      return NextResponse.json({
        success: true,
        message: 'Notificação já estava marcada como lida',
        notification
      });
    }

    // Marcar como lida
    const { data: updatedNotification, error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao marcar notificação como lida:', updateError);
      return NextResponse.json(
        { error: 'Erro ao marcar notificação como lida' },
        { status: 500 }
      );
    }

    console.log(`✅ Notificação marcada como lida: ${updatedNotification.title}`);

    return NextResponse.json({
      success: true,
      message: 'Notificação marcada como lida',
      notification: updatedNotification
    });

  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Marcar notificação como não lida
export async function DELETE(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const notificationId = params.notificationId;
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Notifications - Marcando notificação ${notificationId} como não lida`);

    // Verificar se a notificação existe e pertence ao usuário
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      );
    }

    // Marcar como não lida
    const { data: updatedNotification, error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: null })
      .eq('id', notificationId)
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao marcar notificação como não lida:', updateError);
      return NextResponse.json(
        { error: 'Erro ao marcar notificação como não lida' },
        { status: 500 }
      );
    }

    console.log(`✅ Notificação marcada como não lida: ${updatedNotification.title}`);

    return NextResponse.json({
      success: true,
      message: 'Notificação marcada como não lida',
      notification: updatedNotification
    });

  } catch (error) {
    console.error('Erro ao marcar notificação como não lida:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
