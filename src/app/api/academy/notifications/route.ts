import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser, logAction } from '@/lib/api-auth';

// GET - Listar notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 });
    }

    // Contar notificações não lidas
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unread_count: unreadCount || 0
    });

  } catch (error) {
    console.error('Erro na API de notificações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova notificação (uso interno)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, type, title, message, data, action_url } = body;

    if (!user_id || !type || !title || !message) {
      return NextResponse.json({ error: 'Campos obrigatórios: user_id, type, title, message' }, { status: 400 });
    }

    // Verificar se o usuário existe
    const { data: userExists, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('id', user_id)
      .single();

    if (userError || !userExists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Criar notificação
    const { data: notification, error: createError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        data: data || null,
        action_url: action_url || null,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar notificação:', createError);
      return NextResponse.json({ error: 'Erro ao criar notificação' }, { status: 500 });
    }

    console.log(`✅ Notificação criada para usuário ${user_id}: ${title}`);

    return NextResponse.json({
      success: true,
      message: 'Notificação criada com sucesso',
      notification
    });

  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Marcar notificações como lidas
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    if (mark_all_read) {
      // Marcar todas as notificações como lidas
      const { error: updateError } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (updateError) {
        console.error('Erro ao marcar todas as notificações como lidas:', updateError);
        return NextResponse.json({ error: 'Erro ao marcar notificações como lidas' }, { status: 500 });
      }

      logAction(user, 'MARK_ALL_NOTIFICATIONS_READ', 'notification', null);

      return NextResponse.json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas'
      });
    }

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json({ error: 'notification_ids é obrigatório' }, { status: 400 });
    }

    // Marcar notificações específicas como lidas
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in('id', notification_ids)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Erro ao marcar notificações como lidas:', updateError);
      return NextResponse.json({ error: 'Erro ao marcar notificações como lidas' }, { status: 500 });
    }

    logAction(user, 'MARK_NOTIFICATIONS_READ', 'notification', null, { notification_ids });

    return NextResponse.json({
      success: true,
      message: 'Notificações marcadas como lidas'
    });

  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir notificações
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const notificationIds = searchParams.get('notification_ids')?.split(',');
    const deleteAll = searchParams.get('delete_all') === 'true';

    if (deleteAll) {
      // Excluir todas as notificações do usuário
      const { error: deleteError } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Erro ao excluir todas as notificações:', deleteError);
        return NextResponse.json({ error: 'Erro ao excluir notificações' }, { status: 500 });
      }

      logAction(user, 'DELETE_ALL_NOTIFICATIONS', 'notification', null);

      return NextResponse.json({
        success: true,
        message: 'Todas as notificações foram excluídas'
      });
    }

    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ error: 'notification_ids é obrigatório' }, { status: 400 });
    }

    // Excluir notificações específicas
    const { error: deleteError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .in('id', notificationIds)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Erro ao excluir notificações:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir notificações' }, { status: 500 });
    }

    logAction(user, 'DELETE_NOTIFICATIONS', 'notification', null, { notification_ids: notificationIds });

    return NextResponse.json({
      success: true,
      message: 'Notificações excluídas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir notificações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função utilitária para criar notificações (exportada para uso em outras APIs)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: any,
  actionUrl?: string
) {
  try {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || null,
        action_url: actionUrl || null,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar notificação:', error);
      return null;
    }

    return notification;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return null;
  }
}

// Função para notificar sobre novos cursos
export async function notifyNewCourse(courseId: string, courseTitle: string) {
  try {
    // Buscar todos os usuários ativos
    const { data: users, error } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('is_active', true);

    if (error || !users) {
      console.error('Erro ao buscar usuários para notificação:', error);
      return;
    }

    // Criar notificação para cada usuário
    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'new_course',
      title: 'Novo curso disponível!',
      message: `O curso "${courseTitle}" foi adicionado ao Academy. Confira agora!`,
      data: { course_id: courseId },
      action_url: `/academy/course/${courseId}`,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    // Inserir notificações em lote
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Erro ao criar notificações em lote:', insertError);
    } else {
      console.log(`✅ Notificações criadas para ${users.length} usuários sobre novo curso: ${courseTitle}`);
    }
  } catch (error) {
    console.error('Erro ao notificar sobre novo curso:', error);
  }
}

// Função para notificar sobre conclusão de curso
export async function notifyCourseCompletion(userId: string, courseTitle: string, courseId: string) {
  await createNotification(
    userId,
    'course_completed',
    'Parabéns! Curso concluído!',
    `Você concluiu o curso "${courseTitle}". Seu certificado está disponível!`,
    { course_id: courseId },
    `/academy/certificates`
  );
}

// Função para lembrete de estudo
export async function notifyStudyReminder(userId: string, courseTitle: string, courseId: string) {
  await createNotification(
    userId,
    'study_reminder',
    'Hora de continuar estudando!',
    `Que tal continuar o curso "${courseTitle}"? Você está quase terminando!`,
    { course_id: courseId },
    `/academy/course/${courseId}`
  );
}
