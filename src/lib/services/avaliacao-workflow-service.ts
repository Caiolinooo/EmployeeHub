/**
 * Serviço de Workflow para Avaliação de Desempenho - NOVO MODELO
 * Implementa o fluxo completo sem pesos, com notificações e aprovações
 */

import { supabase } from '@/lib/supabase';
import {
  calcularMediaSimples,
  validarAvaliacaoCompleta,
  getCriteriosPorTipoRespondente,
  converterAvaliacaoAntiga,
  type ResultadoAvaliacao
} from '@/data/criterios-avaliacao';

export interface Avaliacao {
  id: string;
  ciclo_id: string;
  funcionario_id: string;
  avaliador_id?: string;
  status: 'pendente' | 'em_andamento' | 'aguardando_gerente' | 'aprovado' | 'devolvido' | 'finalizado';
  dados_colaborador?: DadosColaborador;
  dados_gerente?: DadosGerente;
  resultado?: ResultadoAvaliacao;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  approved_at?: string;
  auditoria: AuditoriaAvaliacao[];
}

export interface DadosColaborador {
  questao_11_pontos_fortes: string;
  questao_12_areas_melhoria: string;
  questao_13_objetivos_alcancados: string;
  questao_14_planos_desenvolvimento: string;
  // Notas das competências (opcional - pode ser avaliado pelo gerente)
  notas?: Record<string, number>;
}

export interface DadosGerente {
  // Notas das competências atribuídas pelo gerente
  notas?: Record<string, number>;
  // Comentário do avaliador (questão 15)
  comentario_avaliador: string;
  motivo_devolucao?: string;
}

export interface AuditoriaAvaliacao {
  id: string;
  avaliacao_id: string;
  usuario_id: string;
  acao: string;
  dados_anteriores?: any;
  dados_novos?: any;
  timestamp: string;
  ip_address?: string;
}

export interface CicloAvaliacao {
  id: string;
  ano: number;
  nome: string;
  descricao: string;
  status: 'rascunho' | 'aberto' | 'encerrado';
  data_inicio: string;
  data_fim: string;
  created_at: string;
}

export interface NotificacaoAvaliacao {
  id: string;
  usuario_id: string;
  tipo: 'abertura_ciclo' | 'submissao_colaborador' | 'revisao_gerente' | 'aprovacao' | 'devolucao' | 'reenvio';
  titulo: string;
  mensagem: string;
  dados: any;
  lida: boolean;
  created_at: string;
}

class AvaliacaoWorkflowService {
  /**
   * Abrir ciclo anual de avaliação
   */
  async abrirCicloAnual(ano: number, configuracao?: Partial<CicloAvaliacao>): Promise<string> {
    console.log(`🚀 Abrindo ciclo de avaliação para o ano ${ano}`);

    const ciclo: Partial<CicloAvaliacao> = {
      ano,
      nome: `Ciclo de Avaliação ${ano}`,
      descricao: `Avaliação de desempenho anual - ${ano}`,
      status: 'aberto',
      data_inicio: new Date().toISOString(),
      data_fim: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 dias
      ...configuracao
    };

    const { data, error } = await supabase
      .from('ciclos_avaliacao')
      .insert(ciclo)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao abrir ciclo:', error);
      throw new Error(`Erro ao abrir ciclo: ${error.message}`);
    }

    console.log(`✅ Ciclo ${ano} aberto com ID: ${data.id}`);

    // Criar avaliações para todos os funcionários elegíveis
    await this.criarAvaliacoesParaCiclo(data.id);

    return data.id;
  }

  /**
   * Criar avaliações para todos os funcionários elegíveis no ciclo
   */
  private async criarAvaliacoesParaCiclo(cicloId: string): Promise<void> {
    console.log(`📋 Criando avaliações para o ciclo ${cicloId}`);

    // Buscar todos os funcionários ativos
    const { data: funcionarios, error } = await supabase
      .from('users_unified')
      .select('id, first_name, last_name, email, role')
      .eq('active', true)
      .eq('is_authorized', true);

    if (error) {
      console.error('❌ Erro ao buscar funcionários:', error);
      throw new Error(`Erro ao buscar funcionários: ${error.message}`);
    }

    console.log(`👥 Encontrados ${funcionarios?.length || 0} funcionários elegíveis`);

    // Criar avaliação para cada funcionário
    for (const funcionario of funcionarios || []) {
      await this.criarAvaliacaoParaFuncionario(cicloId, funcionario.id);
    }

    console.log('✅ Avaliações criadas com sucesso');
  }

  /**
   * Criar avaliação individual para um funcionário
   */
  async criarAvaliacaoParaFuncionario(cicloId: string, funcionarioId: string): Promise<string> {
    const avaliacao: Partial<Avaliacao> = {
      ciclo_id: cicloId,
      funcionario_id: funcionarioId,
      status: 'pendente',
      auditoria: []
    };

    const { data, error } = await supabase
      .from('avaliacoes_desempenho')
      .insert(avaliacao)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar avaliação:', error);
      throw new Error(`Erro ao criar avaliação: ${error.message}`);
    }

    // Enviar notificação de abertura do ciclo
    await this.enviarNotificacao(funcionarioId, 'abertura_ciclo', {
      avaliacaoId: data.id,
      cicloId,
      titulo: 'Nova Avaliação Disponível',
      mensagem: `Sua avaliação de desempenho está disponível para resposta.`
    });

    return data.id;
  }

  /**
   * Salvar rascunho da autoavaliação do colaborador
   */
  async salvarAutoavaliacao(
    avaliacaoId: string,
    funcionarioId: string,
    dados: DadosColaborador
  ): Promise<boolean> {
    console.log(`💾 Salvando autoavaliação: ${avaliacaoId}`);

    // Validar se a avaliação pertence ao funcionário
    const { data: avaliacao, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('funcionario_id', funcionarioId)
      .single();

    if (checkError || !avaliacao) {
      console.error('❌ Avaliação não encontrada ou sem permissão');
      return false;
    }

    // Atualizar dados do colaborador
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        dados_colaborador: dados,
        status: 'em_andamento',
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId);

    if (updateError) {
      console.error('❌ Erro ao salvar autoavaliação:', updateError);
      return false;
    }

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, funcionarioId, 'salvar_autoavaliacao', null, dados);

    console.log('✅ Autoavaliação salva com sucesso');
    return true;
  }

  /**
   * Submeter avaliação do colaborador
   */
  async submeterAvaliacaoColaborador(
    avaliacaoId: string,
    funcionarioId: string,
    dados: DadosColaborador
  ): Promise<boolean> {
    console.log(`📤 Submetendo avaliação: ${avaliacaoId}`);

    // Validar dados completos
    const validacao = validarAvaliacaoCompleta(dados.notas || {}, 'colaborador');
    if (!validacao.valida) {
      console.error('❌ Validação falhou:', validacao.mensagens);
      throw new Error(`Dados incompletos: ${validacao.mensagens.join(', ')}`);
    }

    // Calcular resultado parcial
    const resultado = calcularMediaSimples(dados.notas || {});

    // Atualizar avaliação
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        dados_colaborador: dados,
        resultado,
        status: 'aguardando_gerente',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId)
      .eq('funcionario_id', funcionarioId);

    if (updateError) {
      console.error('❌ Erro ao submeter avaliação:', updateError);
      return false;
    }

    // Buscar avaliação para identificar o gerente
    const { data: avaliacaoCompleta } = await supabase
      .from('avaliacoes_desempenho')
      .select(`
        id,
        funcionario_id,
        avaliador_id,
        periodo,
        data_inicio,
        data_fim,
        status,
        pontuacao_total,
        observacoes,
        created_at,
        updated_at,
        deleted_at,
        users_unified!avaliacoes_desempenho_funcionario_id_fkey(
          id,
          first_name,
          last_name,
          email,
          position,
          department
        )
      `)
      .eq('id', avaliacaoId)
      .single();

    // Identificar gerente (poderia ser via hierarquia ou campo específico)
    const gerenteId = await this.identificarGerenteDoFuncionario(funcionarioId);

    // Atualizar avaliador
    if (gerenteId) {
      await supabase
        .from('avaliacoes_desempenho')
        .update({ avaliador_id: gerenteId })
        .eq('id', avaliacaoId);

      // Notificar gerente
      await this.enviarNotificacao(gerenteId, 'submissao_colaborador', {
        avaliacaoId,
        funcionarioId,
        funcionarioNome: avaliacaoCompleta?.users_unified?.first_name,
        titulo: 'Nova Avaliação para Revisão',
        mensagem: `${avaliacaoCompleta?.users_unified?.first_name} submeteu sua avaliação para revisão.`
      });
    }

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, funcionarioId, 'submeter_avaliacao', null, {
      dados_colaborador: dados,
      status: 'aguardando_gerente'
    });

    console.log('✅ Avaliação submetida com sucesso');
    return true;
  }

  /**
   * Salvar avaliação do gerente
   */
  async salvarAvaliacaoGerente(
    avaliacaoId: string,
    gerenteId: string,
    dados: DadosGerente
  ): Promise<boolean> {
    console.log(`💾 Salvando avaliação do gerente: ${avaliacaoId}`);

    // Validar permissão
    const { data: avaliacao, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('avaliador_id', gerenteId)
      .single();

    if (checkError || !avaliacao) {
      console.error('❌ Gerente não tem permissão para esta avaliação');
      return false;
    }

    // Atualizar dados do gerente
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        dados_gerente: dados,
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId);

    if (updateError) {
      console.error('❌ Erro ao salvar avaliação do gerente:', updateError);
      return false;
    }

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, gerenteId, 'salvar_avaliacao_gerente', null, dados);

    console.log('✅ Avaliação do gerente salva com sucesso');
    return true;
  }

  /**
   * Aprovar avaliação
   */
  async aprovarAvaliacao(
    avaliacaoId: string,
    gerenteId: string,
    dadosGerente: DadosGerente
  ): Promise<boolean> {
    console.log(`✅ Aprovando avaliação: ${avaliacaoId}`);

    // Validar comentário obrigatório
    if (!dadosGerente.comentario_avaliador || dadosGerente.comentario_avaliador.trim() === '') {
      throw new Error('O comentário do avaliador é obrigatório para aprovar a avaliação');
    }

    // Validar permissão
    const { data: avaliacao, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('avaliador_id', gerenteId)
      .single();

    if (checkError || !avaliacao) {
      console.error('❌ Gerente não tem permissão para esta avaliação');
      return false;
    }

    // Calcular resultado final
    const resultadoFinal = calcularMediaSimples(dadosGerente.notas || {});

    // Atualizar avaliação
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        dados_gerente: dadosGerente,
        resultado: resultadoFinal,
        status: 'aprovado',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId);

    if (updateError) {
      console.error('❌ Erro ao aprovar avaliação:', updateError);
      return false;
    }

    // Notificar colaborador
    await this.enviarNotificacao(avaliacao.funcionario_id, 'aprovacao', {
      avaliacaoId,
      titulo: 'Avaliação Aprovada',
      mensagem: 'Sua avaliação de desempenho foi aprovada pelo seu gestor.',
      resultado: resultadoFinal
    });

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, gerenteId, 'aprovar_avaliacao', null, {
      dados_gerente: dadosGerente,
      status: 'aprovado',
      resultado: resultadoFinal
    });

    console.log('✅ Avaliação aprovada com sucesso');
    return true;
  }

  /**
   * Devolver avaliação para ajustes
   */
  async devolverAvaliacao(
    avaliacaoId: string,
    gerenteId: string,
    dadosGerente: DadosGerente
  ): Promise<boolean> {
    console.log(`🔄 Devolvendo avaliação: ${avaliacaoId}`);

    if (!dadosGerente.motivo_devolucao || dadosGerente.motivo_devolucao.trim() === '') {
      throw new Error('O motivo da devolução é obrigatório');
    }

    // Validar permissão
    const { data: avaliacao, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('avaliador_id', gerenteId)
      .single();

    if (checkError || !avaliacao) {
      console.error('❌ Gerente não tem permissão para esta avaliação');
      return false;
    }

    // Atualizar avaliação
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        dados_gerente: dadosGerente,
        status: 'devolvido',
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId);

    if (updateError) {
      console.error('❌ Erro ao devolver avaliação:', updateError);
      return false;
    }

    // Notificar colaborador
    await this.enviarNotificacao(avaliacao.funcionario_id, 'devolucao', {
      avaliacaoId,
      motivo: dadosGerente.motivo_devolucao,
      titulo: 'Avaliação Devolvida para Ajustes',
      mensagem: `Sua avaliação foi devolvida para ajustes. Motivo: ${dadosGerente.motivo_devolucao}`
    });

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, gerenteId, 'devolver_avaliacao', null, {
      dados_gerente: dadosGerente,
      status: 'devolvido'
    });

    console.log('✅ Avaliação devolvida com sucesso');
    return true;
  }

  /**
   * Reenviar avaliação após ajustes
   */
  async reenviarAvaliacao(avaliacaoId: string, funcionarioId: string): Promise<boolean> {
    console.log(`🔄 Reenviando avaliação: ${avaliacaoId}`);

    // Validar permissão e status
    const { data: avaliacao, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('funcionario_id', funcionarioId)
      .eq('status', 'devolvido')
      .single();

    if (checkError || !avaliacao) {
      console.error('❌ Avaliação não encontrada ou não pode ser reenviada');
      return false;
    }

    // Atualizar status
    const { error: updateError } = await supabase
      .from('avaliacoes_desempenho')
      .update({
        status: 'aguardando_gerente',
        updated_at: new Date().toISOString()
      })
      .eq('id', avaliacaoId);

    if (updateError) {
      console.error('❌ Erro ao reenviar avaliação:', updateError);
      return false;
    }

    // Notificar gerente
    if (avaliacao.avaliador_id) {
      await this.enviarNotificacao(avaliacao.avaliador_id, 'reenvio', {
        avaliacaoId,
        funcionarioId,
        titulo: 'Avaliação Reenviada para Revisão',
        mensagem: 'Avaliação foi ajustada e reenviada para sua revisão.'
      });
    }

    // Registrar auditoria
    await this.registrarAuditoria(avaliacaoId, funcionarioId, 'reenviar_avaliacao', null, {
      status: 'aguardando_gerente'
    });

    console.log('✅ Avaliação reenviada com sucesso');
    return true;
  }

  /**
   * Obter avaliações do usuário
   */
  async obterAvaliacoesDoUsuario(usuarioId: string, papel: 'colaborador' | 'gerente'): Promise<Avaliacao[]> {
    let query = supabase
      .from('avaliacoes_desempenho')
      .select(`
        *,
        ciclos_avaliacao (*),
        users_unified!avaliacoes_desempenho_funcionario_id_fkey (*),
        avaliador_users:users_unified!avaliacoes_desempenho_avaliador_id_fkey (*)
      `);

    if (papel === 'colaborador') {
      query = query.eq('funcionario_id', usuarioId);
    } else {
      query = query.eq('avaliador_id', usuarioId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar avaliações:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Gerar relatório de avaliações
   */
  async gerarRelatorio(
    cicloId?: string,
    filtros?: {
      gerenteId?: string;
      status?: string;
      departamento?: string;
    }
  ): Promise<any> {
    console.log('📊 Gerando relatório de avaliações');

    let query = supabase
      .from('avaliacoes_desempenho')
      .select(`
        *,
        ciclos_avaliacao (*),
        users_unified!avaliacoes_desempenho_funcionario_id_fkey (*),
        avaliador_users:users_unified!avaliacoes_desempenho_avaliador_id_fkey (*)
      `);

    // Aplicar filtros
    if (cicloId) {
      query = query.eq('ciclo_id', cicloId);
    }
    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros?.gerenteId) {
      query = query.eq('avaliador_id', filtros.gerenteId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      throw new Error(`Erro ao gerar relatório: ${error.message}`);
    }

    // Processar dados para relatório
    const relatorio = {
      resumo: {
        total: data?.length || 0,
        aprovados: data?.filter(a => a.status === 'aprovado').length || 0,
        pendentes: data?.filter(a => a.status === 'pendente').length || 0,
        em_andamento: data?.filter(a => a.status === 'em_andamento').length || 0,
        aguardando: data?.filter(a => a.status === 'aguardando_gerente').length || 0
      },
      avaliacoes: data?.map(avaliacao => ({
        ...avaliacao,
        // Converter avaliações antigas para novo formato se necessário
        resultado: converterAvaliacaoAntiga(avaliacao)
      })) || []
    };

    console.log(`✅ Relatório gerado: ${relatorio.resumo.total} avaliações`);
    return relatorio;
  }

  /**
   * Métodos privados auxiliares
   */
  private async identificarGerenteDoFuncionario(funcionarioId: string): Promise<string | null> {
    // Lógica para identificar o gerente do funcionário
    // Poderia ser baseada em hierarquia, departamento, ou campo específico
    const { data: funcionario } = await supabase
      .from('users_unified')
      .select('manager_id, department')
      .eq('id', funcionarioId)
      .single();

    return funcionario?.manager_id || null;
  }

  private async enviarNotificacao(
    usuarioId: string,
    tipo: string,
    dados: any
  ): Promise<void> {
    console.log(`📧 Enviando notificação ${tipo} para ${usuarioId}`);

    const notificacao = {
      usuario_id: usuarioId,
      tipo,
      titulo: dados.titulo,
      mensagem: dados.mensagem,
      dados,
      lida: false
    };

    const { error } = await supabase
      .from('notificacoes_avaliacao')
      .insert(notificacao);

    if (error) {
      console.error('❌ Erro ao enviar notificação:', error);
    } else {
      console.log('✅ Notificação enviada com sucesso');
    }
  }

  private async registrarAuditoria(
    avaliacaoId: string,
    usuarioId: string,
    acao: string,
    dadosAnteriores: any,
    dadosNovos: any
  ): Promise<void> {
    const auditoria = {
      avaliacao_id: avaliacaoId,
      usuario_id: usuarioId,
      acao,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      timestamp: new Date().toISOString()
    };

    await supabase
      .from('auditoria_avaliacoes')
      .insert(auditoria);
  }
}

// Exportar instância única
export const AvaliacaoWorkflowService = new AvaliacaoWorkflowService();