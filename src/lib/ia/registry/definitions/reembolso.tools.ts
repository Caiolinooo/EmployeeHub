/**
 * Ferramentas do Módulo Reembolso
 * Portal ABZ - IA Tools
 */
import { supabaseAdmin } from '@/lib/supabase';
import type { IAUserRole } from '@/types/ia';
import { getEffectiveRole, getAccessibleUserIds, applyGlobalAccessFilter } from '../../permissions';
import { registerTool } from '../tools-registry';
import type { IATool } from '@/types/ia-global';

function normalizeReimbursementStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'pending' || lower === 'pendente') return 'pendente';
  if (lower === 'approved' || lower === 'aprovado') return 'aprovado';
  if (lower === 'rejected' || lower === 'rejeitado') return 'rejeitado';
  return status;
}

/**
 * Busca reembolsos de um funcionário
 */
const buscarReembolsosTool: IATool = {
  id: 'reembolso_buscar',
  name: 'buscar_reembolsos',
  description: 'Busca o histórico de solicitacoes de reembolso de um funcionario',
  module: 'reembolso',
  definition: {
    name: 'buscar_reembolsos',
    description: 'Retorna historico de solicitacoes de reembolso',
    parameters: {
      type: 'object',
      properties: {
        funcionario_id: { type: 'string', description: 'ID do funcionario', required: true },
        status: { type: 'string', description: 'Filtrar por status (pendente, aprovado, rejeitado)', required: false },
      },
      required: ['funcionario_id'],
    },
  },
  requireModule: 'reembolsos',
  adminOnly: false,
  handler: async (args) => {
    const { funcionario_id, status } = args as { funcionario_id: string; status?: string };
    
    try {
      const { data: userData } = await supabaseAdmin
        .from('users_unified')
        .select('email')
        .eq('id', funcionario_id)
        .single();
      
      const userEmail = userData?.email;
      if (!userEmail) {
        return { success: false, error: 'Usuario nao encontrado' };
      }
      
      let query = supabaseAdmin
        .from('Reimbursement')
        .select('id, status, valorTotal, descricao, data, email')
        .eq('email', userEmail);

      if (status) {
        query = query.eq('status', normalizeReimbursementStatus(status));
      }

      const { data, error } = await query.order('data', { ascending: false }).limit(20);

      if (error) return { success: false, error: error.message };
      
      const total = data?.length || 0;
      const pendentes = data?.filter(r => r.status === 'pendente').length || 0;
      const aprovados = data?.filter(r => r.status === 'aprovado').length || 0;
      const rejeitados = data?.filter(r => r.status === 'rejeitado').length || 0;

      return {
        success: true,
        data: {
          total,
          pendentes,
          aprovados,
          rejeitados,
          reembolsos: data?.map(r => ({
            id: r.id,
            status: r.status,
            valor: r.valorTotal,
            descricao: r.descricao,
            data: r.data,
          })) || [],
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Busca pendencias de reembolso para aprovacao
 */
const buscarPendenciasReembolsoTool: IATool = {
  id: 'reembolso_pendencias',
  name: 'buscar_pendencias_reembolso',
  description: 'Retorna solicitacoes de reembolso pendentes de aprovacao',
  module: 'reembolso',
  definition: {
    name: 'buscar_pendencias_reembolso',
    description: 'Retorna reembolsos aguardando aprovacao',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  requireModule: 'reembolsos',
  adminOnly: false,
  handler: async (args, context) => {
    try {
      const baseQuery = supabaseAdmin
        .from('Reimbursement')
        .select('id, status, valorTotal, descricao, data, email, nome')
        .eq('status', 'pendente')
        .order('data', { ascending: true })
        .limit(20);

      const accessFilter = await applyGlobalAccessFilter(baseQuery, context.userId, context.userRole, 'user_id');
      if (!accessFilter.hasAccess) return { success: false, error: accessFilter.error || 'Acesso negado' };

      const { data, error } = await accessFilter.query;

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          total_pendencias: data?.length || 0,
           pendencias: data?.map((r: any) => ({
            id: r.id,
            nome: r.nome,
            email: r.email,
            valor: r.valorTotal,
            descricao: r.descricao,
            data_solicitacao: r.data,
          })) || [],
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Busca detalhes de um reembolso especifico
 */
const buscarDetalheReembolsoTool: IATool = {
  id: 'reembolso_detalhes',
  name: 'buscar_detalhes_reembolso',
  description: 'Retorna detalhes completos de uma solicitacao de reembolso',
  module: 'reembolso',
  definition: {
    name: 'buscar_detalhes_reembolso',
    description: 'Retorna detalhes de um reembolso especifico',
    parameters: {
      type: 'object',
      properties: {
        reembolso_id: { type: 'string', description: 'ID do reembolso', required: true },
      },
      required: ['reembolso_id'],
    },
  },
  requireModule: 'reembolsos',
  adminOnly: false,
  handler: async (args) => {
    const { reembolso_id } = args as { reembolso_id: string };
    
    try {
      const { data, error } = await supabaseAdmin
        .from('Reimbursement')
        .select('*')
        .eq('id', reembolso_id)
        .single();

      if (error || !data) return { success: false, error: 'Reembolso nao encontrado' };

      return {
        success: true,
        data: {
          id: data.id,
          status: data.status,
          valor: data.valorTotal,
          descricao: data.descricao,
          data_criacao: data.data,
          email: data.email,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export function registerTools() {
  registerTool(buscarReembolsosTool);
  registerTool(buscarPendenciasReembolsoTool);
  registerTool(buscarDetalheReembolsoTool);
  console.log('[IA Tools] Reembolso module loaded');
}