import { supabase } from '@/lib/supabase';

/**
 * Interface para dados de liderança
 */
export interface DadosLideranca {
  id: string;
  user_id: string;
  cargo_lideranca: string;
  departamento?: string;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
}

/**
 * Verifica se um usuário é líder ativo
 * Usa a função do banco de dados que verifica:
 * 1. Tabela gerentes_avaliacao_config (configuração específica de avaliação)
 * 2. Role do usuário (MANAGER ou ADMIN)
 * @param userId ID do usuário
 * @returns Promise<boolean> - true se o usuário é líder ativo
 */
export async function isUsuarioLider(userId: string): Promise<boolean> {
  try {
    // Chama a função do banco de dados is_usuario_lider()
    const { data, error } = await supabase
      .rpc('is_usuario_lider', { p_usuario_id: userId });

    if (error) {
      console.error('Erro ao verificar liderança via RPC:', error);

      // Fallback: verifica role diretamente se a função RPC falhar
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Erro ao verificar role do usuário:', userError);
        return false;
      }

      return userData?.role === 'MANAGER' || userData?.role === 'ADMIN';
    }

    return data === true;
  } catch (error) {
    console.error('Erro ao verificar se usuário é líder:', error);
    return false;
  }
}

/**
 * Obtém dados de liderança de um usuário
 * @param userId ID do usuário
 * @returns Promise<DadosLideranca | null>
 */
export async function getDadosLideranca(userId: string): Promise<DadosLideranca | null> {
  try {
    const { data, error } = await supabase
      .from('lideres')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .is('data_fim', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao obter dados de liderança:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erro ao obter dados de liderança:', error);
    return null;
  }
}

/**
 * Lista todos os líderes ativos
 * @returns Promise<DadosLideranca[]>
 */
export async function listarLideresAtivos(): Promise<DadosLideranca[]> {
  try {
    const { data, error } = await supabase
      .from('lideres')
      .select(`
        *,
        users_unified!inner(
          id,
          name,
          email,
          role
        )
      `)
      .eq('ativo', true)
      .is('data_fim', null)
      .order('cargo_lideranca', { ascending: true });

    if (error) {
      console.error('Erro ao listar líderes ativos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao listar líderes ativos:', error);
    return [];
  }
}

/**
 * Adiciona um usuário como líder
 * @param userId ID do usuário
 * @param cargoLideranca Cargo de liderança
 * @param departamento Departamento (opcional)
 * @returns Promise<boolean> - true se adicionado com sucesso
 */
export async function adicionarLider(
  userId: string, 
  cargoLideranca: string, 
  departamento?: string
): Promise<boolean> {
  try {
    // Primeiro, desativar qualquer registro de liderança anterior
    await supabase
      .from('lideres')
      .update({ 
        ativo: false, 
        data_fim: new Date().toISOString().split('T')[0] 
      })
      .eq('user_id', userId)
      .eq('ativo', true);

    // Inserir novo registro de liderança
    const { error } = await supabase
      .from('lideres')
      .insert({
        user_id: userId,
        cargo_lideranca: cargoLideranca,
        departamento,
        ativo: true
      });

    if (error) {
      console.error('Erro ao adicionar líder:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao adicionar líder:', error);
    return false;
  }
}

/**
 * Remove um usuário da função de liderança
 * @param userId ID do usuário
 * @returns Promise<boolean> - true se removido com sucesso
 */
export async function removerLider(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('lideres')
      .update({ 
        ativo: false, 
        data_fim: new Date().toISOString().split('T')[0] 
      })
      .eq('user_id', userId)
      .eq('ativo', true);

    if (error) {
      console.error('Erro ao remover líder:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao remover líder:', error);
    return false;
  }
}
