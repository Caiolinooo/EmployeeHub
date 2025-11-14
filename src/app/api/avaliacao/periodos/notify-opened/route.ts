import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyPeriodOpened } from '@/lib/evaluation-notifications';

/**
 * POST /api/avaliacao/periodos/notify-opened
 * Notifica todos os usuários quando um período de avaliação é aberto
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, periodName } = body;

    if (!periodId || !periodName) {
      return NextResponse.json(
        { success: false, error: 'periodId e periodName são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar todos os usuários ativos
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('id, name, email')
      .eq('active', true)
      .eq('is_authorized', true);

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar usuários' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum usuário ativo encontrado' },
        { status: 404 }
      );
    }

    // Enviar notificações para todos os usuários
    const userIds = users.map(user => user.id);
    const success = await notifyPeriodOpened(userIds, periodId, periodName);

    if (success) {
      console.log(`✅ Notificações de período aberto enviadas para ${userIds.length} usuários`);
      return NextResponse.json({
        success: true,
        message: `Notificações enviadas para ${userIds.length} usuários`,
        notifiedUsers: userIds.length
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Falha ao enviar notificações' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Erro ao notificar período aberto:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}