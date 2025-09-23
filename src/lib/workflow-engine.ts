import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'schedule' | 'webhook' | 'event' | 'manual';
  trigger_config: Record<string, any>;
  steps: WorkflowStep[];
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_run?: string;
  run_count: number;
}

export interface WorkflowStep {
  id: string;
  type: 'condition' | 'action' | 'delay' | 'loop';
  name: string;
  config: Record<string, any>;
  next_step?: string;
  error_step?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  steps_executed: ExecutedStep[];
}

export interface ExecutedStep {
  step_id: string;
  status: 'success' | 'failed' | 'skipped';
  started_at: string;
  completed_at?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private scheduledJobs = new Map<string, cron.ScheduledTask>();
  private runningExecutions = new Map<string, WorkflowExecution>();

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  constructor() {
    this.initializeScheduledWorkflows();
  }

  // Inicializar workflows agendados
  private async initializeScheduledWorkflows(): Promise<void> {
    try {
      const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('active', true)
        .eq('trigger_type', 'schedule');

      workflows?.forEach(workflow => {
        this.scheduleWorkflow(workflow);
      });
    } catch (error) {
      console.error('Erro ao inicializar workflows:', error);
    }
  }

  // Agendar workflow
  private scheduleWorkflow(workflow: Workflow): void {
    if (workflow.trigger_type !== 'schedule') return;

    const cronExpression = workflow.trigger_config.cron;
    if (!cronExpression) return;

    try {
      const task = cron.schedule(cronExpression, async () => {
        await this.executeWorkflow(workflow.id, {});
      }, {
        scheduled: false
      });

      this.scheduledJobs.set(workflow.id, task);
      task.start();
      
      console.log(`Workflow ${workflow.name} agendado: ${cronExpression}`);
    } catch (error) {
      console.error(`Erro ao agendar workflow ${workflow.name}:`, error);
    }
  }

  // Criar workflow
  async createWorkflow(workflowData: {
    name: string;
    description?: string;
    trigger_type: Workflow['trigger_type'];
    trigger_config: Record<string, any>;
    steps: WorkflowStep[];
    created_by: string;
  }): Promise<Workflow> {
    const { data, error } = await supabase
      .from('workflows')
      .insert([{
        ...workflowData,
        active: true,
        run_count: 0
      }])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar workflow: ${error.message}`);

    // Agendar se for do tipo schedule
    if (data.trigger_type === 'schedule') {
      this.scheduleWorkflow(data);
    }

    return data;
  }

  // Executar workflow
  async executeWorkflow(workflowId: string, inputData: Record<string, any>): Promise<WorkflowExecution> {
    const startTime = Date.now();
    
    // Buscar workflow
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !workflow) {
      throw new Error('Workflow não encontrado');
    }

    // Criar execução
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert([{
        workflow_id: workflowId,
        status: 'running',
        input_data: inputData,
        steps_executed: []
      }])
      .select()
      .single();

    if (execError) throw new Error(`Erro ao criar execução: ${execError.message}`);

    this.runningExecutions.set(execution.id, execution);

    try {
      // Executar steps
      const result = await this.executeSteps(workflow.steps, inputData, execution.id);
      
      const duration = Date.now() - startTime;

      // Atualizar execução como concluída
      const { data: completedExecution } = await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          output_data: result
        })
        .eq('id', execution.id)
        .select()
        .single();

      // Atualizar contador do workflow
      await supabase
        .from('workflows')
        .update({
          last_run: new Date().toISOString(),
          run_count: supabase.sql`run_count + 1`
        })
        .eq('id', workflowId);

      this.runningExecutions.delete(execution.id);
      return completedExecution || execution;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Atualizar execução como falhada
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: error.message
        })
        .eq('id', execution.id);

      this.runningExecutions.delete(execution.id);
      throw error;
    }
  }

  // Executar steps do workflow
  private async executeSteps(
    steps: WorkflowStep[],
    data: Record<string, any>,
    executionId: string
  ): Promise<Record<string, any>> {
    let currentData = { ...data };
    const executedSteps: ExecutedStep[] = [];

    for (const step of steps) {
      const stepStartTime = Date.now();
      
      try {
        const stepResult = await this.executeStep(step, currentData);
        
        const executedStep: ExecutedStep = {
          step_id: step.id,
          status: 'success',
          started_at: new Date(stepStartTime).toISOString(),
          completed_at: new Date().toISOString(),
          input: currentData,
          output: stepResult
        };

        executedSteps.push(executedStep);
        currentData = { ...currentData, ...stepResult };

        // Atualizar execução com step concluído
        await this.updateExecutionSteps(executionId, executedSteps);

      } catch (error) {
        const executedStep: ExecutedStep = {
          step_id: step.id,
          status: 'failed',
          started_at: new Date(stepStartTime).toISOString(),
          completed_at: new Date().toISOString(),
          input: currentData,
          error: error.message
        };

        executedSteps.push(executedStep);
        await this.updateExecutionSteps(executionId, executedSteps);
        
        throw error;
      }
    }

    return currentData;
  }

  // Executar step individual
  private async executeStep(step: WorkflowStep, data: Record<string, any>): Promise<Record<string, any>> {
    switch (step.type) {
      case 'condition':
        return await this.executeConditionStep(step, data);
      case 'action':
        return await this.executeActionStep(step, data);
      case 'delay':
        return await this.executeDelayStep(step, data);
      case 'loop':
        return await this.executeLoopStep(step, data);
      default:
        throw new Error(`Tipo de step não suportado: ${step.type}`);
    }
  }

  // Executar step de condição
  private async executeConditionStep(step: WorkflowStep, data: Record<string, any>): Promise<Record<string, any>> {
    const { condition, operator, value } = step.config;
    const dataValue = this.getNestedValue(data, condition);
    
    let result = false;
    switch (operator) {
      case 'equals':
        result = dataValue === value;
        break;
      case 'not_equals':
        result = dataValue !== value;
        break;
      case 'greater_than':
        result = Number(dataValue) > Number(value);
        break;
      case 'less_than':
        result = Number(dataValue) < Number(value);
        break;
      case 'contains':
        result = String(dataValue).includes(String(value));
        break;
    }

    return { condition_result: result };
  }

  // Executar step de ação
  private async executeActionStep(step: WorkflowStep, data: Record<string, any>): Promise<Record<string, any>> {
    const { action_type } = step.config;

    switch (action_type) {
      case 'send_email':
        return await this.sendEmailAction(step.config, data);
      case 'create_record':
        return await this.createRecordAction(step.config, data);
      case 'update_record':
        return await this.updateRecordAction(step.config, data);
      case 'http_request':
        return await this.httpRequestAction(step.config, data);
      case 'send_notification':
        return await this.sendNotificationAction(step.config, data);
      default:
        throw new Error(`Tipo de ação não suportado: ${action_type}`);
    }
  }

  // Executar step de delay
  private async executeDelayStep(step: WorkflowStep, data: Record<string, any>): Promise<Record<string, any>> {
    const { duration } = step.config;
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    return { delayed_for: duration };
  }

  // Executar step de loop
  private async executeLoopStep(step: WorkflowStep, data: Record<string, any>): Promise<Record<string, any>> {
    const { iterations, steps } = step.config;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const loopData = { ...data, loop_index: i };
      const loopResult = await this.executeSteps(steps, loopData, '');
      results.push(loopResult);
    }

    return { loop_results: results };
  }

  // Ações específicas
  private async sendEmailAction(config: any, data: Record<string, any>): Promise<Record<string, any>> {
    // Implementar envio de email
    const { to, subject, body } = config;
    const processedTo = this.processTemplate(to, data);
    const processedSubject = this.processTemplate(subject, data);
    const processedBody = this.processTemplate(body, data);

    // Aqui você integraria com seu sistema de email
    console.log('Enviando email:', { to: processedTo, subject: processedSubject });
    
    return { email_sent: true, recipient: processedTo };
  }

  private async createRecordAction(config: any, data: Record<string, any>): Promise<Record<string, any>> {
    const { table, fields } = config;
    const processedFields = this.processObjectTemplate(fields, data);

    const { data: record, error } = await supabase
      .from(table)
      .insert([processedFields])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar registro: ${error.message}`);
    
    return { created_record: record };
  }

  private async updateRecordAction(config: any, data: Record<string, any>): Promise<Record<string, any>> {
    const { table, where, fields } = config;
    const processedWhere = this.processObjectTemplate(where, data);
    const processedFields = this.processObjectTemplate(fields, data);

    let query = supabase.from(table).update(processedFields);
    
    Object.entries(processedWhere).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: records, error } = await query.select();
    if (error) throw new Error(`Erro ao atualizar registro: ${error.message}`);
    
    return { updated_records: records };
  }

  private async httpRequestAction(config: any, data: Record<string, any>): Promise<Record<string, any>> {
    const { method, url, headers, body } = config;
    const processedUrl = this.processTemplate(url, data);
    const processedHeaders = this.processObjectTemplate(headers || {}, data);
    const processedBody = body ? this.processObjectTemplate(body, data) : undefined;

    const response = await axios({
      method,
      url: processedUrl,
      headers: processedHeaders,
      data: processedBody
    });

    return { 
      http_response: {
        status: response.status,
        data: response.data
      }
    };
  }

  private async sendNotificationAction(config: any, data: Record<string, any>): Promise<Record<string, any>> {
    const { user_id, title, message } = config;
    const processedUserId = this.processTemplate(user_id, data);
    const processedTitle = this.processTemplate(title, data);
    const processedMessage = this.processTemplate(message, data);

    // Implementar sistema de notificações
    console.log('Enviando notificação:', { 
      userId: processedUserId, 
      title: processedTitle, 
      message: processedMessage 
    });
    
    return { notification_sent: true, user_id: processedUserId };
  }

  // Utilitários
  private processTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      return this.getNestedValue(data, path) || match;
    });
  }

  private processObjectTemplate(obj: Record<string, any>, data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        result[key] = this.processTemplate(value, data);
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async updateExecutionSteps(executionId: string, steps: ExecutedStep[]): Promise<void> {
    await supabase
      .from('workflow_executions')
      .update({ steps_executed: steps })
      .eq('id', executionId);
  }

  // Métodos públicos para gerenciamento
  async getWorkflows(): Promise<Workflow[]> {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar workflows: ${error.message}`);
    return data || [];
  }

  async getWorkflowExecutions(workflowId?: string): Promise<WorkflowExecution[]> {
    let query = supabase
      .from('workflow_executions')
      .select('*')
      .order('started_at', { ascending: false });

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar execuções: ${error.message}`);
    return data || [];
  }

  async toggleWorkflow(workflowId: string): Promise<void> {
    const { data: workflow } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (!workflow) throw new Error('Workflow não encontrado');

    const newStatus = !workflow.active;

    await supabase
      .from('workflows')
      .update({ active: newStatus })
      .eq('id', workflowId);

    // Gerenciar agendamento
    if (workflow.trigger_type === 'schedule') {
      if (newStatus) {
        this.scheduleWorkflow({ ...workflow, active: newStatus });
      } else {
        const task = this.scheduledJobs.get(workflowId);
        if (task) {
          task.stop();
          this.scheduledJobs.delete(workflowId);
        }
      }
    }
  }
}

export default WorkflowEngine.getInstance();
