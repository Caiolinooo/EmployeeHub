/**
 * Ferramentas do Módulo Férias
 * Portal ABZ - IA Tools (registry)
 */
import { supabaseAdmin } from '@/lib/supabase';
import { applyGlobalAccessFilter } from '../../permissions';
import { registerTool } from '../tools-registry';
import type { IATool, IAToolResult } from '@/types/ia-global';
import { normalizeLeaveStatus } from '@/lib/leaveExport';

const buscarFeriasTool: IATool = {
  id: 'ferias_buscar',
  name: 'buscar_ferias',
  description:
    'Busca férias do funcionário (histórico incluso por padrão). Parâmetros: funcionario_id, status, ano, incluir_historico, limite.',
  module: 'ferias',
  definition: {
    name: 'buscar_ferias',
    description: 'Retorna solicitações de férias (passado e atual)',
    parameters: {
      type: 'object',
      properties: {
        funcionario_id: { type: 'string', description: 'UUID do funcionário', required: true },
        status: { type: 'string', description: 'PENDING_LEADER|PENDING_MANAGER|APPROVED|REJECTED|CANCELLED', required: false },
        ano: { type: 'number', description: 'Ano do gozo (start_date)', required: false },
        incluir_historico: { type: 'boolean', description: 'true = inclui passado (padrão)', required: false },
        limite: { type: 'number', description: 'Máx registros (padrão 50)', required: false },
      },
      required: ['funcionario_id'],
    },
  },
  requireModule: 'ferias',
  adminOnly: false,
  handler: async (args): Promise<IAToolResult> => {
    const {
      funcionario_id,
      status: statusRaw,
      ano,
      incluir_historico = true,
      limite = 50,
    } = args;

    try {
      const statusNorm = normalizeLeaveStatus(statusRaw as string) || (statusRaw as string | undefined);
      let query = supabaseAdmin
        .from('leave_requests')
        .select('id, start_date, end_date, status, justification, created_at, updated_at, user_id')
        .eq('user_id', funcionario_id as string)
        .order('start_date', { ascending: false })
        .limit(Math.min(Number(limite) || 50, 100));

      if (statusNorm) query = query.eq('status', statusNorm);
      if (ano && Number(ano) >= 2000 && Number(ano) <= 2100) {
        query = query.gte('start_date', `${ano}-01-01`).lte('start_date', `${ano}-12-31`);
      }
      if (incluir_historico === false) {
        query = query.gte('end_date', new Date().toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) return { success: false, error: `Erro ao buscar férias: ${error.message}` };
      if (!data?.length) {
        return { success: true, data: { message: 'Nenhuma solicitação encontrada', ferias: [], total: 0 } };
      }

      return {
        success: true,
        data: {
          total: data.length,
          ferias: data.map((f) => ({
            id: f.id,
            inicio: f.start_date,
            fim: f.end_date,
            status: f.status,
            observacoes: f.justification,
            data_solicitacao: f.created_at,
            atualizado_em: f.updated_at,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  },
};

const buscarPendenciasFeriasTool: IATool = {
  id: 'ferias_pendencias',
  name: 'buscar_pendencias_ferias',
  description: 'Retorna solicitações de férias pendentes de aprovação',
  module: 'ferias',
  definition: {
    name: 'buscar_pendencias_ferias',
    description: 'Solicitações aguardando aprovação',
    parameters: {
      type: 'object',
      properties: {
        days_limit: { type: 'number', description: 'Limite de dias', required: false },
      },
      required: [],
    },
  },
  requireModule: 'ferias',
  adminOnly: false,
  handler: async (args, context): Promise<IAToolResult> => {
    const { days_limit = 30 } = args as { days_limit?: number };
    try {
      let baseQuery = supabaseAdmin
        .from('leave_requests')
        .select('*, user:users_unified(name, email, department)')
        .in('status', ['PENDING_LEADER', 'PENDING_MANAGER'])
        .gte('created_at', new Date(Date.now() - days_limit * 24 * 60 * 60 * 1000).toISOString());

      const accessFilter = await applyGlobalAccessFilter(baseQuery, context.userId, context.userRole, 'user_id');
      if (!accessFilter.hasAccess) {
        return { success: false, error: accessFilter.error || 'Acesso negado' };
      }

      const { data, error } = await accessFilter.query.order('created_at', { ascending: true });
      if (error) return { success: false, error: `Erro: ${error.message}` };

      return {
        success: true,
        data: {
          total_pendencias: data?.length || 0,
          pendencias: data?.map((p: any) => ({
            id: p.id,
            funcionario: p.user?.name || 'Desconhecido',
            inicio: p.start_date,
            fim: p.end_date,
            status: p.status,
            data_solicitacao: p.created_at,
          })) || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  },
};

export function registerTools(): void {
  registerTool(buscarFeriasTool);
  registerTool(buscarPendenciasFeriasTool);
  console.log('[IA Tools] Ferias module loaded');
}
