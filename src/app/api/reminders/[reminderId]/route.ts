import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Obter lembrete específico
export async function GET(
  request: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const reminderId = params.reminderId;
    console.log(`🔄 API Reminder - Buscando lembrete: ${reminderId}`);

    const { data: reminder, error } = await supabaseAdmin
      .from('reminders')
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email
        ),
        post:news_posts!post_id (
          id,
          title,
          status
        )
      `)
      .eq('id', reminderId)
      .single();

    if (error || !reminder) {
      console.error('Lembrete não encontrado:', error);
      return NextResponse.json(
        { error: 'Lembrete não encontrado' },
        { status: 404 }
      );
    }

    console.log(`✅ Lembrete carregado: ${reminder.title}`);
    return NextResponse.json(reminder);

  } catch (error) {
    console.error('Erro ao buscar lembrete:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar lembrete
export async function PUT(
  request: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const reminderId = params.reminderId;
    const body = await request.json();
    const {
      title,
      message,
      remind_at,
      target_roles,
      target_users,
      status
    } = body;

    console.log(`🔄 API Reminder - Atualizando lembrete: ${reminderId}`);

    // Verificar se o lembrete existe
    const { data: existingReminder, error: fetchError } = await supabaseAdmin
      .from('reminders')
      .select('*')
      .eq('id', reminderId)
      .single();

    if (fetchError || !existingReminder) {
      return NextResponse.json(
        { error: 'Lembrete não encontrado' },
        { status: 404 }
      );
    }

    // Preparar dados de atualização
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (remind_at !== undefined) {
      const remindDate = new Date(remind_at);
      if (remindDate <= new Date()) {
        return NextResponse.json(
          { error: 'Data do lembrete deve ser no futuro' },
          { status: 400 }
        );
      }
      updateData.remind_at = remind_at;
    }
    if (target_roles !== undefined) updateData.target_roles = JSON.stringify(target_roles);
    if (target_users !== undefined) updateData.target_users = JSON.stringify(target_users);
    if (status !== undefined) updateData.status = status;

    const { data: updatedReminder, error: updateError } = await supabaseAdmin
      .from('reminders')
      .update(updateData)
      .eq('id', reminderId)
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email
        ),
        post:news_posts!post_id (
          id,
          title,
          status
        )
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar lembrete:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar lembrete' },
        { status: 500 }
      );
    }

    console.log(`✅ Lembrete atualizado: ${updatedReminder.title}`);
    return NextResponse.json(updatedReminder);

  } catch (error) {
    console.error('Erro ao atualizar lembrete:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir lembrete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  try {
    const reminderId = params.reminderId;
    console.log(`🔄 API Reminder - Excluindo lembrete: ${reminderId}`);

    // Verificar se o lembrete existe
    const { data: existingReminder, error: fetchError } = await supabaseAdmin
      .from('reminders')
      .select('title')
      .eq('id', reminderId)
      .single();

    if (fetchError || !existingReminder) {
      return NextResponse.json(
        { error: 'Lembrete não encontrado' },
        { status: 404 }
      );
    }

    // Excluir o lembrete
    const { error: deleteError } = await supabaseAdmin
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    if (deleteError) {
      console.error('Erro ao excluir lembrete:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir lembrete' },
        { status: 500 }
      );
    }

    console.log(`✅ Lembrete excluído: ${existingReminder.title}`);
    return NextResponse.json({ 
      success: true, 
      message: 'Lembrete excluído com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao excluir lembrete:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
