// Sistema completo de notificações para avaliações de desempenho
// Fluxo: Período Aberto → Autoavaliação → Revisão Gerencial → Ajustes → Finalização

interface CreateEvaluationNotificationParams {
  userId: string;
  type: 'period_opened' | 'evaluation_created' | 'self_evaluation_completed' | 'manager_review_pending' | 'evaluation_returned' | 'evaluation_revised' | 'evaluation_completed';
  evaluationId?: string;
  periodId?: string;
  employeeName?: string;
  managerName?: string;
  periodName?: string;
  comments?: string;
}

/**
 * Cria uma notificação relacionada a avaliação de desempenho
 */
export async function createEvaluationNotification(params: CreateEvaluationNotificationParams): Promise<boolean> {
  const { userId, type, evaluationId, employeeName, managerName, periodName } = params;

  // Definir título e mensagem baseado no tipo
  let title = '';
  let message = '';
  let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

  switch (type) {
    case 'period_opened':
      title = '🚀 Novo Período de Avaliação';
      message = `O período de avaliação "${periodName}" foi aberto! Acesse para iniciar sua autoavaliação.`;
      priority = 'high';
      break;

    case 'evaluation_created':
      title = '📝 Nova Avaliação Disponível';
      message = `Uma nova avaliação de desempenho foi criada para o período: ${periodName || 'N/A'}. Acesse para iniciar sua autoavaliação.`;
      priority = 'high';
      break;

    case 'self_evaluation_completed':
      title = '✅ Autoavaliação Concluída';
      message = `${employeeName} completou a autoavaliação e está aguardando sua revisão como gestor.`;
      priority = 'high';
      break;

    case 'manager_review_pending':
      title = '👨‍💼 Revisão Gerencial Pendente';
      message = `Você tem uma avaliação de ${employeeName} aguardando sua revisão e aprovação.`;
      priority = 'high';
      break;

    case 'evaluation_returned':
      title = '🔄 Avaliação Devolvida para Ajustes';
      message = `Sua avaliação foi devolvida pelo gestor ${managerName} para ajustes. Verifique os comentários e reenvie.`;
      priority = 'urgent';
      break;

    case 'evaluation_revised':
      title = '📝 Avaliação Revisada';
      message = `${employeeName} revisou a avaliação conforme seus comentários. Pronta para avaliação final.`;
      priority = 'high';
      break;

    case 'evaluation_completed':
      title = '🎉 Avaliação Finalizada';
      message = `Sua avaliação de desempenho foi finalizada por ${managerName}! Visualize os resultados e feedback.`;
      priority = 'normal';
      break;

    default:
      return false;
  }

  try {
    // Importar supabaseAdmin dinamicamente para evitar problemas de contexto
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { sendPushToUserIds } = await import('@/lib/push');

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Usuário não encontrado para notificação:', userId);
      return false;
    }

    // Criar notificação diretamente no banco
    const notificationData = {
      user_id: userId,
      type: 'evaluation',
      title,
      message: message || '',
      data: JSON.stringify({
        evaluation_id: evaluationId,
        period_id: params.periodId,
        type,
        employee_name: employeeName,
        manager_name: managerName,
        period_name: periodName,
        comments: params.comments
      }),
      action_url: type === 'period_opened' ? `/avaliacao` : `/avaliacao/ver/${evaluationId}`,
      priority,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: newNotification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir notificação:', insertError);
      return false;
    }

    // Enviar push notification (não bloqueante)
    try {
      await sendPushToUserIds([userId], { 
        title, 
        body: message || '', 
        url: notificationData.action_url 
      });
    } catch (pushError) {
      console.warn('Falha ao enviar push (não bloqueante):', pushError);
    }

    console.log(`✅ Notificação de avaliação criada: ${type} para ${user.first_name}`);
    return true;
  } catch (error) {
    console.error('Erro ao criar notificação de avaliação:', error);
    return false;
  }
}

/**
 * Notifica todos os usuários quando um período de avaliação é aberto
 */
export async function notifyPeriodOpened(
  userIds: string[],
  periodId: string,
  periodName: string
): Promise<boolean> {
  const results = await Promise.allSettled(
    userIds.map(userId => 
      createEvaluationNotification({
        userId,
        type: 'period_opened',
        periodId,
        periodName
      })
    )
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ Notificações de período aberto enviadas: ${successful}/${userIds.length}`);
  return successful > 0;
}

/**
 * Notifica o colaborador quando uma nova avaliação é criada
 */
export async function notifyEmployeeEvaluationCreated(
  employeeId: string,
  evaluationId: string,
  periodName: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: employeeId,
    type: 'evaluation_created',
    evaluationId,
    periodName
  });
}

/**
 * Notifica o gerente quando o colaborador completa a autoavaliação
 */
export async function notifyManagerSelfEvaluationCompleted(
  managerId: string,
  evaluationId: string,
  employeeName: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: managerId,
    type: 'self_evaluation_completed',
    evaluationId,
    employeeName
  });
}

/**
 * Notifica o gerente quando há avaliação pendente para revisão
 */
export async function notifyManagerEvaluationPending(
  managerId: string,
  evaluationId: string,
  employeeName: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: managerId,
    type: 'manager_review_pending',
    evaluationId,
    employeeName
  });
}

/**
 * Notifica o colaborador quando a avaliação é devolvida para ajustes
 */
export async function notifyEmployeeEvaluationReturned(
  employeeId: string,
  evaluationId: string,
  managerName: string,
  comments?: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: employeeId,
    type: 'evaluation_returned',
    evaluationId,
    managerName,
    comments
  });
}

/**
 * Notifica o gerente quando o colaborador revisa a avaliação
 */
export async function notifyManagerEvaluationRevised(
  managerId: string,
  evaluationId: string,
  employeeName: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: managerId,
    type: 'evaluation_revised',
    evaluationId,
    employeeName
  });
}

/**
 * Notifica o colaborador quando a avaliação é finalizada pelo gerente
 */
export async function notifyEmployeeEvaluationCompleted(
  employeeId: string,
  evaluationId: string,
  managerName: string
): Promise<boolean> {
  return createEvaluationNotification({
    userId: employeeId,
    type: 'evaluation_completed',
    evaluationId,
    managerName
  });
}
