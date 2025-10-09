import { supabase } from '@/lib/supabase';

/**
 * Etapas do workflow de avaliação
 */
export type EtapaAvaliacao = 
  | 'autoavaliacao' 
  | 'aguardando_gerente' 
  | 'em_aprovacao' 
  | 'finalizada' 
  | 'cancelada';

/**
 * Interface para período de avaliação
 */
export interface PeriodoAvaliacao {
  id: string;
  nome: string;
  descricao?: string;
  data_inicio: string;
  data_fim: string;
  data_limite_autoavaliacao: string;
  data_limite_aprovacao: string;
  ativo: boolean;
}

/**
 * Interface para autoavaliação
 */
export interface Autoavaliacao {
  id: string;
  avaliacao_id: string;
  funcionario_id: string;
  questao_11_pontos_fortes?: string;
  questao_12_areas_melhoria?: string;
  questao_13_objetivos_alcancados?: string;
  questao_14_planos_desenvolvimento?: string;
  autoavaliacao_criterios?: Record<string, number>;
  data_preenchimento?: string;
}

/**
 * Interface para dados do workflow
 */
export interface DadosWorkflow {
  avaliacao_id: string;
  etapa_atual: EtapaAvaliacao;
  funcionario_id: string;
  avaliador_id?: string;
  periodo_avaliacao_id: string;
  data_autoavaliacao?: string;
  data_envio_gerente?: string;
  data_aprovacao?: string;
  comentarios_gerente?: string;
  aprovada_por?: string;
}

/**
 * Classe para gerenciar o workflow de avaliação
 */
export class WorkflowAvaliacaoService {
  
  /**
   * Inicia uma nova avaliação para um funcionário
   */
  static async iniciarAvaliacao(
    funcionarioId: string, 
    periodoAvaliacaoId: string,
    avaliadorId?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('avaliacoes')
        .insert({
          funcionario_id: funcionarioId,
          avaliador_id: avaliadorId,
          periodo_avaliacao_id: periodoAvaliacaoId,
          etapa_atual: 'autoavaliacao',
          status: 'pendente',
          data_inicio: new Date().toISOString().split('T')[0],
          data_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 dias
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao iniciar avaliação:', error);
        return null;
      }

      // Registrar no histórico
      await this.registrarHistorico(
        data.id,
        null,
        'autoavaliacao',
        funcionarioId,
        'Avaliação iniciada - aguardando autoavaliação'
      );

      return data.id;
    } catch (error) {
      console.error('Erro ao iniciar avaliação:', error);
      return null;
    }
  }

  /**
   * Salva a autoavaliação do funcionário
   */
  static async salvarAutoavaliacao(
    avaliacaoId: string,
    funcionarioId: string,
    dadosAutoavaliacao: Partial<Autoavaliacao>
  ): Promise<boolean> {
    try {
      // Inserir ou atualizar autoavaliação
      const { error: autoavaliacaoError } = await supabase
        .from('autoavaliacoes')
        .upsert({
          avaliacao_id: avaliacaoId,
          funcionario_id: funcionarioId,
          ...dadosAutoavaliacao,
          data_preenchimento: new Date().toISOString()
        });

      if (autoavaliacaoError) {
        console.error('Erro ao salvar autoavaliação:', autoavaliacaoError);
        return false;
      }

      // Atualizar etapa da avaliação
      const { error: avaliacaoError } = await supabase
        .from('avaliacoes')
        .update({
          etapa_atual: 'aguardando_gerente',
          data_autoavaliacao: new Date().toISOString(),
          status: 'em_andamento'
        })
        .eq('id', avaliacaoId);

      if (avaliacaoError) {
        console.error('Erro ao atualizar etapa da avaliação:', avaliacaoError);
        return false;
      }

      // Registrar no histórico
      await this.registrarHistorico(
        avaliacaoId,
        'autoavaliacao',
        'aguardando_gerente',
        funcionarioId,
        'Autoavaliação concluída - enviada para aprovação do gerente'
      );

      return true;
    } catch (error) {
      console.error('Erro ao salvar autoavaliação:', error);
      return false;
    }
  }

  /**
   * Aprova ou edita a avaliação pelo gerente
   */
  static async aprovarAvaliacao(
    avaliacaoId: string,
    gerenteId: string,
    aprovada: boolean,
    comentarios?: string,
    edicoes?: Record<string, any>
  ): Promise<boolean> {
    try {
      const novaEtapa = aprovada ? 'finalizada' : 'em_aprovacao';
      
      const { error } = await supabase
        .from('avaliacoes')
        .update({
          etapa_atual: novaEtapa,
          data_aprovacao: new Date().toISOString(),
          comentarios_gerente: comentarios,
          aprovada_por: gerenteId,
          status: aprovada ? 'concluida' : 'em_andamento',
          ...(edicoes || {})
        })
        .eq('id', avaliacaoId);

      if (error) {
        console.error('Erro ao aprovar avaliação:', error);
        return false;
      }

      // Registrar no histórico
      await this.registrarHistorico(
        avaliacaoId,
        'aguardando_gerente',
        novaEtapa,
        gerenteId,
        aprovada 
          ? 'Avaliação aprovada e finalizada pelo gerente'
          : 'Avaliação editada pelo gerente - aguardando finalização',
        { aprovada, comentarios, edicoes }
      );

      return true;
    } catch (error) {
      console.error('Erro ao aprovar avaliação:', error);
      return false;
    }
  }

  /**
   * Finaliza a avaliação após edições do gerente
   */
  static async finalizarAvaliacao(
    avaliacaoId: string,
    gerenteId: string,
    comentariosFinal?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('avaliacoes')
        .update({
          etapa_atual: 'finalizada',
          status: 'concluida',
          comentarios_gerente: comentariosFinal,
          data_atualizacao: new Date().toISOString()
        })
        .eq('id', avaliacaoId);

      if (error) {
        console.error('Erro ao finalizar avaliação:', error);
        return false;
      }

      // Registrar no histórico
      await this.registrarHistorico(
        avaliacaoId,
        'em_aprovacao',
        'finalizada',
        gerenteId,
        'Avaliação finalizada pelo gerente'
      );

      return true;
    } catch (error) {
      console.error('Erro ao finalizar avaliação:', error);
      return false;
    }
  }

  /**
   * Registra uma entrada no histórico do workflow
   */
  static async registrarHistorico(
    avaliacaoId: string,
    etapaAnterior: EtapaAvaliacao | null,
    etapaNova: EtapaAvaliacao,
    usuarioId: string,
    comentario?: string,
    dadosAdicionais?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase
        .from('historico_avaliacao')
        .insert({
          avaliacao_id: avaliacaoId,
          etapa_anterior: etapaAnterior,
          etapa_nova: etapaNova,
          usuario_id: usuarioId,
          comentario,
          dados_adicionais: dadosAdicionais
        });
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
    }
  }

  /**
   * Obtém o período de avaliação ativo
   */
  static async getPeriodoAvaliacaoAtivo(): Promise<PeriodoAvaliacao | null> {
    try {
      const { data, error } = await supabase
        .from('periodos_avaliacao')
        .select('*')
        .eq('ativo', true)
        .gte('data_fim', new Date().toISOString().split('T')[0])
        .order('data_inicio', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao obter período ativo:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao obter período ativo:', error);
      return null;
    }
  }

  /**
   * Verifica se um funcionário pode fazer autoavaliação
   */
  static async podeAutoavaliar(funcionarioId: string): Promise<boolean> {
    try {
      const periodo = await this.getPeriodoAvaliacaoAtivo();
      if (!periodo) return false;

      const hoje = new Date().toISOString().split('T')[0];
      return hoje <= periodo.data_limite_autoavaliacao;
    } catch (error) {
      console.error('Erro ao verificar se pode autoavaliar:', error);
      return false;
    }
  }
}
