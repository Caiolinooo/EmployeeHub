import { supabaseAdmin } from '@/lib/supabase';
import type { GTColaborador } from '@/types/gestao-tripulantes';
import { persistirCamposEscala } from '@/lib/gestao-tripulantes/regime-escala';

export interface ColaboradorFilters {
  search?: string;
  empresa?: string;
  embarcacao?: string;
  cargo?: string;
  centro_custo?: string;
  status?: string;
  standby?: boolean;
  onlyVencidos?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listColaboradores(
  filters: ColaboradorFilters = {}
): Promise<{ success: boolean; data?: PaginatedResult<GTColaborador>; error?: string }> {
  try {
    const supabase = supabaseAdmin;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('gt_vw_colaboradores_completo')
      .select('*', { count: 'exact' });

    if (filters.search) {
      query = query.or(
        `nome_completo.ilike.%${filters.search}%,matricula.ilike.%${filters.search}%,cpf.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      );
    }

    if (filters.empresa) query = query.eq('empresa_id', filters.empresa);
    if (filters.embarcacao) query = query.eq('embarcacao_atual_id', filters.embarcacao);
    if (filters.cargo) query = query.eq('cargo_id', filters.cargo);
    if (filters.centro_custo) query = query.eq('centro_custo_id', filters.centro_custo);
    if (filters.status) query = query.eq('status_embarque', filters.status);
    if (filters.standby !== undefined) query = query.eq('standby', filters.standby);
    if (filters.onlyVencidos) {
      query = query.gt('qtd_docs_vencidos', 0);
    }

    query = query
      .is('deleted_at', null)
      .order('nome_completo', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao listar colaboradores:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        items: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  } catch (error) {
    console.error('Erro inesperado em listColaboradores:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function getColaborador(
  id: string
): Promise<{ success: boolean; data?: GTColaborador & { documentos?: any[]; embarques?: any[]; substituicoes?: any[] }; error?: string }> {
  try {
    const supabase = supabaseAdmin;

    const { data: colaborador, error } = await supabase
      .from('gt_vw_colaboradores_completo')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar colaborador:', error);
      return { success: false, error: error.message };
    }

    if (!colaborador) {
      return { success: false, error: 'Colaborador não encontrado' };
    }

    const [
      { data: documentos },
      { data: embarques },
      { data: substituicoes },
    ] = await Promise.all([
      supabase
        .from('gt_documentos')
        .select('*')
        .eq('colaborador_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('gt_historico_embarques')
        .select('*, embarcacao:gt_embarcacoes(nome)')
        .eq('colaborador_id', id)
        .is('deleted_at', null)
        .order('data_embarque', { ascending: false }),
      supabase
        .from('gt_historico_substituicoes')
        .select('*, substituto:gt_colaboradores!substituto_id(nome_completo), substituido:gt_colaboradores!substituido_id(nome_completo)')
        .or(`substituto_id.eq.${id},substituido_id.eq.${id}`)
        .order('created_at', { ascending: false }),
    ]);

    return {
      success: true,
      data: {
        ...colaborador,
        documentos: documentos || [],
        embarques: embarques || [],
        substituicoes: substituicoes || [],
      },
    };
  } catch (error) {
    console.error('Erro inesperado em getColaborador:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function createColaborador(
  data: any
): Promise<{ success: boolean; data?: GTColaborador; error?: string }> {
  try {
    const supabase = supabaseAdmin;

    if (!data.nome_completo || !data.cpf) {
      return { success: false, error: 'Nome completo e CPF são obrigatórios' };
    }

    const payload: Record<string, any> = {
      nome_completo: data.nome_completo,
      cpf: data.cpf,
      origem: data.origem || 'manual',
      status_embarque: data.status_embarque || 'desembarcado',
      standby: data.standby ?? false,
    };

    // Safe copy of all known fields
    const knownFields = [
      'rg','orgao_emissor','data_emissao_rg','data_nascimento',
      'sexo','genero','estado_civil','peso','altura',
      'raca_cor','escolaridade','deficiencia','deficiencia_cid',
      'nacionalidade','naturalidade','naturalidade_uf','pais_nascimento',
      'nome_mae','nome_pai',
      'email','telefone',
      'endereco_logradouro','endereco_numero','endereco_complemento',
      'endereco_bairro','endereco_cidade','endereco_uf','endereco_cep',
      'dados_bancarios',
      'pis_pasep','ctps','ctps_serie','ctps_uf',
      'cnh','cnh_categoria','cnh_validade','cnh_uf',
      'titulo_eleitor','titulo_eleitor_zona','titulo_eleitor_sessao',
      'certidao_tipo','certidao_numero','certidao_cartorio',
      'matricula','cargo_id','centro_custo_id','empresa_id',
      'embarcacao_atual_id',
      'data_admissao','data_demissao','motivo_demissao',
      'salario','tipo_salario','forma_pagamento','sindicato',
      'cbo','jornada_semanal','jornada_mensal',
      'tipo_contrato','prazo_contrato','categoria_contrato',
      'tipo_trabalho','tipo_mao_de_obra','regime_trabalho',
      'escala_embarque','escala_folga',
      'dados_saude','mio_id','user_id',
    ];

    for (const field of knownFields) {
      if (data[field] !== undefined && data[field] !== null) {
        payload[field] = data[field];
      }
    }

    if (payload.regime_trabalho != null || payload.escala_embarque != null || payload.escala_folga != null) {
      const persistido = persistirCamposEscala({
        regime_trabalho: payload.regime_trabalho,
        escala_embarque: payload.escala_embarque,
        escala_folga: payload.escala_folga,
      });
      payload.regime_trabalho = persistido.regime_trabalho;
      payload.escala_embarque = persistido.escala_embarque;
      payload.escala_folga = persistido.escala_folga;
    }

    const { data: novo, error } = await supabase
      .from('gt_colaboradores')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar colaborador:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: novo };
  } catch (error) {
    console.error('Erro inesperado em createColaborador:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function updateColaborador(
  id: string,
  data: Partial<GTColaborador>
): Promise<{ success: boolean; data?: GTColaborador; error?: string }> {
  try {
    const supabase = supabaseAdmin;

    const updateData = { ...data, updated_at: new Date().toISOString() };
    delete (updateData as any).id;
    delete (updateData as any).created_at;
    delete (updateData as any).deleted_at;

    if ('regime_trabalho' in updateData) {
      const escalaPatch = updateData as {
        regime_trabalho?: string | null;
        escala_embarque?: string | number | null;
        escala_folga?: string | number | null;
      };
      const persistido = persistirCamposEscala({
        regime_trabalho: escalaPatch.regime_trabalho,
        escala_embarque: escalaPatch.escala_embarque,
        escala_folga: escalaPatch.escala_folga,
      });
      (updateData as Record<string, unknown>).regime_trabalho = persistido.regime_trabalho;
      (updateData as Record<string, unknown>).escala_embarque = persistido.escala_embarque;
      (updateData as Record<string, unknown>).escala_folga = persistido.escala_folga;
    }

    const { data: updated, error } = await supabase
      .from('gt_colaboradores')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar colaborador:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Erro inesperado em updateColaborador:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function deleteColaborador(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = supabaseAdmin;

    const { error } = await supabase
      .from('gt_colaboradores')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir colaborador:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro inesperado em deleteColaborador:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
