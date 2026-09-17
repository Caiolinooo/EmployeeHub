/**
 * Ferramentas do Módulo Suprimentos
 * Portal ABZ - IA Tools
 */
import { supabaseAdmin } from '@/lib/supabase';
import type { IAUserRole } from '@/types/ia';
import { getEffectiveRole, getAccessibleUserIds, applyGlobalAccessFilter } from '../../permissions';
import { registerTool } from '../tools-registry';
import type { IATool } from '@/types/ia-global';

/**
 * Busca solicitações de compra
 */
const buscarSolicitacoesCompraTool: IATool = {
  id: 'suprimentos_solicitacoes',
  name: 'buscar_solicitacoes_compra',
  description: 'Busca solicitações de compra do usuário ou gerais se for administrador',
  module: 'suprimentos',
  definition: {
    name: 'buscar_solicitacoes_compra',
    description: 'Retorna solicitações de compra',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar por status', required: false },
        limite: { type: 'number', description: 'Limite de resultados', required: false },
      },
      required: [],
    },
  },
  requireModule: 'suprimentos',
  adminOnly: false,
  handler: async (args, context) => {
    const { status, limite = 10 } = args as { status?: string; limite?: number };
    const userId = context.userId;
    const isAdmin = context.userRole === 'ADMIN';

    try {
      let query = supabaseAdmin
        .from('purchase_requests')
        .select('*, user:users_unified(first_name, last_name, department)')
        .order('created_at', { ascending: false })
        .limit(limite);

      if (!isAdmin) {
        query = query.eq('created_by', userId);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          total: data?.length || 0,
          solicitacoes: data?.map(s => ({
            id: s.id,
            numero: s.rqf_number,
            status: s.status,
            valor: s.total_amount,
            solicitante: s.user ? `${s.user.first_name} ${s.user.last_name}` : 'N/A',
            departamento: s.user?.department || 'N/A',
            data: s.created_at,
          })) || [],
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Busca pendências de aprovação (para gerentes/admin)
 */
const buscarPendenciasAprovacaoTool: IATool = {
  id: 'suprimentos_pendencias',
  name: 'buscar_pendencias_aprovacao',
  description: 'Retorna solicitações aguardando aprovação do usuário',
  module: 'suprimentos',
  definition: {
    name: 'buscar_pendencias_aprovacao',
    description: 'Retorna solicitações pendentes de aprovação',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  requireModule: 'suprimentos',
  adminOnly: false,
  handler: async (args, context) => {
    try {
      const baseQuery = supabaseAdmin
        .from('purchase_requests')
        .select('*, user:users_unified(first_name, last_name, department)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);

      const accessFilter = await applyGlobalAccessFilter(baseQuery, context.userId, context.userRole, 'user_id');
      if (!accessFilter.hasAccess) return { success: false, error: accessFilter.error || 'Acesso negado' };

      const { data, error } = await accessFilter.query;

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          total_pendencias: data?.length || 0,
           pendencias: data?.map((s: any) => ({
            id: s.id,
            numero: s.rqf_number,
            solicitante: s.user ? `${s.user.first_name} ${s.user.last_name}` : 'N/A',
            departamento: s.user?.department || 'N/A',
            valor: s.total_amount,
            descricao: s.description,
            data_solicitacao: s.created_at,
          })) || [],
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Busca detalhes de uma solicitação
 */
const buscarDetalheSolicitacaoTool: IATool = {
  id: 'suprimentos_detalhes',
  name: 'buscar_detalhes_solicitacao',
  description: 'Retorna detalhes de uma solicitação de compra específica',
  module: 'suprimentos',
  definition: {
    name: 'buscar_detalhes_solicitacao',
    description: 'Retorna detalhes de uma solicitação',
    parameters: {
      type: 'object',
      properties: {
        solicitacao_id: { type: 'string', description: 'ID da solicitação', required: true },
      },
      required: ['solicitacao_id'],
    },
  },
  requireModule: 'suprimentos',
  adminOnly: false,
  handler: async (args) => {
    const { solicitacao_id } = args as { solicitacao_id: string };

    try {
      const { data, error } = await supabaseAdmin
        .from('purchase_requests')
        .select('*')
        .eq('id', solicitacao_id)
        .single();

      if (error || !data) return { success: false, error: 'Solicitação não encontrada' };

      return {
        success: true,
        data: {
          id: data.id,
          numero: data.rqf_number,
          status: data.status,
          valor: data.total_amount,
          descricao: data.description,
          data_criacao: data.created_at,
          data_aprovacao: data.approved_at,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

/**
 * Busca fornecedores
 */
const buscarFornecedoresTool: IATool = {
  id: 'suprimentos_fornecedores',
  name: 'buscar_fornecedores',
  description: 'Pesquisa fornecedores cadastrados no sistema',
  module: 'suprimentos',
  definition: {
    name: 'buscar_fornecedores',
    description: 'Busca fornecedores por nome ou categoria',
    parameters: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca', required: true },
      },
      required: ['termo'],
    },
  },
  requireModule: 'suprimentos',
  adminOnly: false,
  handler: async (args) => {
    const { termo } = args as { termo: string };

    try {
      const { data, error } = await supabaseAdmin
        .from('suppliers')
        .select('id, trade_name, legal_name, category, document_number')
        .or(`trade_name.ilike.%${termo}%,legal_name.ilike.%${termo}%`)
        .limit(10);

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          total: data?.length || 0,
          fornecedores: data || [],
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export function registerTools() {
  registerTool(buscarSolicitacoesCompraTool);
  registerTool(buscarPendenciasAprovacaoTool);
  registerTool(buscarDetalheSolicitacaoTool);
  registerTool(buscarFornecedoresTool);
  console.log('[IA Tools] Suprimentos module loaded');
}