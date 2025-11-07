import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyRequestToken, extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      .select('role, access_permissions')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para visualizar execuções'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const workflowId = url.searchParams.get('workflowId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let query = supabase
      .from('workflow_executions')
      .select(`
        id,
        workflow_id,
        workflow_version,
        status,
        start_time,
        end_time,
        duration,
        triggered_by,
        trigger_data,
        variables,
        steps,
        logs,
        metrics,
        parent_execution_id,
        child_executions
      `)
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por workflow específico se especificado
    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    } else {
      // Buscar workflows que o usuário tem acesso
      const { data: userWorkflows } = await supabase
        .from('workflows')
        .select('id')
        .or(`created_by.eq.${authResult.payload.userId},permissions->isPublic.eq.true`);

      if (userWorkflows && userWorkflows.length > 0) {
        const workflowIds = userWorkflows.map(w => w.id);
        query = query.in('workflow_id', workflowIds);
      } else {
        // Usuário não tem acesso a nenhum workflow
        return NextResponse.json({
          success: true,
          executions: []
        });
      }
    }

    // Filtrar por status se especificado
    if (status) {
      query = query.eq('status', status);
    }

    // Filtrar por período se especificado
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data: executions, error } = await query;

    if (error) {
      console.error('Erro ao buscar execuções:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar execuções'
      }, { status: 500 });
    }

    // Buscar informações dos workflows para enriquecer os dados
    const workflowIds = [...new Set(executions?.map(e => e.workflow_id) || [])];
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name, category')
      .in('id', workflowIds);

    const workflowMap = workflows?.reduce((acc: any, w: any) => {
      acc[w.id] = w;
      return acc;
    }, {}) || {};

    // Enriquecer execuções com dados do workflow
    const enrichedExecutions = executions?.map(execution => ({
      ...execution,
      workflowName: workflowMap[execution.workflow_id]?.name || 'Workflow',
      workflowCategory: workflowMap[execution.workflow_id]?.category || 'unknown'
    })) || [];

    return NextResponse.json({
      success: true,
      executions: enrichedExecutions
    });

  } catch (error) {
    console.error('Erro na API de execuções:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, executionIds } = body;

    if (!action || !executionIds || !Array.isArray(executionIds)) {
      return NextResponse.json({
        success: false,
        error: 'Ação e IDs de execução são obrigatórios'
      }, { status: 400 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para gerenciar execuções'
      }, { status: 403 });
    }

    let results = [];

    switch (action) {
      case 'cancel':
        results = await cancelExecutions(executionIds, authResult.userId);
        break;
      case 'retry':
        results = await retryExecutions(executionIds, authResult.userId);
        break;
      case 'delete':
        results = await deleteExecutions(executionIds, authResult.userId);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `${successCount} execuções processadas com sucesso${failureCount > 0 ? `, ${failureCount} falharam` : ''}`,
      results
    });

  } catch (error) {
    console.error('Erro ao processar execuções:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function cancelExecutions(executionIds: string[], userId: string) {
  const results = [];

  for (const executionId of executionIds) {
    try {
      // Buscar execução
      const { data: execution, error: fetchError } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (fetchError || !execution) {
        results.push({
          executionId,
          success: false,
          error: 'Execução não encontrada'
        });
        continue;
      }

      // Verificar se pode ser cancelada
      if (!['queued', 'running', 'paused'].includes(execution.status)) {
        results.push({
          executionId,
          success: false,
          error: 'Execução não pode ser cancelada'
        });
        continue;
      }

      // Cancelar execução
      const { error: updateError } = await supabase
        .from('workflow_executions')
        .update({
          status: 'cancelled',
          end_time: new Date().toISOString(),
          duration: new Date().getTime() - new Date(execution.start_time).getTime()
        })
        .eq('id', executionId);

      if (updateError) {
        results.push({
          executionId,
          success: false,
          error: 'Erro ao cancelar execução'
        });
        continue;
      }

      // Log da ação
      await supabase
        .from('workflow_audit_logs')
        .insert({
          workflow_id: execution.workflow_id,
          action: 'cancel_execution',
          entity_type: 'execution',
          entity_id: executionId,
          user_id: userId,
          timestamp: new Date().toISOString(),
          success: true
        });

      results.push({
        executionId,
        success: true,
        message: 'Execução cancelada com sucesso'
      });

    } catch (error) {
      results.push({
        executionId,
        success: false,
        error: 'Erro interno'
      });
    }
  }

  return results;
}

async function retryExecutions(executionIds: string[], userId: string) {
  const results = [];

  for (const executionId of executionIds) {
    try {
      // Buscar execução
      const { data: execution, error: fetchError } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (fetchError || !execution) {
        results.push({
          executionId,
          success: false,
          error: 'Execução não encontrada'
        });
        continue;
      }

      // Verificar se pode ser reexecutada
      if (!['failed', 'timeout', 'cancelled'].includes(execution.status)) {
        results.push({
          executionId,
          success: false,
          error: 'Execução não pode ser reexecutada'
        });
        continue;
      }

      // Buscar workflow
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', execution.workflow_id)
        .single();

      if (workflowError || !workflow) {
        results.push({
          executionId,
          success: false,
          error: 'Workflow não encontrado'
        });
        continue;
      }

      // Criar nova execução baseada na anterior
      const newExecutionId = `exec_retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { error: createError } = await supabase
        .from('workflow_executions')
        .insert({
          id: newExecutionId,
          workflow_id: execution.workflow_id,
          workflow_version: execution.workflow_version,
          status: 'queued',
          start_time: new Date().toISOString(),
          triggered_by: userId,
          trigger_data: execution.trigger_data,
          variables: execution.variables,
          steps: [],
          logs: [],
          metrics: {
            cpuUsage: 0,
            memoryUsage: 0,
            networkRequests: 0,
            databaseQueries: 0,
            fileOperations: 0,
            apiCalls: 0,
            emailsSent: 0,
            notificationsSent: 0
          },
          parent_execution_id: executionId
        });

      if (createError) {
        results.push({
          executionId,
          success: false,
          error: 'Erro ao criar nova execução'
        });
        continue;
      }

      // Log da ação
      await supabase
        .from('workflow_audit_logs')
        .insert({
          workflow_id: execution.workflow_id,
          action: 'retry_execution',
          entity_type: 'execution',
          entity_id: newExecutionId,
          new_values: { originalExecutionId: executionId },
          user_id: userId,
          timestamp: new Date().toISOString(),
          success: true
        });

      results.push({
        executionId,
        success: true,
        message: 'Nova execução criada com sucesso',
        newExecutionId
      });

    } catch (error) {
      results.push({
        executionId,
        success: false,
        error: 'Erro interno'
      });
    }
  }

  return results;
}

async function deleteExecutions(executionIds: string[], userId: string) {
  const results = [];

  for (const executionId of executionIds) {
    try {
      // Buscar execução
      const { data: execution, error: fetchError } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (fetchError || !execution) {
        results.push({
          executionId,
          success: false,
          error: 'Execução não encontrada'
        });
        continue;
      }

      // Verificar se pode ser deletada (não pode deletar execuções em andamento)
      if (['queued', 'running'].includes(execution.status)) {
        results.push({
          executionId,
          success: false,
          error: 'Não é possível deletar execução em andamento'
        });
        continue;
      }

      // Deletar logs relacionados
      await supabase
        .from('workflow_execution_logs')
        .delete()
        .eq('execution_id', executionId);

      // Deletar execução
      const { error: deleteError } = await supabase
        .from('workflow_executions')
        .delete()
        .eq('id', executionId);

      if (deleteError) {
        results.push({
          executionId,
          success: false,
          error: 'Erro ao deletar execução'
        });
        continue;
      }

      // Log da ação
      await supabase
        .from('workflow_audit_logs')
        .insert({
          workflow_id: execution.workflow_id,
          action: 'delete_execution',
          entity_type: 'execution',
          entity_id: executionId,
          old_values: { executionId, status: execution.status },
          user_id: userId,
          timestamp: new Date().toISOString(),
          success: true
        });

      results.push({
        executionId,
        success: true,
        message: 'Execução deletada com sucesso'
      });

    } catch (error) {
      results.push({
        executionId,
        success: false,
        error: 'Erro interno'
      });
    }
  }

  return results;
}
