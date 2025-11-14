// src/lib/notificationService.server.ts
'use server';

import { supabase } from './supabase';
import { sendEmail } from './email-service';
import {
  evaluationCreatedTemplate,
  evaluationCreatedManagerTemplate,
  selfEvaluationCompletedTemplate,
  evaluationApprovedTemplate,
} from './emailTemplates';

export const sendNewEvaluationNotificationServer = async (evaluation: any) => {
  const evaluationId = evaluation.id;

  const { data: fullEvaluation } = await supabase
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
  const colaboradorEmail = ev.funcionario?.email;
  const gerenteEmail = ev.avaliador?.email;

  if (colaboradorEmail) {
    const html = evaluationCreatedTemplate(
      ev.funcionario?.name || 'Colaborador',
      periodoNome,
      ev.periodo?.data_limite_autoavaliacao,
      `/avaliacao/ver/${evaluationId}`
    );
    await sendEmail(colaboradorEmail, 'Nova avaliação de desempenho disponível', '', html);
  }

  if (gerenteEmail) {
    const html = evaluationCreatedManagerTemplate(
      ev.avaliador?.name || 'Gestor',
      ev.funcionario?.name || 'Colaborador',
      periodoNome,
      `/avaliacao/ver/${evaluationId}`
    );
    await sendEmail(gerenteEmail, 'Nova avaliação para seu liderado', '', html);
  }
};
