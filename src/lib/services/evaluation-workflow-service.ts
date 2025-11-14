/**
 * Serviço de workflow para avaliações - Versão 2.0
 * Implementa o fluxo completo conforme especificações AN-TED-002-R0
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { NotificacoesAvaliacaoService } from './notificacoes-avaliacao';
import {
  EvaluationStatus,
  RespondentType,
  Avaliacao,
  AvaliacaoNotificacao
} from '@/lib/schemas/evaluation-schemas';

export interface EvaluationWorkflow {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  ciclo_id: string;
  status: EvaluationStatus;
  periodo: string;
  data_inicio?: string;
  data_fim?: string;
  created_at: string;
  updated_at?: string;
}

export interface Usuario {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
}

export class EvaluationWorkflowService {
  private static notificacoesService = new NotificacoesAvaliacaoService();

  /**
   * Enviar notificações quando uma avaliação é criada
   */
  static async sendEvaluationNotifications(
    avaliacaoId: string,
    funcionarioId: string,
    avaliadorId: string
  ): Promise<void> {
    console.log('EvaluationWorkflowService: Enviando notificações de criação de avaliação');

    try {
      // Buscar informações do funcionário e avaliador
      let funcionario: Usuario | null = null;
      let avaliador: Usuario | null = null;

      // Buscar funcionário
      try {
        const { data: funcData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email, role')
          .eq('id', funcionarioId)
          .single();

        if (funcData) {
          funcionario = funcData as Usuario;
        }
      } catch (error) {
        console.error('Erro ao buscar funcionário:', error);
      }

      // Buscar avaliador
      try {
        const { data: avalData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email, role')
          .eq('id', avaliadorId)
          .single();

        if (avalData) {
          avaliador = avalData as Usuario;
        }
      } catch (error) {
        console.error('Erro ao buscar avaliador:', error);
      }

      // Notificar funcionário sobre nova avaliação
      if (funcionario) {
        await this.createNotification({
          tipo: 'ciclo_abertura',
          titulo: 'Nova Avaliação Disponível',
          mensagem: `Uma nova avaliação está disponível para ser respondida. Por favor, acesse o sistema para preencher sua autoavaliação.`,
          usuario_id: funcionario.id,
          avaliacao_id: avaliacaoId,
          dados: {
            avaliador_nome: avaliador ? `${avaliador.first_name} ${avaliador.last_name}` : 'Gerente',
            proximos_passos: 'Responder perguntas 11-14'
          }
        });
      }

      // Notificar avaliador sobre nova atribuição
      if (avaliador && avaliador.id !== funcionarioId) {
        await this.createNotification({
          tipo: 'submissao',
          titulo: 'Nova Avaliação Atribuída',
          mensagem: `Você foi designado como avaliador para ${funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'um colaborador'}.`,
          usuario_id: avaliador.id,
          avaliacao_id: avaliacaoId,
          dados: {
            funcionario_nome: funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Colaborador',
            proximos_passos: 'Aguardar resposta do colaborador para avaliar'
          }
        });
      }

      console.log('✅ Notificações de criação enviadas com sucesso');
    } catch (error) {
      console.error('❌ Erro ao enviar notificações de criação:', error);
      throw error;
    }
  }

  /**
   * Notificar gerente quando colaborador envia avaliação
   */
  static async notifyManager(
    avaliacaoId: string,
    funcionarioId: string,
    avaliadorId: string
  ): Promise<void> {
    console.log('EvaluationWorkflowService: Notificando gerente sobre submissão');

    try {
      const { data: avaliacao } = await supabase
        .from('avaliacoes_desempenho')
        .select('status, funcionario_id, avaliador_id, periodo')
        .eq('id', avaliacaoId)
        .single();

      if (avaliacao) {
        // Buscar informações do funcionário
        const { data: funcionario } = await supabase
          .from('users_unified')
          .select('first_name, last_name')
          .eq('id', funcionarioId)
          .single();

        if (funcionario) {
          await this.createNotification({
            tipo: 'submissao',
            titulo: 'Avaliação Enviada para Avaliação',
            mensagem: `${funcionario.first_name} ${funcionario.last_name} enviou sua autoavaliação e está aguardando sua avaliação.`,
            usuario_id: avaliadorId,
            avaliacao_id: avaliacaoId,
            dados: {
              funcionario_nome: `${funcionario.first_name} ${funcionario.last_name}`,
              periodo: avaliacao.periodo,
              proximos_passos: 'Avaliar desempenho e fornecer feedback'
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao notificar gerente:', error);
      // Não falhar o processo principal
    }
  }

  /**
   * Notificar sobre decisão do gerente
   */
  static async sendDecisionNotifications(
    avaliacaoId: string,
    acao: 'approve' | 'reject' | 'return',
    motivo?: string
  ): Promise<void> {
    console.log(`EvaluationWorkflowService: Enviando notificação de decisão - ${acao}`);

    try {
      const { data: avaliacao } = await supabase
        .from('avaliacoes_desempenho')
        .select('funcionario_id, avaliador_id, status')
        .eq('id', avaliacaoId)
        .single();

      if (avaliacao) {
        const messages = {
          approve: {
            title: 'Avaliação Aprovada!',
            message: 'Parabéns! Sua avaliação foi aprovada pelo gerente.'
          },
          reject: {
            title: 'Avaliação Rejeitada',
            message: 'Sua avaliação não foi aprovada. Entre em contato com seu gerente para mais informações.'
          },
          return: {
            title: 'Avaliação Devolvida para Ajustes',
            message: motivo || 'Sua avaliação foi devolvida para ajustes.'
          }
        };

        await this.createNotification({
          tipo: acao === 'approve' ? 'aprovacao' : acao === 'reject' ? 'devolucao' : 'reenvio',
          ...messages[acao],
          usuario_id: avaliacao.funcionario_id,
          avaliacao_id: avaliacaoId,
          dados: {
            decisao: acao,
            motivo_devolucao: motivo,
            proximos_passos: acao === 'return' ? 'Realizar os ajustes solicitados e reenviar' : ''
          }
        });
      }
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de decisão:', error);
      // Não falhar o processo principal
    }
  }

  /**
   * Enviar notificação de aprovação
   */
  static async notifyApproval(
    avaliacaoId: string,
    funcionarioId: string
  ): Promise<void> {
    console.log('EvaluationWorkflowService: Enviando notificação de aprovação');

    try {
      await this.createNotification({
        tipo: 'aprovacao',
        titulo: 'Avaliação Aprovada!',
        message: 'Parabéns! Sua avaliação foi aprovada e concluída com sucesso.',
        usuario_id: funcionarioId,
        avaliacao_id: avaliacaoId,
        dados: {
          proximos_passos: 'Visualizar relatórios e histórico de avaliações'
        }
      });
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de aprovação:', error);
    }
  }

  /**
   * Enviar lembretes automáticos (3 dias antes do vencimento)
   */
  static async sendDeadlineReminders(): Promise<{
    success: boolean;
    lembretesEnviados: number;
    error?: string;
  }> {
    console.log('EvaluationWorkflowService: Enviando lembretes de prazo');

    try {
      const hoje = new Date();
      const daqui3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Buscar avaliações pendentes próximas do vencimento
      const { data: avaliacoesPendentes, error } = await supabase
        .from('avaliacoes_desempenho')
        .select('id, funcionario_id, avaliador_id, data_fim, periodo')
        .in('status', ['pending_response', 'under_review'])
        .lte('data_fim', daqui3Dias.toISOString())
        .gte('data_fim', hoje.toISOString());

      if (error) {
        return {
          success: false,
          lembretesEnviados: 0,
          error: error.message
        };
      }

      let lembretesEnviados = 0;

      for (const avaliacao of (avaliacoesPendentes || [])) {
        try {
          await this.createNotification({
            tipo: 'lembrete',
            title: 'Prazo da Avaliação Próximo',
            message: `Sua avaliação do período ${avaliacao.periodo} vence em 3 dias. Não deixe de responder a tempo!`,
            usuario_id: avaliacao.funcionario_id,
            avaliacao_id: avaliacao.id,
            dados: {
              data_limite: avaliacao.data_fim,
              dias_restantes: 3
            }
          });
          lembretesEnviados++;
        } catch (notifError) {
          console.error('Erro ao enviar lembrete:', notifError);
        }
      }

      return {
        success: true,
        lembretesEnviados
      };

    } catch (error) {
      console.error('❌ Erro ao enviar lembretes:', error);
      return {
        success: false,
        lembretesEnviados: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Abrir ciclo de avaliação
   */
  static async openEvaluationCycle(
    cicloId: string,
    usuariosElegiveis: string[]
  ): Promise<{
    success: boolean;
    criadas: number;
    error?: string;
  }> {
    console.log('EvaluationWorkflowService: Abrindo ciclo de avaliação');

    try {
      const { data: ciclo } = await supabaseAdmin
        .from('avaliacao_ciclos')
        .select('*')
        .eq('id', cicloId)
        .single();

      if (!ciclo) {
        return {
          success: false,
          criadas: 0,
          error: 'Ciclo não encontrado'
        };
      }

      // Atualizar status do ciclo
      await supabaseAdmin
        .from('avaliacao_ciclos')
        .update({
          status: 'active',
          data_abertura: new Date().toISOString()
        })
        .eq('id', cicloId);

      let avaliacoesCriadas = 0;

      // Criar avaliações para todos os usuários elegíveis
      for (const userId of usuariosElegiveis) {
        try {
          // Verificar se já existe avaliação para este usuário no ciclo
          const { data: existente } = await supabase
            .from('avaliacoes_desempenho')
            .select('id')
            .eq('ciclo_id', cicloId)
            .eq('funcionario_id', userId)
            .single();

          if (!existente) {
            // Criar avaliação
            await supabaseAdmin
              .from('avaliacoes_desempenho')
              .insert({
                ciclo_id: cicloId,
                funcionario_id: userId,
                avaliador_id: userId, // Autoavaliação inicial
                periodo: `${ciclo.ano}-auto`,
                status: 'pending_response',
                data_inicio: ciclo.data_abertura,
                data_fim: ciclo.data_fim,
                created_at: new Date().toISOString()
              });

            avaliacoesCriadas++;

            // Enviar notificação de abertura
            await this.createNotification({
              tipo: 'ciclo_abertura',
              title: `Ciclo de Avaliação ${ciclo.ano} Aberto`,
              message: `O ciclo de avaliação ${ciclo.ano} foi aberto. Acesse o sistema para iniciar sua autoavaliação.`,
              usuario_id: userId,
              dados: {
                ciclo_id: cicloId,
                ciclo_ano: ciclo.ano,
                data_fim: ciclo.data_fim
              }
            });
          }
        } catch (error) {
          console.error(`Erro ao criar avaliação para usuário ${userId}:`, error);
        }
      }

      return {
        success: true,
        criadas: avaliacoesCriadas
      };

    } catch (error) {
      console.error('❌ Erro ao abrir ciclo:', error);
      return {
        success: false,
        criadas: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Criar notificação (método privado)
   */
  private static async createNotification(data: {
    tipo: string;
    titulo: string;
    mensagem: string;
    usuario_id: string;
    avaliacao_id?: string;
    dados?: Record<string, any>;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: data.usuario_id,
          type: data.tipo,
          title: data.titulo,
          message: data.mensagem,
          data: data.dados,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }
  }

  /**
   * Obter próximo status no fluxo
   */
  static getNextStatus(
    currentStatus: EvaluationStatus,
    acao: string
  ): EvaluationStatus {
    const transitions: Record<string, Record<EvaluationStatus, EvaluationStatus>> = {
      submit: {
        'pending_response': 'awaiting_manager',
        'under_review': 'awaiting_manager'
      },
      approve: {
        'awaiting_manager': 'approved',
        'returned_for_adjustment': 'approved'
      },
      reject: {
        'awaiting_manager': 'rejected',
        'returned_for_adjustment': 'rejected'
      },
      return: {
        'approved': 'under_review',
        'rejected': 'under_review'
      }
    };

    return transitions[acao]?.[currentStatus] || currentStatus;
  }

  /**
   * Validar transição de status
   */
  static isValidStatusTransition(
    fromStatus: EvaluationStatus,
    toStatus: EvaluationStatus
  ): boolean {
    const validTransitions: Record<EvaluationStatus, EvaluationStatus[]> = {
      'pending_response': ['awaiting_manager', 'under_review', 'archived'],
      'awaiting_manager': ['approved', 'rejected', 'returned_for_adjustment', 'archived'],
      'under_review': ['awaiting_manager', 'archived'],
      'returned_for_adjustment': ['under_review'],
      'approved': ['archived'],
      'rejected': ['under_review'],
      'archived': []
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }
}