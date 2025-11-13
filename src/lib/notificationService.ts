// src/lib/notificationService.ts
import { supabase } from './supabase';

interface Notification {
  user_id: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates a new notification in the database.
 */
export const createNotification = async (notification: Notification) => {
  const { data, error } = await supabase.from('notifications').insert([
    {
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      is_read: false,
    },
  ]);

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  return data;
};

/**
 * Sends a notification for a new evaluation.
 */
export const sendNewEvaluationNotification = async (evaluation: any) => {
  // Notify employee
  await createNotification({
    user_id: evaluation.funcionario_id,
    title: 'Nova Avaliação de Desempenho',
    message: `Uma nova avaliação para o período ${evaluation.periodo} foi iniciada.`,
    link: `/avaliacao/ver/${evaluation.id}`,
  });

  // Notify manager
  await createNotification({
    user_id: evaluation.avaliador_id,
    title: 'Nova Avaliação para Liderado',
    message: `Uma nova avaliação para ${evaluation.dados_colaborador?.name} foi iniciada.`,
    link: `/avaliacao/ver/${evaluation.id}`,
  });
};

/**
 * Sends a notification when a self-evaluation is completed.
 */
export const sendSelfEvaluationCompleteNotification = async (evaluation: any) => {
    await createNotification({
      user_id: evaluation.avaliador_id,
      title: 'Autoavaliação Concluída',
      message: `${evaluation.dados_colaborador?.name} completou a autoavaliação.`,
      link: `/avaliacao/ver/${evaluation.id}`,
    });
  };

/**
 * Sends a notification when an evaluation is approved.
 */
export const sendEvaluationApprovedNotification = async (evaluation: any) => {
    await createNotification({
        user_id: evaluation.funcionario_id,
        title: 'Avaliação Concluída',
        message: `Sua avaliação de desempenho para o período ${evaluation.periodo} foi concluída.`,
        link: `/avaliacao/ver/${evaluation.id}`,
    });
};
