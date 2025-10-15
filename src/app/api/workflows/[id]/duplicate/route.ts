import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';
import { WorkflowStatistics } from '@/types/workflows';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authResult = await verifyTokenFromRequest(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const resolvedParams = await params;
    const workflowId = resolvedParams.id;

    // Buscar workflow original
    const { data: originalWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (fetchError || !originalWorkflow) {
      return NextResponse.json({
        success: false,
        error: 'Workflow não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões de visualização
    const hasViewPermission = originalWorkflow.created_by === authResult.payload.userId ||
                             originalWorkflow.permissions?.viewers?.includes(authResult.payload.userId) ||
                             originalWorkflow.permissions?.editors?.includes(authResult.payload.userId) ||
                             originalWorkflow.permissions?.isPublic;

    if (!hasViewPermission) {
      // Verificar se usuário é admin
      const { data: user } = await supabase
        .from('users_unified')
        .select('role, email')
        .eq('id', authResult.payload.userId)
        .single();

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Sem permissão para duplicar este workflow'
        }, { status: 403 });
      }
    }

    // Verificar se usuário pode criar workflows
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar workflows'
      }, { status: 403 });
    }

    // Preparar dados para duplicação
    const newWorkflowName = `${originalWorkflow.name} (Cópia)`;
    
    // Estatísticas iniciais para o novo workflow
    const initialStatistics: WorkflowStatistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionHistory: []
    };

    // Permissões para o novo workflow (apenas o criador)
    const newPermissions = {
      owner: authResult.payload.userId,
      viewers: [],
      editors: [],
      executors: [],
      roles: {},
      departments: {},
      isPublic: false
    };

    // Criar workflow duplicado
    const { data: newWorkflow, error: createError } = await supabase
      .from('workflows')
      .insert({
        name: newWorkflowName,
        description: originalWorkflow.description ? `${originalWorkflow.description} (Cópia)` : 'Workflow duplicado',
        category: originalWorkflow.category,
        version: '1.0.0', // Resetar versão
        status: 'draft', // Novo workflow começa como draft
        trigger: originalWorkflow.trigger,
        steps: originalWorkflow.steps,
        variables: originalWorkflow.variables,
        settings: originalWorkflow.settings,
        permissions: newPermissions,
        statistics: initialStatistics,
        created_by: authResult.payload.userId,
        tags: originalWorkflow.tags,
        is_template: false, // Cópia não é template
        template_id: originalWorkflow.is_template ? originalWorkflow.id : originalWorkflow.template_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao duplicar workflow:', createError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao duplicar workflow'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: newWorkflow.id,
        action: 'duplicate',
        entity_type: 'workflow',
        entity_id: newWorkflow.id,
        new_values: { 
          originalWorkflowId: originalWorkflow.id,
          originalWorkflowName: originalWorkflow.name,
          newWorkflowName: newWorkflow.name
        },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    // Também registrar no workflow original
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: originalWorkflow.id,
        action: 'duplicated',
        entity_type: 'workflow',
        entity_id: originalWorkflow.id,
        new_values: { 
          duplicatedToId: newWorkflow.id,
          duplicatedToName: newWorkflow.name,
          duplicatedBy: authResult.payload.userId
        },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
      message: 'Workflow duplicado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao duplicar workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
