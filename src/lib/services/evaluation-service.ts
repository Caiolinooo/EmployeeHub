/**
 * Serviço unificado para gerenciamento de avaliações
 * Substitui os serviços legados e implementa o novo fluxo
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';
import {
  Avaliacao,
  AvaliacaoCiclo,
  AvaliacaoResposta,
  AvaliadorConfig,
  CreateAvaliacaoData,
  ResponderQuestionarioData,
  DecisaoGerenteData,
  AvaliacaoFilters,
  AvaliacaoMetricas,
  EvaluationStatus,
  RespondentType,
  ApiResponse,
  PaginatedList
} from '@/lib/schemas/evaluation-schemas';
import { AvaliacaoWorkflowService } from './avaliacao-workflow-service';
import { EvaluationSettingsService } from './evaluation-settings';

export class EvaluationService {

  /**
   * Criar nova avaliação
   */
  static async createEvaluation(data: CreateAvaliacaoData): Promise<ApiResponse<Avaliacao>> {
    try {
      // Validar se o avaliador está autorizado
      const isAuthorized = await this.isAuthorizedEvaluator(data.avaliador_id);
      if (!isAuthorized) {
        return {
          success: false,
          error: 'Usuário não está autorizado a avaliar',
          timestamp: new Date().toISOString()
        };
      }

      // Criar avaliação
      const { data: avaliacao, error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .insert({
          ciclo_id: data.ciclo_id,
          funcionario_id: data.funcionario_id,
          avaliador_id: data.avaliador_id,
          periodo: data.periodo,
          data_inicio: data.data_inicio || new Date().toISOString().split('T')[0],
          data_fim: data.data_fim,
          status: 'pending_response',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar avaliação:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Enviar notificações
      try {
        await AvaliacaoWorkflowService.sendEvaluationNotifications(
          avaliacao.id,
          data.funcionario_id,
          data.avaliador_id
        );
      } catch (notifError) {
        console.error('Erro ao enviar notificações:', notifError);
        // Não falhar a criação se notificações falharem
      }

      return {
        success: true,
        data: avaliacao,
        message: 'Avaliação criada com sucesso',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado ao criar avaliação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Listar avaliações com filtros
   */
  static async listEvaluations(
    filters: AvaliacaoFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<ApiResponse<PaginatedList<Avaliacao>>> {
    try {
      let query = supabase
        .from('vw_avaliacoes_desempenho')
        .select('*', { count: 'exact' });

      // Aplicar filtros
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.funcionario_id) {
        query = query.eq('funcionario_id', filters.funcionario_id);
      }
      if (filters.avaliador_id) {
        query = query.eq('avaliador_id', filters.avaliador_id);
      }
      if (filters.ciclo_id) {
        query = query.eq('ciclo_id', filters.ciclo_id);
      }
      if (filters.periodo) {
        query = query.eq('periodo', filters.periodo);
      }
      if (filters.data_inicio) {
        query = query.gte('created_at', filters.data_inicio);
      }
      if (filters.data_fim) {
        query = query.lte('created_at', filters.data_fim);
      }

      // Paginação
      const offset = (pagination.page - 1) * pagination.limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Erro ao listar avaliações:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: {
          items: data || [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: count || 0
          }
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado ao listar avaliações:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obter avaliação por ID
   */
  static async getEvaluationById(id: string): Promise<ApiResponse<Avaliacao>> {
    try {
      const { data, error } = await supabase
        .from('vw_avaliacoes_desempenho')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Erro ao buscar avaliação:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Calcular métricas
      const avaliacaoComMetricas = await this.calculateEvaluationMetrics(data);

      return {
        success: true,
        data: avaliacaoComMetricas,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado ao buscar avaliação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Responder questionário de avaliação
   */
  static async submitQuestionnaire(data: ResponderQuestionarioData): Promise<ApiResponse> {
    try {
      // Validar se a avaliação existe e está no status correto
      const { data: avaliacao, error: avaliacaoError } = await supabase
        .from('avaliacoes_desempenho')
        .select('status, funcionario_id, avaliador_id')
        .eq('id', data.avaliacao_id)
        .single();

      if (avaliacaoError || !avaliacao) {
        return {
          success: false,
          error: 'Avaliação não encontrada',
          timestamp: new Date().toISOString()
        };
      }

      // Validar status
      const statusValidos = {
        'collaborator': ['pending_response', 'under_review'],
        'manager': ['awaiting_manager']
      };

      if (!statusValidos[data.respondente_tipo].includes(avaliacao.status)) {
        return {
          success: false,
          error: 'Avaliação não está em status para responder',
          timestamp: new Date().toISOString()
        };
      }

      // Inserir respostas
      const respostasParaInserir = data.respostas.map(resposta => ({
        avaliacao_id: data.avaliacao_id,
        pergunta_id: resposta.pergunta_id,
        nota: resposta.nota,
        comentario: resposta.comentario,
        respondente_tipo: data.respondente_tipo,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabaseAdmin
        .from('avaliacao_respostas')
        .upsert(respostasParaInserir, {
          onConflict: 'avaliacao_id, pergunta_id, respondente_tipo'
        });

      if (insertError) {
        console.error('Erro ao salvar respostas:', insertError);
        return {
          success: false,
          error: insertError.message,
          timestamp: new Date().toISOString()
        };
      }

      // Atualizar status da avaliação
      let novoStatus: EvaluationStatus;
      if (data.respondente_tipo === 'collaborator') {
        novoStatus = 'awaiting_manager';
        // Notificar gerente
        try {
          await AvaliacaoWorkflowService.notifyManager(
            data.avaliacao_id,
            avaliacao.funcionario_id,
            avaliacao.avaliador_id
          );
        } catch (notifError) {
          console.error('Erro ao notificar gerente:', notifError);
        }
      } else {
        novoStatus = 'approved';
        // Notificar colaborador sobre aprovação
        try {
          await AvaliacaoWorkflowService.notifyApproval(
            data.avaliacao_id,
            avaliacao.funcionario_id
          );
        } catch (notifError) {
          console.error('Erro ao notificar colaborador:', notifError);
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          status: novoStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.avaliacao_id);

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
        return {
          success: false,
          error: updateError.message,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Questionário respondido com sucesso',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado ao responder questionário:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Decisão do gerente (aprovar/rejeitar/devolver)
   */
  static async managerDecision(data: DecisaoGerenteData): Promise<ApiResponse> {
    try {
      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          status: data.acao === 'approve' ? 'approved' :
                 data.acao === 'reject' ? 'rejected' : 'returned_for_adjustment',
          updated_at: new Date().toISOString()
        })
        .eq('id', data.avaliacao_id);

      if (error) {
        console.error('Erro na decisão do gerente:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Salvar comentário do avaliador (pergunta 15)
      if (data.comentario_avaliador) {
        await supabaseAdmin
          .from('avaliacao_respostas')
          .upsert({
            avaliacao_id: data.avaliacao_id,
            pergunta_id: 15,
            comentario: data.comentario_avaliador,
            respondente_tipo: 'manager',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'avaliacao_id, pergunta_id, respondente_tipo'
          });
      }

      // Enviar notificações
      try {
        await AvaliacaoWorkflowService.sendDecisionNotifications(
          data.avaliacao_id,
          data.acao,
          data.motivo_devolucao
        );
      } catch (notifError) {
        console.error('Erro ao enviar notificações:', notifError);
      }

      const actionMessages = {
        approve: 'Avaliação aprovada com sucesso',
        reject: 'Avaliação rejeitada',
        return: 'Avaliação devolvida para ajustes'
      };

      return {
        success: true,
        message: actionMessages[data.acao],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado na decisão do gerente:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obter métricas das avaliações
   */
  static async getMetrics(filters: AvaliacaoFilters = {}): Promise<ApiResponse<AvaliacaoMetricas>> {
    try {
      // Contar avaliações por status
      const { data: statusData, error: statusError } = await supabase
        .from('avaliacoes_desempenho')
        .select('status')
        .neq('deleted_at', null);

      if (statusError) throw statusError;

      const porStatus: Record<string, number> = {};
      statusData?.forEach(item => {
        porStatus[item.status] = (porStatus[item.status] || 0) + 1;
      });

      const totalAvaliacoes = statusData?.length || 0;
      const conclusoes = porStatus.approved || 0;
      const taxaConclusao = totalAvaliacoes > 0 ? (conclusoes / totalAvaliacoes) * 100 : 0;

      // TODO: Implementar cálculo de médias por competência quando tivermos respostas
      const porCompetencia: Record<string, number> = {};

      return {
        success: true,
        data: {
          total_avaliacoes: totalAvaliacoes,
          por_status: porStatus as Record<EvaluationStatus, number>,
          por_competencia: porCompetencia,
          taxa_conclusao: Math.round(taxaConclusao * 100) / 100,
          tempo_medio_conclusao: 0 // TODO: Implementar cálculo real
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro ao obter métricas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verificar se usuário está autorizado a avaliar
   */
  private static async isAuthorizedEvaluator(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('avaliacao_config')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .single();

      if (error || !data) {
        // Verificar se é admin ou manager como fallback
        const { data: user } = await supabase
          .from('users_unified')
          .select('role')
          .eq('id', userId)
          .single();

        return user?.role === 'ADMIN' || user?.role === 'MANAGER';
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar autorização:', error);
      return false;
    }
  }

  /**
   * Calcular métricas da avaliação
   */
  private static async calculateEvaluationMetrics(avaliacao: Avaliacao): Promise<Avaliacao> {
    try {
      // Obter respostas da avaliação
      const { data: respostas } = await supabase
        .from('avaliacao_respostas')
        .select('*')
        .eq('avaliacao_id', avaliacao.id);

      if (!respostas || respostas.length === 0) {
        return avaliacao;
      }
      // Obter settings efetivas (usa ciclo_id se existir)
      let settings = null;
      try {
        settings = await EvaluationSettingsService.getEffectiveSettings(avaliacao.ciclo_id || null);
      } catch (e) {
        console.warn('Falha ao obter evaluation settings, usando média simples:', e);
      }

      // Preparar vetor de notas (possível peso por pergunta_id)
      const notas = respostas.map(r => {
        const pesoConfig = settings?.calculo?.weights?.[String(r.pergunta_id)] ?? 1;
        return { valor: r.nota, criterioId: String(r.pergunta_id), peso: pesoConfig };
      });

      // Calcular média considerando settings (simple_average ou weighted)
      const mediaGeral = EvaluationSettingsService.calculateScore(notas, settings);
      avaliacao.media_geral = mediaGeral;

      // TODO: Calcular médias por competência quando tivermos mapeamento
      avaliacao.media_por_competencia = {};

      // Calcular progresso
      // Dependente de settings: se líder inclui 16-17
      const basePerguntas = [11,12,13,14,15];
      const liderPerguntas = [16,17];
      const isLider = respostas.some(r => r.pergunta_id >= 16); // heurística até termos flag robusta
      const totalPerguntas = isLider ? basePerguntas.length + liderPerguntas.length : basePerguntas.length;
      const perguntasRespondidas = new Set(respostas.map(r => r.pergunta_id)).size;
      avaliacao.progresso = (perguntasRespondidas / totalPerguntas) * 100;

      return avaliacao;

    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      return avaliacao;
    }
  }

  /**
   * Excluir avaliação (soft delete)
   */
  static async deleteEvaluation(id: string): Promise<ApiResponse> {
    try {
      const { error } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir avaliação:', error);
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Avaliação excluída com sucesso',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro inesperado ao excluir avaliação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      };
    }
  }
}