// src/services/evaluationService.ts
import { supabase } from '@/lib/supabase';
import { Evaluation, EvaluationPeriod, EvaluationCriterion, User } from '@/types';
import { sendNewEvaluationNotification, sendSelfEvaluationCompleteNotification, sendEvaluationApprovedNotification } from '@/lib/notificationService';

// Funções relacionadas ao módulo de avaliação

/**
 * Busca todas as avaliações com base nos filtros fornecidos.
 * Retorna avaliações onde o usuário é funcionário OU avaliador,
 * permitindo que gerentes vejam avaliações de sua equipe E suas próprias avaliações.
 */
export const getEvaluations = async (filters: any): Promise<Evaluation[]> => {
  const { userId, status } = filters || {};

  if (!userId) {
    // Sem userId, buscar todas
    let query = supabase.from('avaliacoes_desempenho').select('*');
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as Evaluation[];
  }

  // Buscar avaliações onde o usuário é funcionário
  let queryAsFuncionario = supabase
    .from('avaliacoes_desempenho')
    .select('*')
    .eq('funcionario_id', userId);

  if (status) {
    queryAsFuncionario = queryAsFuncionario.eq('status', status);
  }

  // Buscar avaliações onde o usuário é avaliador
  let queryAsAvaliador = supabase
    .from('avaliacoes_desempenho')
    .select('*')
    .eq('avaliador_id', userId);

  if (status) {
    queryAsAvaliador = queryAsAvaliador.eq('status', status);
  }

  const [resultFuncionario, resultAvaliador] = await Promise.all([
    queryAsFuncionario,
    queryAsAvaliador
  ]);

  if (resultFuncionario.error) throw resultFuncionario.error;
  if (resultAvaliador.error) throw resultAvaliador.error;

  // Combinar resultados e remover duplicatas (caso existam)
  const allEvaluations = [
    ...(resultFuncionario.data || []),
    ...(resultAvaliador.data || [])
  ];

  // Remover duplicatas baseado no ID
  const uniqueEvaluations = Array.from(
    new Map(allEvaluations.map(ev => [ev.id, ev])).values()
  );

  return uniqueEvaluations as Evaluation[];
};

/**
 * Busca uma avaliação específica pelo ID com dados relacionados.
 */
export const getEvaluationById = async (id: string): Promise<Evaluation | null> => {
  const { data, error } = await supabase
    .from('avaliacoes_desempenho')
    .select(`
      *,
      funcionario:users_unified!avaliacoes_desempenho_funcionario_id_fkey(id, name, email),
      avaliador:users_unified!avaliacoes_desempenho_avaliador_id_fkey(id, name, email),
      periodo:periodos_avaliacao(id, nome, descricao, data_inicio, data_fim, data_limite_autoavaliacao)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Evaluation | null;
};

/**
 * Cria uma nova avaliação.
 */
export const createEvaluation = async (evaluationData: Partial<Evaluation>): Promise<Evaluation> => {
  const { data, error } = await supabase.from('avaliacoes_desempenho').insert([evaluationData]).select().single();
  if (error) throw error;

  await sendNewEvaluationNotification(data);

  return data as Evaluation;
};

/**
 * Atualiza uma avaliação existente.
 */
export const updateEvaluation = async (id: string, updates: Partial<Evaluation>): Promise<Evaluation> => {
  const { data, error } = await supabase.from('avaliacoes_desempenho').update(updates).eq('id', id).select().single();
  if (error) throw error;

  if (updates.status === 'aguardando_aprovacao') {
    await sendSelfEvaluationCompleteNotification(data);
  } else if (updates.status === 'aprovado') {
    await sendEvaluationApprovedNotification(data);
  }

  return data as Evaluation;
};

/**
 * Deleta (soft delete) uma avaliação.
 */
export const deleteEvaluation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('avaliacoes_desempenho').update({ deleted_at: new Date() }).eq('id', id);
  if (error) throw error;
};

/**
 * Busca todos os períodos de avaliação.
 */
export const getEvaluationPeriods = async (): Promise<EvaluationPeriod[]> => {
  const { data, error } = await supabase.from('periodos_avaliacao').select('*');
  if (error) throw error;
  return data as EvaluationPeriod[];
};

/**
 * Busca todos os critérios de avaliação.
 */
export const getEvaluationCriteria = async (): Promise<EvaluationCriterion[]> => {
  const { data, error } = await supabase.from('criterios').select('*');
  if (error) throw error;
  return data as EvaluationCriterion[];
};

/**
 * Busca todos os funcionários.
 * Inclui TODOS os usuários independente do role, pois qualquer usuário
 * pode ser funcionário ou avaliador em uma avaliação.
 */
export const getEmployees = async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users_unified')
      .select('id, name, email, role, department');
  
    if (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  
    return data as User[];
  };

/**
 * Busca o mapeamento de gerentes e colaboradores.
 */
export const getManagerMappings = async () => {
    const { data, error } = await supabase.from('avaliacao_colaborador_gerente').select(`
      id,
      colaborador:colaborador_id ( id, name ),
      gerente:gerente_id ( id, name ),
      periodo:periodo_id ( id, nome )
    `);
  
    if (error) throw error;
    return data;
  };
  
  /**
   * Cria um novo mapeamento de gerente.
   */
  export const createManagerMapping = async (colaboradorId: string, gerenteId: string, periodoId?: string) => {
    const { data, error } = await supabase.from('avaliacao_colaborador_gerente').insert([{
      colaborador_id: colaboradorId,
      gerente_id: gerenteId,
      periodo_id: periodoId,
    }]);
  
    if (error) throw error;
    return data;
  };

  /**
 * Deleta um mapeamento de gerente.
 */
export const deleteManagerMapping = async (id: string) => {
  const { error } = await supabase.from('avaliacao_colaborador_gerente').delete().eq('id', id);
  if (error) throw error;
};
export const getEligibleUsers = async (periodoId?: string) => {
    let query = supabase.from('avaliacao_usuarios_elegiveis').select(`
      id,
      usuario:usuario_id ( id, name, email ),
      periodo:periodo_id ( id, nome )
    `);
  
    if (periodoId) {
      query = query.eq('periodo_id', periodoId);
    }
  
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };
  
  /**
   * Adiciona um usuário à lista de elegíveis.
   */
  export const addEligibleUser = async (usuarioId: string, periodoId?: string) => {
    const { data, error } = await supabase.from('avaliacao_usuarios_elegiveis').insert([{
      usuario_id: usuarioId,
      periodo_id: periodoId,
    }]);
  
    if (error) throw error;
    return data;
  };

/**
 * Busca períodos disponíveis para o usuário (ativos ou próximos)
 * - Ativos: hoje entre data_inicio e data_fim
 * - Próximos: data_inicio nos próximos 14 dias
 */
export const getAvailablePeriods = async (userId: string): Promise<{
  active: EvaluationPeriod[];
  upcoming: EvaluationPeriod[];
}> => {
  const hoje = new Date().toISOString().split('T')[0];
  const daquiA14Dias = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Buscar períodos ativos (hoje entre data_inicio e data_fim)
  const { data: activePeriods, error: activeError } = await supabase
    .from('periodos_avaliacao')
    .select('*')
    .eq('ativo', true)
    .lte('data_inicio', hoje)
    .gte('data_fim', hoje)
    .order('data_inicio', { ascending: true });

  if (activeError) {
    console.error('Erro ao buscar períodos ativos:', activeError);
    throw activeError;
  }

  // Buscar períodos próximos (iniciam nos próximos 14 dias)
  const { data: upcomingPeriods, error: upcomingError } = await supabase
    .from('periodos_avaliacao')
    .select('*')
    .eq('ativo', true)
    .gt('data_inicio', hoje)
    .lte('data_inicio', daquiA14Dias)
    .order('data_inicio', { ascending: true });

  if (upcomingError) {
    console.error('Erro ao buscar períodos próximos:', upcomingError);
    throw upcomingError;
  }

  return {
    active: (activePeriods || []) as EvaluationPeriod[],
    upcoming: (upcomingPeriods || []) as EvaluationPeriod[]
  };
};

/**
 * Verifica se o usuário já possui avaliação para um período específico
 */
export const getMyEvaluationForPeriod = async (
  userId: string, 
  periodoId: string
): Promise<Evaluation | null> => {
  const { data, error } = await supabase
    .from('avaliacoes_desempenho')
    .select('*')
    .eq('funcionario_id', userId)
    .eq('periodo_id', periodoId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') { // Ignora erro "not found"
    console.error('Erro ao buscar avaliação do período:', error);
    throw error;
  }

  return data as Evaluation | null;
};

/**
 * Busca o gerente configurado para um usuário em um período
 */
export const getManagerForUser = async (
  userId: string,
  periodoId?: string
): Promise<User | null> => {
  let query = supabase
    .from('avaliacao_colaborador_gerente')
    .select('gerente:gerente_id(*)');

  if (periodoId) {
    query = query.eq('periodo_id', periodoId);
  }

  query = query.eq('colaborador_id', userId).maybeSingle();

  const { data, error } = await query;

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar gerente:', error);
    throw error;
  }

  return data?.gerente || null;
};
