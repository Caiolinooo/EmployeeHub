import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { WorkflowExecution, ExecutionLog, StepExecution } from '@/types/workflows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const workflowId = params.id;
    const body = await request.json();
    const { variables = {}, triggerData = {} } = body;

    // Buscar workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({
        success: false,
        error: 'Workflow não encontrado'
      }, { status: 404 });
    }

    // Verificar se workflow está ativo
    if (workflow.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Workflow não está ativo'
      }, { status: 400 });
    }

    // Verificar permissões de execução
    const hasExecutePermission = workflow.created_by === authResult.userId ||
                                workflow.permissions?.executors?.includes(authResult.userId) ||
                                workflow.permissions?.isPublic;

    if (!hasExecutePermission) {
      // Verificar se usuário é admin
      const { data: user } = await supabase
        .from('users_unified')
        .select('role')
        .eq('id', authResult.userId)
        .single();

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Sem permissão para executar este workflow'
        }, { status: 403 });
      }
    }

    // Verificar limite de execuções concorrentes
    const { data: runningExecutions } = await supabase
      .from('workflow_executions')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('status', 'running');

    if (runningExecutions && runningExecutions.length >= workflow.settings.maxConcurrentExecutions) {
      return NextResponse.json({
        success: false,
        error: 'Limite de execuções concorrentes atingido'
      }, { status: 429 });
    }

    // Criar execução
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflowId,
      workflowVersion: workflow.version,
      status: 'queued',
      startTime: new Date().toISOString(),
      triggeredBy: authResult.userId,
      triggerData,
      variables: { ...workflow.variables.reduce((acc: any, v: any) => ({ ...acc, [v.name]: v.defaultValue }), {}), ...variables },
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
      }
    };

    // Salvar execução no banco
    const { data: savedExecution, error: executionError } = await supabase
      .from('workflow_executions')
      .insert({
        id: execution.id,
        workflow_id: execution.workflowId,
        workflow_version: execution.workflowVersion,
        status: execution.status,
        start_time: execution.startTime,
        triggered_by: execution.triggeredBy,
        trigger_data: execution.triggerData,
        variables: execution.variables,
        steps: execution.steps,
        logs: execution.logs,
        metrics: execution.metrics
      })
      .select()
      .single();

    if (executionError) {
      console.error('Erro ao criar execução:', executionError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar execução'
      }, { status: 500 });
    }

    // Iniciar execução assíncrona
    executeWorkflowAsync(execution, workflow);

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: workflowId,
        action: 'execute',
        entity_type: 'execution',
        entity_id: execution.id,
        new_values: { executionId: execution.id, triggeredBy: execution.triggeredBy },
        user_id: authResult.userId,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      execution: {
        id: execution.id,
        status: execution.status,
        startTime: execution.startTime
      },
      message: 'Execução iniciada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao executar workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function executeWorkflowAsync(execution: WorkflowExecution, workflow: any) {
  try {
    // Atualizar status para running
    execution.status = 'running';
    await updateExecution(execution);

    // Log de início
    await addExecutionLog(execution.id, 'info', `Iniciando execução do workflow: ${workflow.name}`);

    // Executar steps sequencialmente
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      const stepExecution: StepExecution = {
        id: `step_${i + 1}`,
        stepId: step.id,
        stepName: step.name,
        status: 'running',
        startTime: new Date().toISOString(),
        retryCount: 0,
        logs: []
      };

      execution.steps.push(stepExecution);
      await updateExecution(execution);

      try {
        // Simular execução do step
        await executeStep(step, execution, stepExecution);
        
        stepExecution.status = 'success';
        stepExecution.endTime = new Date().toISOString();
        stepExecution.duration = new Date(stepExecution.endTime).getTime() - new Date(stepExecution.startTime!).getTime();
        
        await addExecutionLog(execution.id, 'info', `Step '${step.name}' executado com sucesso`, step.id, step.name);
        
      } catch (stepError) {
        stepExecution.status = 'failed';
        stepExecution.endTime = new Date().toISOString();
        stepExecution.error = stepError instanceof Error ? stepError.message : 'Erro desconhecido';
        
        await addExecutionLog(execution.id, 'error', `Erro no step '${step.name}': ${stepExecution.error}`, step.id, step.name);
        
        // Verificar estratégia de tratamento de erro
        if (step.errorHandling?.strategy === 'stop') {
          execution.status = 'failed';
          break;
        }
      }
      
      await updateExecution(execution);
    }

    // Finalizar execução
    if (execution.status === 'running') {
      execution.status = 'success';
    }
    
    execution.endTime = new Date().toISOString();
    execution.duration = new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime();
    
    await updateExecution(execution);
    await addExecutionLog(execution.id, 'info', `Execução finalizada com status: ${execution.status}`);

    // Atualizar estatísticas do workflow
    await updateWorkflowStatistics(workflow.id, execution);

  } catch (error) {
    console.error('Erro na execução do workflow:', error);
    
    execution.status = 'failed';
    execution.endTime = new Date().toISOString();
    execution.duration = execution.endTime ? new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime() : 0;
    
    await updateExecution(execution);
    await addExecutionLog(execution.id, 'error', `Erro fatal na execução: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

async function executeStep(step: any, execution: WorkflowExecution, stepExecution: StepExecution) {
  // Simular diferentes tipos de steps
  switch (step.type) {
    case 'action':
      await executeActionStep(step, execution, stepExecution);
      break;
    case 'condition':
      await executeConditionStep(step, execution, stepExecution);
      break;
    case 'delay':
      await executeDelayStep(step, execution, stepExecution);
      break;
    case 'notification':
      await executeNotificationStep(step, execution, stepExecution);
      break;
    default:
      // Step genérico - simular processamento
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  }
}

async function executeActionStep(step: any, execution: WorkflowExecution, stepExecution: StepExecution) {
  const actionType = step.config?.actionType;
  
  switch (actionType) {
    case 'email':
      // Simular envio de email
      execution.metrics.emailsSent++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      stepExecution.output = { emailSent: true, recipient: step.config.actionConfig?.emailTo };
      break;
    case 'webhook':
      // Simular chamada webhook
      execution.metrics.networkRequests++;
      execution.metrics.apiCalls++;
      await new Promise(resolve => setTimeout(resolve, 800));
      stepExecution.output = { webhookCalled: true, url: step.config.actionConfig?.webhookUrl };
      break;
    case 'database':
      // Simular operação de banco
      execution.metrics.databaseQueries++;
      await new Promise(resolve => setTimeout(resolve, 600));
      stepExecution.output = { databaseOperation: true, table: step.config.actionConfig?.databaseTable };
      break;
    default:
      await new Promise(resolve => setTimeout(resolve, 500));
      stepExecution.output = { actionExecuted: true, type: actionType };
  }
}

async function executeConditionStep(step: any, execution: WorkflowExecution, stepExecution: StepExecution) {
  // Simular avaliação de condição
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const conditionResult = Math.random() > 0.2; // 80% de chance de sucesso
  stepExecution.output = { conditionMet: conditionResult, conditions: step.config?.conditions };
}

async function executeDelayStep(step: any, execution: WorkflowExecution, stepExecution: StepExecution) {
  const delayDuration = step.config?.delayDuration || 1;
  const delayUnit = step.config?.delayUnit || 'seconds';
  
  let delayMs = delayDuration * 1000; // padrão em segundos
  
  switch (delayUnit) {
    case 'minutes':
      delayMs = delayDuration * 60 * 1000;
      break;
    case 'hours':
      delayMs = delayDuration * 60 * 60 * 1000;
      break;
    case 'days':
      delayMs = delayDuration * 24 * 60 * 60 * 1000;
      break;
  }
  
  // Limitar delay máximo para demonstração (5 segundos)
  delayMs = Math.min(delayMs, 5000);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));
  stepExecution.output = { delayCompleted: true, duration: delayMs };
}

async function executeNotificationStep(step: any, execution: WorkflowExecution, stepExecution: StepExecution) {
  // Simular envio de notificação
  execution.metrics.notificationsSent++;
  await new Promise(resolve => setTimeout(resolve, 300));
  
  stepExecution.output = { 
    notificationSent: true, 
    type: step.config?.notificationType,
    recipients: step.config?.recipients 
  };
}

async function updateExecution(execution: WorkflowExecution) {
  await supabase
    .from('workflow_executions')
    .update({
      status: execution.status,
      end_time: execution.endTime,
      duration: execution.duration,
      steps: execution.steps,
      logs: execution.logs,
      metrics: execution.metrics
    })
    .eq('id', execution.id);
}

async function addExecutionLog(
  executionId: string, 
  level: 'error' | 'warn' | 'info' | 'debug', 
  message: string, 
  stepId?: string, 
  stepName?: string
) {
  const log: ExecutionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    stepId,
    stepName
  };

  await supabase
    .from('workflow_execution_logs')
    .insert({
      id: log.id,
      execution_id: executionId,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      step_id: log.stepId,
      step_name: log.stepName
    });
}

async function updateWorkflowStatistics(workflowId: string, execution: WorkflowExecution) {
  // Buscar estatísticas atuais
  const { data: workflow } = await supabase
    .from('workflows')
    .select('statistics')
    .eq('id', workflowId)
    .single();

  if (workflow) {
    const stats = workflow.statistics || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionHistory: []
    };

    // Atualizar estatísticas
    stats.totalExecutions++;
    if (execution.status === 'success') {
      stats.successfulExecutions++;
    } else if (execution.status === 'failed') {
      stats.failedExecutions++;
    }

    // Calcular tempo médio de execução
    if (execution.duration) {
      stats.averageExecutionTime = ((stats.averageExecutionTime * (stats.totalExecutions - 1)) + execution.duration) / stats.totalExecutions;
    }

    // Adicionar ao histórico (manter apenas os últimos 100)
    stats.executionHistory.unshift({
      id: execution.id,
      startTime: execution.startTime,
      endTime: execution.endTime,
      status: execution.status,
      duration: execution.duration,
      stepsExecuted: execution.steps.filter(s => s.status === 'success').length,
      stepsTotal: execution.steps.length,
      errorMessage: execution.steps.find(s => s.error)?.error,
      triggeredBy: execution.triggeredBy
    });

    if (stats.executionHistory.length > 100) {
      stats.executionHistory = stats.executionHistory.slice(0, 100);
    }

    // Atualizar no banco
    await supabase
      .from('workflows')
      .update({
        statistics: stats,
        last_executed: execution.startTime
      })
      .eq('id', workflowId);
  }
}
