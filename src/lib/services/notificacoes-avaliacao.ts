import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

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
   * Cria uma notificação no banco de dados e envia por email
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
          data: notificacao.dados_avaliacao,
          action_url: `/avaliacao`,
          priority: 'normal',
          read_at: null
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return null;
      }

      // Enviar email após criar notificação
      await this.enviarNotificacaoEmail(notificacao);

      return data.id;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return null;
    }
  }

  /**
   * Envia notificação por email
   */
  static async enviarNotificacaoEmail(notificacao: Omit<NotificacaoAvaliacao, 'id' | 'created_at'>): Promise<void> {
    try {
      // Buscar email do usuário
      const { data: usuario, error } = await supabase
        .from('users_unified')
        .select('email, first_name, last_name')
        .eq('id', notificacao.usuario_id)
        .single();

      if (error || !usuario?.email) {
        console.error('Erro ao buscar email do usuário:', error);
        return;
      }

      const nomeUsuario = `${usuario.first_name} ${usuario.last_name}`;
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const avaliacaoUrl = `${portalUrl}/avaliacao`;

      // Template de email
      const text = `
Olá ${nomeUsuario},

${notificacao.mensagem}

Acesse o portal para mais detalhes: ${avaliacaoUrl}

Atenciosamente,
Equipe ABZ Group
      `.trim();

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${notificacao.titulo}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f9f9; color: #333333;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); overflow: hidden;">
                  <tr>
                    <td align="center" style="padding: 30px 20px; background-color: #ffffff;">
                      <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" style="max-width: 200px; height: auto;">
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px;">
                      <h2 style="color: #0066cc; text-align: center; margin-top: 0;">${notificacao.titulo}</h2>
                      <p style="margin-bottom: 20px;">Olá ${nomeUsuario},</p>
                      <p style="margin-bottom: 20px;">${notificacao.mensagem}</p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${avaliacaoUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acessar Avaliações</a>
                      </div>
                      <p style="margin-bottom: 5px;">Atenciosamente,</p>
                      <p style="margin-bottom: 20px;"><strong>Equipe ABZ Group</strong></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px; text-align: center; background-color: #ffffff; border-top: 1px solid #e0e0e0;">
                      <p style="font-size: 12px; color: #999999; margin: 0;">&copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await sendEmail(usuario.email, notificacao.titulo, text, html);
      console.log(`Email de notificação enviado para ${usuario.email}`);
    } catch (error) {
      console.error('Erro ao enviar email de notificação:', error);
      // Não falhar a operação principal se o email falhar
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
