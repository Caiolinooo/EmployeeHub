import { supabase, supabaseAdmin } from '@/lib/supabase';
import { NotificacoesAvaliacaoService } from './notificacoes-avaliacao';
import { isValidUUID } from '@/lib/uuid-utils';

export interface AvaliacaoWorkflow {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  pontuacao_total: number;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export class AvaliacaoWorkflowService {
  private static notificacoesService: NotificacoesAvaliacaoService = new NotificacoesAvaliacaoService();

  /**
   * Cria uma nova avaliação com notificações automáticas
   */
  static async createAvaliacao(data: {
    funcionario_id: string;
    avaliador_id: string;
    periodo: string;
    status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
    data_inicio?: string;
    data_fim?: string;
    observacoes?: string;
    pontuacao_total?: number;
  }): Promise<{ success: boolean; data?: AvaliacaoWorkflow; error?: string }> {
    try {
      console.log('AvaliacaoWorkflowService: Iniciando criação de avaliação:', data);

      // Validar dados obrigatórios
      if (!data.funcionario_id || !data.avaliador_id || !data.periodo) {
        return {
          success: false,
          error: 'Dados obrigatórios não fornecidos: funcionario_id, avaliador_id, periodo'
        };
      }

      // Validar formato dos IDs
      if (!isValidUUID(data.funcionario_id)) {
        return {
          success: false,
          error: 'ID do funcionário inválido'
        };
      }

      if (!isValidUUID(data.avaliador_id)) {
        return {
          success: false,
          error: 'ID do avaliador inválido'
        };
      }

      // Verificar se já existe uma avaliação para este funcionário neste período
      const { data: existingEvaluations, error: checkError } = await supabase
        .from('avaliacoes_desempenho')
        .select('id')
        .eq('periodo', data.periodo)
        .eq('funcionario_id', data.funcionario_id);

      if (checkError) {
        console.error('AvaliacaoWorkflowService: Erro ao verificar avaliações existentes:', checkError);
        return {
          success: false,
          error: 'Erro ao verificar avaliações existentes'
        };
      }

      if (existingEvaluations && existingEvaluations.length > 0) {
        return {
          success: false,
          error: 'Já existe uma avaliação para este funcionário neste período'
        };
      }

      // Preparar dados da avaliação
      const avaliacaoData = {
        funcionario_id: data.funcionario_id,
        avaliador_id: data.avaliador_id,
        periodo: data.periodo,
        status: data.status || 'pendente',
        data_inicio: data.data_inicio || new Date().toISOString().split('T')[0],
        data_fim: data.data_fim || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
        observacoes: data.observacoes || '',
        pontuacao_total: data.pontuacao_total || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Inserir avaliação no banco de dados
      const { data: avaliacao, error: insertError } = await supabase
        .from('avaliacoes_desempenho')
        .insert(avaliacaoData)
        .select()
        .single();

      if (insertError) {
        console.error('AvaliacaoWorkflowService: Erro ao inserir avaliação:', insertError);
        return {
          success: false,
          error: insertError.message
        };
      }

      if (!avaliacao) {
        return {
          success: false,
          error: 'Erro ao criar avaliação: dados não retornados'
        };
      }

      console.log('AvaliacaoWorkflowService: Avaliação criada com sucesso:', avaliacao.id);

      // Buscar informações do funcionário e avaliador para notificações
      let funcionario: Usuario | null = null;
      let avaliador: Usuario | null = null;

      try {
        // Buscar informações do funcionário
        const { data: funcData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email')
          .eq('id', avaliacao.funcionario_id)
          .single();

        if (funcData) {
          funcionario = funcData as Usuario;
        }

        // Buscar informações do avaliador
        const { data: avalData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email')
          .eq('id', avaliacao.avaliador_id)
          .single();

        if (avalData) {
          avaliador = avalData as Usuario;
        }
      } catch (error) {
        console.error('AvaliacaoWorkflowService: Erro ao buscar informações de usuários:', error);
        // Continuar mesmo sem as informações dos usuários
      }

      // Enviar notificações após a criação bem-sucedida
      try {
        await this.sendCreationNotifications(avaliacao as AvaliacaoWorkflow, funcionario, avaliador);
      } catch (notificationError) {
        console.error('AvaliacaoWorkflowService: Erro ao enviar notificações:', notificationError);
        // Não falhar a operação principal se as notificações falharem
      }

      return {
        success: true,
        data: avaliacao as AvaliacaoWorkflow
      };
    } catch (error) {
      console.error('AvaliacaoWorkflowService: Erro inesperado ao criar avaliação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao criar avaliação'
      };
    }
  }

  /**
   * Envia notificações quando uma avaliação é criada
   */
  private static async sendCreationNotifications(
    avaliacao: AvaliacaoWorkflow,
    funcionario: Usuario | null,
    avaliador: Usuario | null
  ): Promise<void> {
    console.log('AvaliacaoWorkflowService: Enviando notificações de criação para avaliação:', avaliacao.id);

    try {
      // Notificar o funcionário sobre a nova avaliação
      if (funcionario) {
        await NotificacoesAvaliacaoService.notificarAutoavaliacaoPendente(
          funcionario.id,
          avaliacao.id,
          avaliacao.data_fim
        );
        console.log(`AvaliacaoWorkflowService: Notificação enviada para funcionário ${funcionario.id}`);
      }

      // Notificar o avaliador sobre a nova avaliação atribuída
      if (avaliador) {
        // Usar um método genérico para notificar o avaliador
        await this.notificarPeriodoIniciadoParaAvaliador(
          avaliador.id,
          avaliacao.id,
          funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Funcionário',
          avaliacao.data_fim
        );
        console.log(`AvaliacaoWorkflowService: Notificação enviada para avaliador ${avaliador.id}`);
      }
    } catch (error) {
      console.error('AvaliacaoWorkflowService: Erro ao enviar notificações de criação:', error);
      throw error;
    }
  }

  /**
   * Notifica o avaliador sobre o início do período de avaliação
   */
  private static async notificarPeriodoIniciadoParaAvaliador(
    avaliadorId: string,
    avaliacaoId: string,
    funcionarioNome: string,
    dataLimite: string
  ): Promise<void> {
    try {
      // Criar notificação personalizada para o avaliador
      await NotificacoesAvaliacaoService.criarNotificacao({
        usuario_id: avaliadorId,
        tipo: 'periodo_iniciado',
        titulo: 'Nova Avaliação Atribuída',
        mensagem: `Uma nova avaliação foi atribuída para você. Funcionário: ${funcionarioNome}. Prazo: ${new Date(dataLimite).toLocaleDateString('pt-BR')}.`,
        dados_avaliacao: {
          avaliacao_id: avaliacaoId,
          funcionario_nome: funcionarioNome,
          data_limite: dataLimite
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      });
    } catch (error) {
      console.error('Erro ao notificar avaliador sobre período iniciado:', error);
      throw error;
    }
  }

  /**
   * Envia notificações quando o status de uma avaliação é atualizado
   */
  public static async sendStatusUpdateNotifications(
    avaliacao: AvaliacaoWorkflow,
    statusAnterior: string,
    novoStatus: string,
    funcionario: Usuario | null,
    avaliador: Usuario | null
  ): Promise<void> {
    console.log(`AvaliacaoWorkflowService: Status alterado de ${statusAnterior} para ${novoStatus}. Enviando notificações para avaliação:`, avaliacao.id);

    try {
      // Notificar based on new status
      if (novoStatus === 'concluida') {
        // Notificar o funcionário que a avaliação foi concluída
        if (funcionario) {
          await NotificacoesAvaliacaoService.notificarAvaliacaoAprovada(
            funcionario.id,
            avaliacao.id,
            avaliador ? `${avaliador.first_name} ${avaliador.last_name}` : 'Avaliador'
          );
          console.log(`AvaliacaoWorkflowService: Notificação de conclusão enviada para funcionário ${funcionario.id}`);
        }

        // Notificar o avaliador que a avaliação foi concluída
        if (avaliador) {
          // Criar notificação personalizada para o avaliador
          await NotificacoesAvaliacaoService.criarNotificacao({
            usuario_id: avaliador.id,
            tipo: 'avaliacao_finalizada',
            titulo: 'Avaliação Finalizada',
            mensagem: `Você finalizou a avaliação de ${funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'funcionário'} com sucesso.`,
            dados_avaliacao: {
              avaliacao_id: avaliacao.id,
              funcionario_nome: funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Funcionário',
              data_limite: avaliacao.data_fim
            },
            lida: false,
            enviada_push: false,
            enviada_email: false
          });
          console.log(`AvaliacaoWorkflowService: Notificação de conclusão enviada para avaliador ${avaliador.id}`);
        }
      } else if (novoStatus === 'em_andamento') {
        // Notificar o funcionário que a avaliação está em andamento
        if (funcionario) {
          await NotificacoesAvaliacaoService.notificarAutoavaliacaoRecebida(
            avaliador ? avaliador.id : '',
            avaliacao.id,
            `${funcionario.first_name} ${funcionario.last_name}`
          );
          console.log(`AvaliacaoWorkflowService: Notificação de andamento enviada para funcionário ${funcionario.id}`);
        }
      } else if (novoStatus === 'cancelada') {
        // Notificar ambos sobre o cancelamento
        if (funcionario) {
          // Criar notificação de cancelamento para o funcionário
          await NotificacoesAvaliacaoService.criarNotificacao({
            usuario_id: funcionario.id,
            tipo: 'avaliacao_editada',
            titulo: 'Avaliação Cancelada',
            mensagem: `Sua avaliação foi cancelada.`,
            dados_avaliacao: {
              avaliacao_id: avaliacao.id,
              gerente_nome: avaliador ? `${avaliador.first_name} ${avaliador.last_name}` : 'Avaliador',
              data_limite: avaliacao.data_fim
            },
            lida: false,
            enviada_push: false,
            enviada_email: false
          });
          console.log(`AvaliacaoWorkflowService: Notificação de cancelamento enviada para funcionário ${funcionario.id}`);
        }

        if (avaliador) {
          // Criar notificação de cancelamento para o avaliador
          await NotificacoesAvaliacaoService.criarNotificacao({
            usuario_id: avaliador.id,
            tipo: 'avaliacao_editada',
            titulo: 'Avaliação Cancelada',
            mensagem: `Você cancelou a avaliação de ${funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'funcionário'}.`,
            dados_avaliacao: {
              avaliacao_id: avaliacao.id,
              funcionario_nome: funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Funcionário',
              data_limite: avaliacao.data_fim
            },
            lida: false,
            enviada_push: false,
            enviada_email: false
          });
          console.log(`AvaliacaoWorkflowService: Notificação de cancelamento enviada para avaliador ${avaliador.id}`);
        }
      }
    } catch (error) {
      console.error('AvaliacaoWorkflowService: Erro ao enviar notificações de atualização de status:', error);
      throw error;
    }
  }

  /**
   * Envia notificações quando uma avaliação é movida para a lixeira
   */
  public static async sendTrashNotifications(
    avaliacaoId: string,
    funcionarioId: string,
    avaliadorId: string,
    motivo: string = 'excluída'
  ): Promise<void> {
    console.log(`AvaliacaoWorkflowService: Enviando notificações de lixeira para avaliação: ${avaliacaoId}`);

    try {
      // Buscar informações do funcionário e avaliador
      let funcionario: Usuario | null = null;
      let avaliador: Usuario | null = null;

      try {
        const { data: funcData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email')
          .eq('id', funcionarioId)
          .single();

        if (funcData) {
          funcionario = funcData as Usuario;
        }

        const { data: avalData } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email')
          .eq('id', avaliadorId)
          .single();

        if (avalData) {
          avaliador = avalData as Usuario;
        }
      } catch (error) {
        console.error('AvaliacaoWorkflowService: Erro ao buscar informações de usuários para notificação de lixeira:', error);
      }

      // Notificar o funcionário que a avaliação foi movida para a lixeira
      if (funcionario) {
        await NotificacoesAvaliacaoService.criarNotificacao({
          usuario_id: funcionario.id,
          tipo: 'avaliacao_editada',
          titulo: 'Avaliação Movida para Lixeira',
          mensagem: `Sua avaliação foi movida para a lixeira e será excluída permanentemente em 30 dias.`,
          dados_avaliacao: {
            avaliacao_id: avaliacaoId,
            gerente_nome: avaliador ? `${avaliador.first_name} ${avaliador.last_name}` : 'Administrador'
          }
        });
        console.log(`AvaliacaoWorkflowService: Notificação de lixeira enviada para funcionário ${funcionario.id}`);
      }

      // Notificar o avaliador que a avaliação foi movida para a lixeira
      if (avaliador && avaliador.id !== funcionarioId) {
        await NotificacoesAvaliacaoService.criarNotificacao({
          usuario_id: avaliador.id,
          tipo: 'avaliacao_editada',
          titulo: 'Avaliação Movida para Lixeira',
          mensagem: `A avaliação de ${funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'funcionário'} foi movida para a lixeira.`,
          dados_avaliacao: {
            avaliacao_id: avaliacaoId,
            funcionario_nome: funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Funcionário'
          }
        });
        console.log(`AvaliacaoWorkflowService: Notificação de lixeira enviada para avaliador ${avaliador.id}`);
      }
    } catch (error) {
      console.error('AvaliacaoWorkflowService: Erro ao enviar notificações de lixeira:', error);
      throw error;
    }
  }

  /**
   * Verifica e envia lembretes para avaliações pendentes
   */
  static async verificarEnviarLembretes(): Promise<{ success: boolean; lembretesEnviados: number; error?: string }> {
    try {
      console.log('AvaliacaoWorkflowService: Iniciando verificação de lembretes');

      // Buscar avaliações pendentes e em andamento que estão próximas do vencimento
      const hoje = new Date();
      const daqui3Dias = new Date();
      daqui3Dias.setDate(hoje.getDate() + 3);

      const { data: avaliacoesPendentes, error: fetchError } = await supabase
        .from('avaliacoes_desempenho')
        .select(`
          id,
          funcionario_id,
          avaliador_id,
          periodo,
          data_fim,
          status
        `)
        .in('status', ['pendente', 'em_andamento'])
        .lte('data_fim', daqui3Dias.toISOString().split('T')[0])
        .gt('data_fim', hoje.toISOString().split('T')[0]);

      if (fetchError) {
        console.error('AvaliacaoWorkflowService: Erro ao buscar avaliações pendentes:', fetchError);
        return {
          success: false,
          lembretesEnviados: 0,
          error: fetchError.message
        };
      }

      if (!avaliacoesPendentes || avaliacoesPendentes.length === 0) {
        console.log('AvaliacaoWorkflowService: Nenhuma avaliação pendente encontrada para lembrete');
        return {
          success: true,
          lembretesEnviados: 0
        };
      }

      console.log(`AvaliacaoWorkflowService: Encontradas ${avaliacoesPendentes.length} avaliações para lembrete`);

      let lembretesEnviados = 0;

      // Para cada avaliação pendente, enviar lembretes
      for (const avaliacao of avaliacoesPendentes) {
        try {
          // Buscar informações do funcionário
          const { data: funcionario } = await supabase
            .from('users_unified')
            .select('id, first_name, last_name, email')
            .eq('id', avaliacao.funcionario_id)
            .single();

          // Buscar informações do avaliador
          const { data: avaliador } = await supabase
            .from('users_unified')
            .select('id, first_name, last_name, email')
            .eq('id', avaliacao.avaliador_id)
            .single();

          if (funcionario) {
            // Enviar lembrete para o funcionário
            await NotificacoesAvaliacaoService.notificarAutoavaliacaoPendente(
              funcionario.id,
              avaliacao.id,
              avaliacao.data_fim
            );
            console.log(`AvaliacaoWorkflowService: Lembrete enviado para funcionário ${funcionario.id}`);
            lembretesEnviados++;
          }

          if (avaliador) {
            // Criar notificação de lembrete para o avaliador
            await NotificacoesAvaliacaoService.criarNotificacao({
              usuario_id: avaliador.id,
              tipo: 'aprovacao_prazo',
              titulo: 'Lembrete de Avaliação',
              mensagem: `Você tem uma avaliação pendente de ${funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'funcionário'} com prazo em ${new Date(avaliacao.data_fim).toLocaleDateString('pt-BR')}.`,
              dados_avaliacao: {
                avaliacao_id: avaliacao.id,
                funcionario_nome: funcionario ? `${funcionario.first_name} ${funcionario.last_name}` : 'Funcionário',
                data_limite: avaliacao.data_fim
              },
              lida: false,
              enviada_push: false,
              enviada_email: false
            });
            console.log(`AvaliacaoWorkflowService: Lembrete enviado para avaliador ${avaliador.id}`);
            lembretesEnviados++;
          }
        } catch (error) {
          console.error(`AvaliacaoWorkflowService: Erro ao enviar lembrete para avaliação ${avaliacao.id}:`, error);
          // Continuar com as próximas avaliações mesmo se esta falhar
        }
      }

      console.log(`AvaliacaoWorkflowService: Lembretes enviados com sucesso. Total: ${lembretesEnviados}`);

      return {
        success: true,
        lembretesEnviados
      };
    } catch (error) {
      console.error('AvaliacaoWorkflowService: Erro inesperado ao verificar lembretes:', error);
      return {
        success: false,
        lembretesEnviados: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao verificar lembretes'
      };
    }
  }

  /**
   * Salva a autoavaliação do colaborador
   */
  static async salvarAutoavaliacao(
    avaliacaoId: string,
    userId: string,
    dados: any
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Salvando autoavaliação ${avaliacaoId} para usuário ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          dados_colaborador: dados,
          status: 'em_andamento',
          data_autoavaliacao: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('funcionario_id', userId);

      if (error) {
        console.error('Erro ao salvar autoavaliação:', error);
        return false;
      }

      // Enviar notificação para o avaliador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'autoavaliacao_salva');

      console.log('AvaliacaoWorkflowService: Autoavaliação salva com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao salvar autoavaliação:', error);
      return false;
    }
  }

  /**
   * Salva a avaliação do gerente
   */
  static async salvarAvaliacaoGerente(
    avaliacaoId: string,
    userId: string,
    dados: any
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Salvando avaliação do gerente ${avaliacaoId} por ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          dados_gerente: dados,
          status: 'em_andamento',
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('avaliador_id', userId);

      if (error) {
        console.error('Erro ao salvar avaliação do gerente:', error);
        return false;
      }

      // Enviar notificação para o colaborador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'avaliacao_gerente_salva');

      console.log('AvaliacaoWorkflowService: Avaliação do gerente salva com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao salvar avaliação do gerente:', error);
      return false;
    }
  }

  /**
   * Submete a avaliação do colaborador para revisão do gerente
   */
  static async submeterAvaliacaoColaborador(
    avaliacaoId: string,
    userId: string,
    dados: any
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Submetendo avaliação ${avaliacaoId} por colaborador ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          dados_colaborador: dados,
          status: 'aguardando_aprovacao',
          data_autoavaliacao: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('funcionario_id', userId);

      if (error) {
        console.error('Erro ao submeter avaliação:', error);
        return false;
      }

      // Enviar notificação para o avaliador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'submetida');

      console.log('AvaliacaoWorkflowService: Avaliação submetida com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao submeter avaliação:', error);
      return false;
    }
  }

  /**
   * Aprova a avaliação
   */
  static async aprovarAvaliacao(
    avaliacaoId: string,
    userId: string,
    dados: any
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Aprovando avaliação ${avaliacaoId} por ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          dados_gerente: dados,
          status: 'concluida',
          status_aprovacao: 'aprovada',
          data_aprovacao: new Date().toISOString(),
          aprovado_por: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('avaliador_id', userId);

      if (error) {
        console.error('Erro ao aprovar avaliação:', error);
        return false;
      }

      // Enviar notificação para o colaborador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'aprovada');

      console.log('AvaliacaoWorkflowService: Avaliação aprovada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao aprovar avaliação:', error);
      return false;
    }
  }

  /**
   * Devolve a avaliação para o colaborador revisar
   */
  static async devolverAvaliacao(
    avaliacaoId: string,
    userId: string,
    dados: any
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Devolvendo avaliação ${avaliacaoId} por ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          status: 'devolvida',
          status_aprovacao: 'devolvida',
          comentario_avaliador: dados.comentario || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('avaliador_id', userId);

      if (error) {
        console.error('Erro ao devolver avaliação:', error);
        return false;
      }

      // Enviar notificação para o colaborador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'devolvida');

      console.log('AvaliacaoWorkflowService: Avaliação devolvida com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao devolver avaliação:', error);
      return false;
    }
  }

  /**
   * Reenvia a avaliação após correções
   */
  static async reenviarAvaliacao(
    avaliacaoId: string,
    userId: string
  ): Promise<boolean> {
    try {
      console.log(`AvaliacaoWorkflowService: Reenviando avaliação ${avaliacaoId} por ${userId}`);

      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          status: 'aguardando_aprovacao',
          status_aprovacao: 'pendente',
          updated_at: new Date().toISOString()
        })
        .eq('id', avaliacaoId)
        .eq('funcionario_id', userId);

      if (error) {
        console.error('Erro ao reenviar avaliação:', error);
        return false;
      }

      // Enviar notificação para o avaliador
      await this.sendStatusUpdateNotifications(avaliacaoId, 'reenviada');

      console.log('AvaliacaoWorkflowService: Avaliação reenviada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao reenviar avaliação:', error);
      return false;
    }
  }
}