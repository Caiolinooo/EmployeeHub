/**
 * Ações Interativas do Módulo Reembolso
 * Portal ABZ - IA Actions
 */
import { supabaseAdmin } from '@/lib/supabase';
import { registerAction } from '../actions-registry';
import type { IAAction, IAActionContext, IAActionResult } from '@/types/ia-global';

/**
 * Ação: Aprovar reembolso
 */
const approveReembolsoAction: IAAction = {
  id: 'reembolso_approve',
  name: 'aprovar_reembolso',
  label: 'Aprovar Reembolso',
  description: 'Aprovar uma solicitação de reembolso',
  module: 'reembolso',
  icon: '✅',
  requiresPermission: 'reembolso:write',
  requiresRole: ['ADMIN'],
  parameters: [
    { name: 'reembolso_id', type: 'string', description: 'ID do reembolso', required: true },
    { name: 'comentario', type: 'string', description: 'Comentário opcional', required: false },
  ],
  confirmBeforeExecute: true,
  requiresTargetVerification: true,
  execute: async (params, context): Promise<IAActionResult> => {
    const { reembolso_id, comentario } = params;

    try {
      const { data: reembolso, error: fetchError } = await supabaseAdmin
        .from('Reimbursement')
        .select('*, user:users_unified(first_name, last_name)')
        .eq('id', reembolso_id)
        .single();

      if (fetchError || !reembolso) {
        return { success: false, message: 'Reembolso não encontrado' };
      }

      if (reembolso.status !== 'pendente' && reembolso.status !== 'PENDING') {
        return { success: false, message: `Reembolso já está ${reembolso.status}` };
      }

      const { error: updateError } = await supabaseAdmin
        .from('Reimbursement')
        .update({
          status: 'aprovado',
          approvedBy: context.userId,
          approvedAt: new Date().toISOString(),
        })
        .eq('id', reembolso_id);

      if (updateError) {
        return { success: false, message: `Erro: ${updateError.message}` };
      }

      const nomeFuncionario = reembolso.user 
        ? `${reembolso.user.first_name} ${reembolso.user.last_name}`
        : 'Funcionário';

      return {
        success: true,
        message: `✅ Reembolso aprovado!\n\n**Funcionário:** ${nomeFuncionario}\n**Valor:** R$ ${reembolso.valor_total}\n${comentario ? `**Obs:** ${comentario}` : ''}`,
        notification: { type: 'success', title: 'Reembolso Aprovado', message: `R$ ${reembolso.valor_total} aprovado` },
        requiresRefresh: true,
      };
    } catch (error) {
      return { success: false, message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
    }
  },
};

/**
 * Ação: Reprovar reembolso
 */
const rejectReembolsoAction: IAAction = {
  id: 'reembolso_reject',
  name: 'reprovar_reembolso',
  label: 'Reprovar Reembolso',
  description: 'Reprovar uma solicitação de reembolso',
  module: 'reembolso',
  icon: '❌',
  requiresPermission: 'reembolso:write',
  requiresRole: ['ADMIN'],
  parameters: [
    { name: 'reembolso_id', type: 'string', description: 'ID do reembolso', required: true },
    { name: 'motivo', type: 'string', description: 'Motivo da reprovação', required: true },
  ],
  confirmBeforeExecute: true,
  requiresTargetVerification: true,
  execute: async (params, context): Promise<IAActionResult> => {
    const { reembolso_id, motivo } = params as { reembolso_id?: string; motivo?: string };

    if (!motivo) {
      return { success: false, message: 'Informe o motivo da reprovação' };
    }

    try {
      const { error: updateError } = await supabaseAdmin
        .from('Reimbursement')
        .update({
          status: 'rejeitado',
          approvedBy: context.userId,
          approvedAt: new Date().toISOString(),
        })
        .eq('id', reembolso_id);

      if (updateError) {
        return { success: false, message: `Erro: ${updateError.message}` };
      }

      return {
        success: true,
        message: `❌ Reembolso reprovado!\n\n**Motivo:** ${motivo}`,
        notification: { type: 'warning', title: 'Reembolso Reprovado', message: motivo || '' },
        requiresRefresh: true,
      };
    } catch (error) {
      return { success: false, message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
    }
  },
};

export function registerActions() {
  registerAction(approveReembolsoAction);
  registerAction(rejectReembolsoAction);
  console.log('[IA Actions] Reembolso loaded');
}