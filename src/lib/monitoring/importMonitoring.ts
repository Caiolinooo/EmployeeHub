/**
 * Sistema de monitoramento para importações de usuários
 */

import { supabaseAdmin } from '@/lib/supabase';

// Interface para log de importação
export interface ImportLog {
  id?: string;
  user_id: string;
  timestamp: string;
  import_type: string;
  file_name: string;
  total_records: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
  duration_ms: number;
  status: 'success' | 'partial' | 'failed';
  error_details?: string;
}

// Interface para estatísticas de importação
export interface ImportStats {
  total_imports: number;
  total_users_imported: number;
  success_rate: number;
  average_duration_ms: number;
  imports_by_type: Record<string, number>;
  recent_imports: ImportLog[];
}

/**
 * Registra um log de importação
 * @param log Dados do log de importação
 * @returns ID do log criado
 */
export async function logImport(log: Omit<ImportLog, 'id'>): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('import_logs')
      .insert(log)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao registrar log de importação:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Erro ao registrar log de importação:', error);
    return null;
  }
}

/**
 * Obtém estatísticas de importação
 * @param limit Limite de logs recentes para retornar
 * @returns Estatísticas de importação
 */
export async function getImportStats(limit: number = 10): Promise<ImportStats | null> {
  try {
    // Obter logs recentes
    const { data: recentLogs, error: recentLogsError } = await supabaseAdmin
      .from('import_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (recentLogsError) {
      console.error('Erro ao obter logs recentes:', recentLogsError);
      return null;
    }

    // Obter estatísticas gerais
    const { data: statsData, error: statsError } = await supabaseAdmin
      .rpc('get_import_statistics');

    if (statsError) {
      console.error('Erro ao obter estatísticas de importação:', statsError);
      return null;
    }

    // Obter contagem por tipo de importação
    const { data: typeData, error: typeError } = await supabaseAdmin
      .from('import_logs')
      .select('import_type');

    if (typeError) {
      console.error('Erro ao obter contagem por tipo:', typeError);
      return null;
    }

    // Mapear contagem por tipo
    const importsByType: Record<string, number> = {};
    typeData.forEach((item: any) => {
      importsByType[item.import_type] = item.count;
    });

    // Construir estatísticas
    const stats: ImportStats = {
      total_imports: statsData.total_imports || 0,
      total_users_imported: statsData.total_users_imported || 0,
      success_rate: statsData.success_rate || 0,
      average_duration_ms: statsData.average_duration_ms || 0,
      imports_by_type: importsByType,
      recent_imports: recentLogs as ImportLog[],
    };

    return stats;
  } catch (error) {
    console.error('Erro ao obter estatísticas de importação:', error);
    return null;
  }
}

/**
 * Registra um erro de importação
 * @param logId ID do log de importação
 * @param error Detalhes do erro
 * @returns Sucesso da operação
 */
export async function logImportError(logId: string, error: any): Promise<boolean> {
  try {
    const errorDetails = typeof error === 'string' 
      ? error 
      : (error.message || JSON.stringify(error));

    const { error: updateError } = await supabaseAdmin
      .from('import_logs')
      .update({
        status: 'failed',
        error_details: errorDetails,
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Erro ao registrar erro de importação:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao registrar erro de importação:', error);
    return false;
  }
}

/**
 * Atualiza o status de um log de importação
 * @param logId ID do log de importação
 * @param status Novo status
 * @param counts Contagens atualizadas
 * @returns Sucesso da operação
 */
export async function updateImportStatus(
  logId: string, 
  status: 'success' | 'partial' | 'failed',
  counts?: { success: number; error: number; skipped: number }
): Promise<boolean> {
  try {
    const updateData: any = { status };
    
    if (counts) {
      updateData.success_count = counts.success;
      updateData.error_count = counts.error;
      updateData.skipped_count = counts.skipped;
    }

    const { error } = await supabaseAdmin
      .from('import_logs')
      .update(updateData)
      .eq('id', logId);

    if (error) {
      console.error('Erro ao atualizar status de importação:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao atualizar status de importação:', error);
    return false;
  }
}
