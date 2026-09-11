/**
 * Ações Interativas do Módulo Férias
 * Portal ABZ - IA Actions
 */
import { supabaseAdmin } from '@/lib/supabase';
import { registerAction } from '../actions-registry';
import type { IAAction, IAActionContext, IAActionResult } from '@/types/ia-global';

/**
 * Ação: Aprovar solicitação de férias
 */
const approveFeriasAction: IAAction = {
  id: 'ferias_approve',
  name: 'aprovar_ferias',
  label: 'Aprovar Férias',
  description: 'Aprovar uma solicitação de férias de um funcionário',
  module: 'ferias',
  icon: '✅',
  requiresPermission: 'ferias:write',
  requiresRole: ['ADMIN', 'GERENTE'],
  parameters: [
    {
      name: 'solicitacao_id',
      type: 'string',
      description: 'ID da solicitação de férias',
      required: true,
    },
    {
      name: 'comentario',
      type: 'string',
      description: 'Comentário opcional do aprovador',
      required: false,
    },
  ],
  confirmBeforeExecute: true,
  requiresTargetVerification: true,
  execute: async (params, context): Promise<IAActionResult> => {
    const { solicitacao_id, comentario } = params;

    try {
      // Buscar a solicitação
      const { data: solicitacao, error: fetchError } = await supabaseAdmin
        .from('leave_requests')
        .select('*, user:users_unified(first_name, last_name)')
        .eq('id', solicitacao_id)
        .single();

      if (fetchError || !solicitacao) {
        return {
          success: false,
          message: 'Solicitação não encontrada',
        };
      }

      // Verificar se já está pendente
      if (solicitacao.status !== 'PENDING_LEADER' && solicitacao.status !== 'PENDING_MANAGER') {
        return {
          success: false,
          message: `Esta solicitação não está pendente (status: ${solicitacao.status})`,
        };
      }

      // Verificar se o usuário é o gerente do funcionário (se for gerente)
      if (context.userRole === 'GERENTE' && context.teamMemberIds) {
        if (!context.teamMemberIds.includes(solicitacao.user_id)) {
          return {
            success: false,
            message: 'Você só pode aprovar férias de membros da sua equipe',
          };
        }
      }

      const nextStatus =
        solicitacao.status === 'PENDING_LEADER' ? 'PENDING_MANAGER' : 'APPROVED';

      // Aprovar
      const { error: updateError } = await supabaseAdmin
        .from('leave_requests')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacao_id);

      if (updateError) {
        return {
          success: false,
          message: `Erro ao aprovar: ${updateError.message}`,
        };
      }

      // Enviar notificação (implementar depois)
      
      const nomeFuncionario = solicitacao.user 
        ? `${solicitacao.user.first_name} ${solicitacao.user.last_name}`
        : 'Funcionário';

      return {
        success: true,
        message: `✅ Férias aprovadas com sucesso!\n\n**Funcionário:** ${nomeFuncionario}\n**Período:** ${solicitacao.start_date} a ${solicitacao.end_date}\n${comentario ? `**Comentário:** ${comentario}` : ''}`,
        notification: {
          type: 'success',
          title: 'Férias Aprovadas',
          message: `As férias de ${nomeFuncionario} foram aprovadas`,
        },
        requiresRefresh: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  },
};

/**
 * Ação: Reprovar solicitação de férias
 */
const rejectFeriasAction: IAAction = {
  id: 'ferias_reject',
  name: 'reprovar_ferias',
  label: 'Reprovar Férias',
  description: 'Reprovar uma solicitação de férias de um funcionário',
  module: 'ferias',
  icon: '❌',
  requiresPermission: 'ferias:write',
  requiresRole: ['ADMIN', 'GERENTE'],
  parameters: [
    {
      name: 'solicitacao_id',
      type: 'string',
      description: 'ID da solicitação de férias',
      required: true,
    },
    {
      name: 'motivo',
      type: 'string',
      description: 'Motivo da reprovação (obrigatório)',
      required: true,
    },
  ],
  confirmBeforeExecute: true,
  requiresTargetVerification: true,
  execute: async (params, context): Promise<IAActionResult> => {
    const { solicitacao_id, motivo } = params;

    if (!motivo || (motivo as string).trim().length === 0) {
      return {
        success: false,
        message: 'É necessário informar o motivo da reprovação',
      };
    }

    try {
      const { data: solicitacao, error: fetchError } = await supabaseAdmin
        .from('leave_requests')
        .select('*, user:users_unified(first_name, last_name)')
        .eq('id', solicitacao_id)
        .single();

      if (fetchError || !solicitacao) {
        return {
          success: false,
          message: 'Solicitação não encontrada',
        };
      }

      if (solicitacao.status !== 'PENDING_LEADER' && solicitacao.status !== 'PENDING_MANAGER') {
        return {
          success: false,
          message: `Esta solicitação não está pendente (status: ${solicitacao.status})`,
        };
      }

      if (context.userRole === 'GERENTE' && context.teamMemberIds) {
        if (!context.teamMemberIds.includes(solicitacao.user_id)) {
          return {
            success: false,
            message: 'Você só pode reprovar férias de membros da sua equipe',
          };
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('leave_requests')
        .update({
          status: 'REJECTED',
          rejection_reason: motivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacao_id);

      if (updateError) {
        return {
          success: false,
          message: `Erro ao reprovar: ${updateError.message}`,
        };
      }

      const nomeFuncionario = solicitacao.user 
        ? `${solicitacao.user.first_name} ${solicitacao.user.last_name}`
        : 'Funcionário';

      return {
        success: true,
        message: `❌ Férias reprovadas!\n\n**Funcionário:** ${nomeFuncionario}\n**Período:** ${solicitacao.start_date} a ${solicitacao.end_date}\n**Motivo:** ${motivo}`,
        notification: {
          type: 'warning',
          title: 'Férias Reprovadas',
          message: `As férias de ${nomeFuncionario} foram reprovadas`,
        },
        requiresRefresh: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  },
};

/**
 * Ação: Solicitar férias (para funcionários)
 */
const solicitarFeriasAction: IAAction = {
  id: 'ferias_request',
  name: 'solicitar_ferias',
  label: 'Solicitar Férias',
  description: 'Solicitar novas férias',
  module: 'ferias',
  icon: '🏖️',
  requiresPermission: 'ferias:write',
  requiresRole: ['ADMIN', 'GERENTE', 'USER'],
  parameters: [
    {
      name: 'data_inicio',
      type: 'string',
      description: 'Data de início das férias (YYYY-MM-DD)',
      required: true,
    },
    {
      name: 'data_fim',
      type: 'string',
      description: 'Data de fim das férias (YYYY-MM-DD)',
      required: true,
    },
    {
      name: 'motivo',
      type: 'string',
      description: 'Motivo ou observação',
      required: false,
    },
  ],
  confirmBeforeExecute: true,
  requiresTargetVerification: false,
  execute: async (params, context): Promise<IAActionResult> => {
    const { data_inicio, data_fim, motivo } = params;

    try {
      // Validar datas
      const inicio = new Date(data_inicio as string);
      const fim = new Date(data_fim as string);
      
      if (inicio > fim) {
        return {
          success: false,
          message: 'A data de início não pode ser posterior à data de fim',
        };
      }

      if (inicio < new Date()) {
        return {
          success: false,
          message: 'A data de início não pode ser no passado',
        };
      }

      const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error: insertError } = await supabaseAdmin
        .from('leave_requests')
        .insert({
          user_id: context.userId,
          start_date: data_inicio,
          end_date: data_fim,
          reason: motivo || 'Férias programadas',
          status: 'PENDING_LEADER',
        });

      if (insertError) {
        return {
          success: false,
          message: `Erro ao solicitar: ${insertError.message}`,
        };
      }

      return {
        success: true,
        message: `✅ Solicitação de férias enviada!\n\n**Período:** ${data_inicio} a ${data_fim}\n**Dias:** ${dias}\n**Status:** Pendente de aprovação\n\nSua solicitação será analisada pelo seu gerente.`,
        notification: {
          type: 'info',
          title: 'Férias Solicitadas',
          message: `Solicitação de ${dias} dias enviada para aprovação`,
        },
        requiresRefresh: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  },
};

/**
 * Registra todas as ações do módulo Férias
 */
export function registerActions(): void {
  registerAction(approveFeriasAction);
  registerAction(rejectFeriasAction);
  registerAction(solicitarFeriasAction);
  console.log('[IA Actions] Ferias module loaded');
}