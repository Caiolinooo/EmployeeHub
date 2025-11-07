import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyRequestToken } from '@/lib/auth';
import { Workflow, WorkflowStatistics } from '@/types/workflows';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para visualizar workflows'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const isTemplate = url.searchParams.get('template') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('workflows')
      .select(`
        id,
        name,
        description,
        category,
        version,
        status,
        trigger,
        steps,
        variables,
        settings,
        permissions,
        statistics,
        created_by,
        created_at,
        updated_at,
        last_executed,
        tags,
        is_template,
        template_id
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por categoria se especificado
    if (category) {
      query = query.eq('category', category);
    }

    // Filtrar por status se especificado
    if (status) {
      query = query.eq('status', status);
    }

    // Filtrar por templates se especificado
    if (isTemplate) {
      query = query.eq('is_template', true);
    } else {
      // Mostrar workflows do usuário ou públicos
      query = query.or(`created_by.eq.${authResult.payload.userId},permissions->isPublic.eq.true`);
    }

    const { data: workflows, error } = await query;

    if (error) {
      console.error('Erro ao buscar workflows:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar workflows'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workflows: workflows || []
    });

  } catch (error) {
    console.error('Erro na API de workflows:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar workflows'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      version = '1.0.0',
      status = 'draft',
      trigger,
      steps = [],
      variables = [],
      settings,
      permissions,
      tags = [],
      isTemplate = false,
      templateId
    } = body;

    // Validar campos obrigatórios
    if (!name || !trigger) {
      return NextResponse.json({
        success: false,
        error: 'Nome e trigger são obrigatórios'
      }, { status: 400 });
    }

    // Estatísticas iniciais
    const initialStatistics: WorkflowStatistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionHistory: []
    };

    // Criar workflow
    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert({
        name,
        description,
        category,
        version,
        status,
        trigger,
        steps,
        variables,
        settings,
        permissions,
        statistics: initialStatistics,
        created_by: authResult.payload.userId,
        tags,
        is_template: isTemplate,
        template_id: templateId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar workflow:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar workflow'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: workflow.id,
        action: 'create',
        entity_type: 'workflow',
        entity_id: workflow.id,
        new_values: { name, category, status },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      workflow
    });

  } catch (error) {
    console.error('Erro ao criar workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do workflow é obrigatório'
      }, { status: 400 });
    }

    // Buscar workflow existente
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingWorkflow) {
      return NextResponse.json({
        success: false,
        error: 'Workflow não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner ou admin)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.payload.userId)
      .single();

    if (existingWorkflow.created_by !== authResult.payload.userId && user?.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para editar este workflow'
      }, { status: 403 });
    }

    // Atualizar workflow
    const { data: updatedWorkflow, error: updateError } = await supabase
      .from('workflows')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar workflow:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar workflow'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: id,
        action: 'update',
        entity_type: 'workflow',
        entity_id: id,
        old_values: existingWorkflow,
        new_values: updateData,
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      workflow: updatedWorkflow
    });

  } catch (error) {
    console.error('Erro ao atualizar workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do workflow é obrigatório'
      }, { status: 400 });
    }

    // Buscar workflow existente
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingWorkflow) {
      return NextResponse.json({
        success: false,
        error: 'Workflow não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner ou admin)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.payload.userId)
      .single();

    if (existingWorkflow.created_by !== authResult.payload.userId && user?.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para excluir este workflow'
      }, { status: 403 });
    }

    // Soft delete - marcar como inativo
    const { error: deleteError } = await supabase
      .from('workflows')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar workflow:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar workflow'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: id,
        action: 'delete',
        entity_type: 'workflow',
        entity_id: id,
        old_values: existingWorkflow,
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: 'Workflow removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
