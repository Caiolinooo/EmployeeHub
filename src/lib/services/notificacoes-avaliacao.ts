import { supabase } from '@/lib/supabase';

/**
 * Tipos de notificação para avaliação
 */
export type TipoNotificacaoAvaliacao = 
  | 'periodo_iniciado'
  | 'autoavaliacao_pendente'
  | 'autoavaliacao_prazo'
  | 'autoavaliacao_recebida'
  | 'aprovacao_pendente'
  | 'aprovacao_prazo'
  | 'avaliacao_aprovada'
  | 'avaliacao_editada'
  | 'avaliacao_finalizada';

/**
 * Interface para notificação de avaliação
 */
export interface NotificacaoAvaliacao {
  id?: string;
  usuario_id: string;
  tipo: TipoNotificacaoAvaliacao;
  titulo: string;
  mensagem: string;
  dados_avaliacao: {
    avaliacao_id?: string;
    periodo_avaliacao_id?: string;
    funcionario_nome?: string;
    gerente_nome?: string;
    data_limite?: string;
  };
  created_at?: string;
}

/**
 * Serviço para gerenciar notificações de avaliação
 */
export class NotificacoesAvaliacaoService {

  /**
   * Cria uma notificação no banco de dados
   */
  static async criarNotificacao(notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'>): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notificacao.usuario_id,
          type: notificacao.tipo,
          title: notificacao.titulo,
          message: notificacao.mensagem,
          data: notificacao.dados_avaliacao
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return null;
    }
  }

  /**
   * Notifica início de período de avaliação
   */
  static async notificarInicioPeriodo(periodoId: string, periodoNome: string, dataLimite: string): Promise<void> {
    try {
      // Buscar todos os funcionários ativos
      const { data: funcionarios, error } = await supabase
        .from('users_unified')
        .select('id, name, email')
        .eq('active', true)
        .in('role', ['user', 'gerente']);

      if (error || !funcionarios) {
        console.error('Erro ao buscar funcionários:', error);
        return;
      }

      // Criar notificações para todos os funcionários
      const notificacoes = funcionarios.map(funcionario => ({
        usuario_id: funcionario.id,
        tipo: 'periodo_iniciado' as TipoNotificacaoAvaliacao,
        titulo: 'Período de Avaliação Iniciado',
        mensagem: `O período "${periodoNome}" foi iniciado. Complete sua autoavaliação até ${new Date(dataLimite).toLocaleDateString('pt-BR')}.`,
        dados_avaliacao: {
          periodo_avaliacao_id: periodoId,
          data_limite: dataLimite
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      }));

      // Inserir todas as notificações
      for (const notificacao of notificacoes) {
        await this.criarNotificacao(notificacao);
        
        // Enviar notificação push se disponível
        await this.enviarNotificacaoPush(notificacao);
      }

    } catch (error) {
      console.error('Erro ao notificar início do período:', error);
    }
  }

  /**
   * Notifica funcionário sobre autoavaliação pendente
   */
  static async notificarAutoavaliacaoPendente(
    funcionarioId: string, 
    avaliacaoId: string, 
    dataLimite: string
  ): Promise<void> {
    try {
      const notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'> = {
        usuario_id: funcionarioId,
        tipo: 'autoavaliacao_pendente',
        titulo: 'Autoavaliação Pendente',
        mensagem: `Você tem uma autoavaliação pendente. Complete até ${new Date(dataLimite).toLocaleDateString('pt-BR')}.`,
        dados_avaliacao: {
          avaliacao_id: avaliacaoId,
          data_limite: dataLimite
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      };

      await this.criarNotificacao(notificacao);
      await this.enviarNotificacaoPush(notificacao);
    } catch (error) {
      console.error('Erro ao notificar autoavaliação pendente:', error);
    }
  }

  /**
   * Notifica gerente sobre autoavaliação recebida
   */
  static async notificarAutoavaliacaoRecebida(
    gerenteId: string,
    avaliacaoId: string,
    funcionarioNome: string
  ): Promise<void> {
    try {
      const notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'> = {
        usuario_id: gerenteId,
        tipo: 'autoavaliacao_recebida',
        titulo: 'Autoavaliação Recebida',
        mensagem: `${funcionarioNome} completou sua autoavaliação e aguarda sua aprovação.`,
        dados_avaliacao: {
          avaliacao_id: avaliacaoId,
          funcionario_nome: funcionarioNome
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      };

      await this.criarNotificacao(notificacao);
      await this.enviarNotificacaoPush(notificacao);
    } catch (error) {
      console.error('Erro ao notificar autoavaliação recebida:', error);
    }
  }

  /**
   * Notifica funcionário sobre aprovação da avaliação
   */
  static async notificarAvaliacaoAprovada(
    funcionarioId: string,
    avaliacaoId: string,
    gerenteNome: string,
    comentarios?: string
  ): Promise<void> {
    try {
      const mensagem = comentarios 
        ? `Sua avaliação foi aprovada por ${gerenteNome}. Comentários: ${comentarios}`
        : `Sua avaliação foi aprovada por ${gerenteNome}.`;

      const notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'> = {
        usuario_id: funcionarioId,
        tipo: 'avaliacao_aprovada',
        titulo: 'Avaliação Aprovada',
        mensagem,
        dados_avaliacao: {
          avaliacao_id: avaliacaoId,
          gerente_nome: gerenteNome
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      };

      await this.criarNotificacao(notificacao);
      await this.enviarNotificacaoPush(notificacao);
    } catch (error) {
      console.error('Erro ao notificar avaliação aprovada:', error);
    }
  }

  /**
   * Notifica funcionário sobre edição da avaliação
   */
  static async notificarAvaliacaoEditada(
    funcionarioId: string,
    avaliacaoId: string,
    gerenteNome: string,
    comentarios?: string
  ): Promise<void> {
    try {
      const mensagem = comentarios 
        ? `Sua avaliação foi editada por ${gerenteNome}. Comentários: ${comentarios}`
        : `Sua avaliação foi editada por ${gerenteNome}.`;

      const notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'> = {
        usuario_id: funcionarioId,
        tipo: 'avaliacao_editada',
        titulo: 'Avaliação Editada',
        mensagem,
        dados_avaliacao: {
          avaliacao_id: avaliacaoId,
          gerente_nome: gerenteNome
        },
        lida: false,
        enviada_push: false,
        enviada_email: false
      };

      await this.criarNotificacao(notificacao);
      await this.enviarNotificacaoPush(notificacao);
    } catch (error) {
      console.error('Erro ao notificar avaliação editada:', error);
    }
  }

  /**
   * Envia notificação push (implementação básica)
   */
  static async enviarNotificacaoPush(notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'>): Promise<void> {
    try {
      // Verificar se o usuário tem push notifications habilitadas
      const { data: configuracao } = await supabase
        .from('user_preferences')
        .select('push_notifications')
        .eq('user_id', notificacao.usuario_id)
        .single();

      if (!configuracao?.push_notifications) {
        return;
      }

      // Aqui você implementaria a integração com um serviço de push notifications
      // como Firebase Cloud Messaging, OneSignal, etc.
      console.log('Enviando push notification:', {
        userId: notificacao.usuario_id,
        title: notificacao.titulo,
        message: notificacao.mensagem
      });

      // Marcar como enviada
      await supabase
        .from('notifications')
        .update({ push_sent: true })
        .eq('user_id', notificacao.usuario_id)
        .eq('title', notificacao.titulo);

    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
    }
  }

  /**
   * Cria pop-up de notificação para usuário logado
   */
  static async criarPopupAvaliacao(
    usuarioId: string,
    tipo: TipoNotificacaoAvaliacao,
    dados: any
  ): Promise<void> {
    try {
      // Armazenar no localStorage para exibir como pop-up
      const popup = {
        id: Date.now().toString(),
        tipo,
        dados,
        timestamp: new Date().toISOString()
      };

      const popupsExistentes = JSON.parse(localStorage.getItem('avaliacaoPopups') || '[]');
      popupsExistentes.push(popup);
      localStorage.setItem('avaliacaoPopups', JSON.stringify(popupsExistentes));

      // Disparar evento customizado para o componente de pop-ups
      window.dispatchEvent(new CustomEvent('novoPopupAvaliacao', { detail: popup }));
    } catch (error) {
      console.error('Erro ao criar popup:', error);
    }
  }

  /**
   * Verifica e envia lembretes de prazo
   */
  static async verificarPrazos(): Promise<void> {
    try {
      const hoje = new Date();
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);

      // Buscar avaliações com prazo próximo
      const { data: avaliacoesPendentes } = await supabase
        .from('avaliacoes')
        .select(`
          id,
          funcionario_id,
          etapa_atual,
          periodos_avaliacao!inner(
            data_limite_autoavaliacao,
            data_limite_aprovacao
          ),
          users_unified!funcionario_id(name)
        `)
        .in('etapa_atual', ['autoavaliacao', 'aguardando_gerente']);

      if (!avaliacoesPendentes) return;

      for (const avaliacao of avaliacoesPendentes) {
        const dataLimite = avaliacao.etapa_atual === 'autoavaliacao' 
          ? avaliacao.periodos_avaliacao.data_limite_autoavaliacao
          : avaliacao.periodos_avaliacao.data_limite_aprovacao;

        const limite = new Date(dataLimite);
        
        // Se o prazo é amanhã, enviar lembrete
        if (limite.toDateString() === amanha.toDateString()) {
          if (avaliacao.etapa_atual === 'autoavaliacao') {
            await this.notificarAutoavaliacaoPendente(
              avaliacao.funcionario_id,
              avaliacao.id,
              dataLimite
            );
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar prazos:', error);
    }
  }
}
