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
  const evaluationId = evaluation.id;

  // Buscar dados completos da avaliacao para obter emails
  const { data: fullEvaluation, error } = await supabase
    .from('avaliacoes_desempenho')
    .select(
      `*,
      funcionario:users_unified!avaliacoes_desempenho_funcionario_id_fkey(id, name, email),
      avaliador:users_unified!avaliacoes_desempenho_avaliador_id_fkey(id, name, email),
      periodo:periodos_avaliacao(id, nome, data_limite_autoavaliacao)`
    )
    .eq('id', evaluationId)
    .single();

  const ev = fullEvaluation || evaluation;

  const periodoNome = ev.periodo?.nome || ev.periodo || '';
  const dataLimiteAutoavaliacao = ev.periodo?.data_limite_autoavaliacao || undefined;
  const colaboradorNome = ev.funcionario?.name || ev.dados_colaborador?.name || '';
  const gerenteNome = ev.avaliador?.name || '';
  const colaboradorEmail = ev.funcionario?.email;
  const gerenteEmail = ev.avaliador?.email;
  const linkRelativo = `/avaliacao/ver/${evaluationId}`;

  // Notify employee (in-app)
  await createNotification({
    user_id: ev.funcionario_id,
    title: 'Nova Avaliação de Desempenho',
    message: `Uma nova avaliação para o período ${periodoNome} foi iniciada.`,
    link: linkRelativo,
  });

  // Notify manager (in-app)
  await createNotification({
    user_id: ev.avaliador_id,
    title: 'Nova Avaliação para Liderado',
    message: `Uma nova avaliação para ${colaboradorNome} foi iniciada.`,
    link: linkRelativo,
  });

  // Emails são enviados via API server-side
};

/**
 * Sends a notification when a self-evaluation is completed.
 */
export const sendSelfEvaluationCompleteNotification = async (evaluation: any) => {
  const evaluationId = evaluation.id;

  const { data: fullEvaluation, error } = await supabase
    .from('avaliacoes_desempenho')
    .select(
      `*,
      funcionario:users_unified!avaliacoes_desempenho_funcionario_id_fkey(id, name, email),
      avaliador:users_unified!avaliacoes_desempenho_avaliador_id_fkey(id, name, email),
      periodo:periodos_avaliacao(id, nome)`
    )
    .eq('id', evaluationId)
    .single();

  const ev = fullEvaluation || evaluation;

  const periodoNome = ev.periodo?.nome || ev.periodo || '';
  const colaboradorNome = ev.funcionario?.name || ev.dados_colaborador?.name || '';
  const gerenteNome = ev.avaliador?.name || '';
  const gerenteEmail = ev.avaliador?.email;
  const linkRelativo = `/avaliacao/ver/${evaluationId}`;

  await createNotification({
    user_id: ev.avaliador_id,
    title: 'Autoavaliação Concluída',
    message: `${colaboradorNome} completou a autoavaliação.`,
    link: linkRelativo,
  });

  // Email enviado via API server-side
};

/**
 * Sends a notification when an evaluation is approved.
 */
export const sendEvaluationApprovedNotification = async (evaluation: any) => {
  const evaluationId = evaluation.id;

  const { data: fullEvaluation, error } = await supabase
    .from('avaliacoes_desempenho')
    .select(
      `*,
      funcionario:users_unified!avaliacoes_desempenho_funcionario_id_fkey(id, name, email),
      periodo:periodos_avaliacao(id, nome)`
    )
    .eq('id', evaluationId)
    .single();

  const ev = fullEvaluation || evaluation;

  const periodoNome = ev.periodo?.nome || ev.periodo || '';
  const colaboradorNome = ev.funcionario?.name || ev.dados_colaborador?.name || '';
  const colaboradorEmail = ev.funcionario?.email;
  const linkRelativo = `/avaliacao/ver/${evaluationId}`;

  await createNotification({
    user_id: ev.funcionario_id,
    title: 'Avaliação Concluída',
    message: `Sua avaliação de desempenho para o período ${periodoNome} foi concluída.`,
    link: linkRelativo,
  });

  // Email enviado via API server-side
};
