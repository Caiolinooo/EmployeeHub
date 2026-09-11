/**
 * Agent Service — Motor do Agente Proativo
 * Portal ABZ - Análise de KPIs, lembretes automáticos, follow-up
 */
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUserIds } from '@/lib/push';

// =====================================================
// Types
// =====================================================

export interface AgentAnalysis {
  kpiKey: string;
  kpiLabel: string;
  currentValue: number;
  targetValue: number;
  gap: number;
  unit: string;
  affectedUsers: string[];
  department?: string;
  suggestedAction: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScheduledTask {
  id: string;
  user_id: string;
  task_name: string;
  task_type: string;
  prompt: string;
  schedule: string;
  target_users: string[];
  target_roles: string[];
  notification_channels: string[];
  metadata: Record<string, any>;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  max_runs: number | null;
  status: string;
  error_log: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Feature Toggle Checker
// =====================================================

/**
 * Verifica se uma feature da IA está habilitada
 */
export async function isFeatureEnabled(featureKey: string, userRole?: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ia_feature_toggles')
      .select('is_enabled, allowed_roles')
      .eq('feature_key', featureKey)
      .single();

    if (error || !data) return false;
    if (!data.is_enabled) return false;

    // Se userRole foi fornecido, verificar se tem permissão
    if (userRole && data.allowed_roles && data.allowed_roles.length > 0) {
      return data.allowed_roles.includes(userRole);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Buscar todos os toggles
 */
export async function getAllFeatureToggles(): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ia_feature_toggles')
      .select('*')
      .order('category', { ascending: true })
      .order('feature_name', { ascending: true });

    return data || [];
  } catch {
    return [];
  }
}

/**
 * Atualizar um toggle
 */
export async function updateFeatureToggle(featureKey: string, updates: {
  is_enabled?: boolean;
  config?: Record<string, any>;
  allowed_roles?: string[];
}): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('ia_feature_toggles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('feature_key', featureKey);

    return !error;
  } catch {
    return false;
  }
}

// =====================================================
// KPI Analysis
// =====================================================

/**
 * Analisa KPIs e identifica anomalias comparando com metas
 */
export async function analyzeKPIs(department?: string): Promise<AgentAnalysis[]> {
  try {
    // 1. Buscar metas ativas
    let query = supabaseAdmin
      .from('kpi_targets')
      .select('*')
      .eq('is_active', true);

    if (department) {
      query = query.or(`department.eq.${department},department.is.null`);
    }

    const { data: targets, error: targetsErr } = await query;
    if (targetsErr || !targets || targets.length === 0) return [];

    const analyses: AgentAnalysis[] = [];

    for (const target of targets) {
      const t = target as any;
      let currentValue = t.current_value;

      // Se auto_calculated, calcular do banco
      if (t.auto_calculated && !currentValue) {
        currentValue = await calculateKPIValue(t.kpi_key, t.department, t.sector);
      }

      if (currentValue === null || currentValue === undefined) continue;

      const gap = ((t.target_value - currentValue) / t.target_value) * 100;

      // Só reportar se abaixo da meta
      if (currentValue < t.target_value) {
        let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (gap > 50) priority = 'critical';
        else if (gap > 30) priority = 'high';
        else if (gap > 15) priority = 'medium';

        // Buscar usuários afetados
        const affectedUsers = await getAffectedUsers(t.kpi_key, t.department);

        analyses.push({
          kpiKey: t.kpi_key,
          kpiLabel: t.kpi_label,
          currentValue,
          targetValue: t.target_value,
          gap: Math.round(gap * 100) / 100,
          unit: t.unit,
          department: t.department,
          affectedUsers,
          suggestedAction: generateSuggestedAction(t.kpi_key, gap, priority),
          priority,
        });
      }
    }

    return analyses.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  } catch (err) {
    console.error('[Agent] Error analyzing KPIs:', err);
    return [];
  }
}

/**
 * Calcula o valor atual de um KPI com base nos dados do banco
 */
async function calculateKPIValue(kpiKey: string, department?: string, sector?: string): Promise<number | null> {
  try {
    switch (kpiKey) {
      case 'evaluation_completion': {
        // % de avaliações concluídas
        const { count: total } = await supabaseAdmin
          .from('evaluation_metrics')
          .select('*', { count: 'exact', head: true });
        const { count: done } = await supabaseAdmin
          .from('evaluation_metrics')
          .select('*', { count: 'exact', head: true })
          .not('overall_score', 'is', null);
        if (!total || total === 0) return null;
        return Math.round(((done || 0) / total) * 100);
      }

      case 'evaluation_avg_score': {
        // Nota média
        const { data } = await supabaseAdmin
          .from('evaluation_metrics')
          .select('overall_score')
          .not('overall_score', 'is', null);
        if (!data || data.length === 0) return null;
        const avg = data.reduce((sum: number, d: any) => sum + (d.overall_score || 0), 0) / data.length;
        return Math.round(avg * 100) / 100;
      }

      case 'vacation_pending_rate': {
        // % de férias pendentes (líder ou gerente)
        const { count: total } = await supabaseAdmin
          .from('leave_requests')
          .select('*', { count: 'exact', head: true });
        const { count: pending } = await supabaseAdmin
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .in('status', ['PENDING_LEADER', 'PENDING_MANAGER']);
        if (!total || total === 0) return 0;
        return Math.round(((pending || 0) / total) * 100);
      }

      case 'reimbursement_approval_rate': {
        // % de reembolsos aprovados (pagos)
        const { count: total } = await supabaseAdmin
          .from('Reimbursement')
          .select('*', { count: 'exact', head: true });
        const { count: approved } = await supabaseAdmin
          .from('Reimbursement')
          .select('*', { count: 'exact', head: true })
          .in('status', ['aprovado', 'pago', 'APPROVED']);
        if (!total || total === 0) return 0;
        return Math.round(((approved || 0) / total) * 100);
      }

      case 'reimbursement_pending_count': {
        const { count: pending } = await supabaseAdmin
          .from('Reimbursement')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
        return pending || 0;
      }

      case 'purchase_pending_count': {
        const { count: pending } = await supabaseAdmin
          .from('purchase_requests')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'PENDING', 'aguardando', 'em_aprovacao']);
        return pending || 0;
      }

      case 'email_unread_related':
      case 'teams_pending_signals':
        // Calculados via scan Graph em buscar_kpis_sistema / collectKpiCommunicationSignals
        return null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Encontra usuários afetados por uma anomalia de KPI
 */
async function getAffectedUsers(kpiKey: string, department?: string): Promise<string[]> {
  try {
    let query = supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('is_active', true);

    if (department) {
      query = query.eq('department', department);
    }

    const { data } = await query.limit(50);
    return (data || []).map((u: any) => u.id);
  } catch {
    return [];
  }
}

/**
 * Gera ação sugerida com base no KPI e severidade
 */
function generateSuggestedAction(kpiKey: string, gap: number, priority: string): string {
  const actions: Record<string, string> = {
    evaluation_completion: 'Enviar lembrete para avaliações pendentes e revisar e-mails/Teams sobre prazos',
    evaluation_avg_score: 'Agendar reunião de feedback com colaboradores de menor pontuação',
    vacation_pending_rate: 'Revisar e aprovar férias pendentes; checar e-mails/Teams de solicitação',
    reimbursement_approval_rate: 'Processar reembolsos em espera; verificar conversas de aprovação',
    reimbursement_pending_count: 'Triar reembolsos pendentes e responder threads de e-mail/Teams',
    purchase_pending_count: 'Avançar RQFs pendentes e alinhar com compradores no Teams',
  };
  return actions[kpiKey] || `Investigar KPI ${kpiKey} (gap: ${gap.toFixed(1)}%)`;
}

// =====================================================
// Proactive Notifications
// =====================================================

/**
 * Envia lembrete proativo via múltiplos canais
 */
export async function sendProactiveReminder(
  userId: string,
  title: string,
  message: string,
  channels: string[],
  options?: {
    actionUrl?: string;
    priority?: string;
    taskId?: string;
  }
): Promise<{ push: boolean; portal: boolean; email: boolean }> {
  const results = { push: false, portal: false, email: false };

  try {
    // 1. Notificação no portal (sempre)
    if (channels.includes('portal') || channels.includes('push')) {
      const { error } = await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'ia_agent',
        title,
        message,
        priority: options?.priority || 'medium',
        action_url: options?.actionUrl || '/ia',
        data: { source: 'agent', task_id: options?.taskId },
        push_sent: false,
        email_sent: false,
      });
      results.portal = !error;
    }

    // 2. Push notification
    if (channels.includes('push')) {
      const pushResult = await sendPushToUserIds([userId], {
        title,
        body: message,
        url: options?.actionUrl || '/ia',
        icon: '/icons/abz-icon-192.png',
      });
      results.push = (pushResult.sent || 0) > 0;
    }

    // 3. Email (usa o email-tool existente via import dinâmico)
    if (channels.includes('email')) {
      try {
        // Buscar email do usuário
        const { data: user } = await supabaseAdmin
          .from('users_unified')
          .select('email, first_name')
          .eq('id', userId)
          .single();

        if (user?.email) {
          const { sendSimpleEmail } = await import('@/lib/ia/email-tool');
          await sendSimpleEmail(
            user.email,
            `[ABZ IA] ${title}`,
            `${message}<br><br><a href="${options?.actionUrl || '/ia'}">Ver no Portal</a>`
          );
        }
      } catch (emailErr) {
        console.error('[Agent] Error sending email:', emailErr);
      }
    }

    // Log da ação
    await supabaseAdmin.from('agent_action_log').insert({
      task_id: options?.taskId || null,
      user_id: userId,
      action_type: 'notification_sent',
      action_description: title,
      details: { message, channels, results },
      channels_used: channels,
      success: true,
    });

    return results;
  } catch (err) {
    console.error('[Agent] Error sending proactive reminder:', err);
    return results;
  }
}

// =====================================================
// Scheduled Tasks Management
// =====================================================

/**
 * Criar tarefa agendada
 */
export async function createScheduledTask(input: {
  userId: string;
  taskName: string;
  taskType: string;
  prompt: string;
  schedule: string;
  targetUsers?: string[];
  targetRoles?: string[];
  channels?: string[];
  metadata?: Record<string, any>;
  maxRuns?: number;
}): Promise<ScheduledTask | null> {
  try {
    const nextRun = calculateNextRun(input.schedule);

    const { data, error } = await supabaseAdmin
      .from('scheduled_tasks')
      .insert({
        user_id: input.userId,
        task_name: input.taskName,
        task_type: input.taskType,
        prompt: input.prompt,
        schedule: input.schedule,
        target_users: input.targetUsers || [],
        target_roles: input.targetRoles || [],
        notification_channels: input.channels || ['push', 'email'],
        metadata: input.metadata || {},
        next_run: nextRun,
        max_runs: input.maxRuns || null,
        created_by: input.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[Agent] Error creating scheduled task:', error);
      return null;
    }

    return data as ScheduledTask;
  } catch {
    return null;
  }
}

/**
 * Buscar tarefas prontas para execução
 */
export async function getPendingTasks(): Promise<ScheduledTask[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_tasks')
      .select('*')
      .eq('status', 'active')
      .lte('next_run', new Date().toISOString())
      .order('next_run', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[Agent] Error fetching pending tasks:', error);
      return [];
    }

    return (data || []) as ScheduledTask[];
  } catch {
    return [];
  }
}

/**
 * Marcar tarefa como executada e agendar próxima execução
 */
export async function markTaskExecuted(taskId: string, success: boolean, errorLog?: string): Promise<void> {
  try {
    const { data: task } = await supabaseAdmin
      .from('scheduled_tasks')
      .select('schedule, run_count, max_runs')
      .eq('id', taskId)
      .single();

    if (!task) return;

    const t = task as any;
    const newRunCount = (t.run_count || 0) + 1;
    const reachedMax = t.max_runs && newRunCount >= t.max_runs;

    await supabaseAdmin
      .from('scheduled_tasks')
      .update({
        last_run: new Date().toISOString(),
        next_run: reachedMax ? null : calculateNextRun(t.schedule),
        run_count: newRunCount,
        status: reachedMax ? 'completed' : (success ? 'active' : 'error'),
        error_log: errorLog || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  } catch (err) {
    console.error('[Agent] Error marking task executed:', err);
  }
}

/**
 * Listar todas as tarefas agendadas de um usuário
 */
export async function listScheduledTasks(userId: string, includeCompleted?: boolean): Promise<ScheduledTask[]> {
  try {
    let query = supabaseAdmin
      .from('scheduled_tasks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (!includeCompleted) {
      query = query.in('status', ['active', 'paused', 'error']);
    }

    const { data, error } = await query;
    return (data || []) as ScheduledTask[];
  } catch {
    return [];
  }
}

/**
 * Pausar/Resumir tarefa
 */
export async function toggleTaskStatus(taskId: string, status: 'active' | 'paused'): Promise<boolean> {
  try {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'active') {
      const { data: task } = await supabaseAdmin
        .from('scheduled_tasks')
        .select('schedule')
        .eq('id', taskId)
        .single();
      if (task) {
        updates.next_run = calculateNextRun((task as any).schedule);
      }
    }
    const { error } = await supabaseAdmin
      .from('scheduled_tasks')
      .update(updates)
      .eq('id', taskId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Deletar tarefa
 */
export async function deleteScheduledTask(taskId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId);
    return !error;
  } catch {
    return false;
  }
}

// =====================================================
// Cron Utilities
// =====================================================

/**
 * Calcula próxima execução com base na expressão cron
 * Suporta expressões simples: '50 7 * * 1-5' (7:50 seg-sex)
 */
function calculateNextRun(schedule: string): string {
  try {
    const parts = schedule.split(' ');
    if (parts.length !== 5) {
      // Fallback: próxima hora
      return new Date(Date.now() + 3600000).toISOString();
    }

    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date();

    // Configurar hora/minuto
    const targetHour = hour === '*' ? now.getHours() : parseInt(hour, 10);
    const targetMinute = minute === '*' ? 0 : parseInt(minute, 10);

    next.setHours(targetHour, targetMinute, 0, 0);

    // Se já passou hoje, agendar para amanhã
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // Se tem restrição de dia da semana (campo 5)
    const dow = parts[4];
    if (dow !== '*') {
      const allowedDays = parseDaysOfWeek(dow);
      while (!allowedDays.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next.toISOString();
  } catch {
    return new Date(Date.now() + 3600000).toISOString();
  }
}

/**
 * Parse dias da semana do cron (1-5 = seg-sex, 0 = dom)
 */
function parseDaysOfWeek(expr: string): number[] {
  const days: number[] = [];

  for (const part of expr.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        days.push(i);
      }
    } else {
      days.push(parseInt(part, 10));
    }
  }

  return days;
}

// =====================================================
// Agent Action Log
// =====================================================

/**
 * Registrar ação do agente
 */
export async function logAgentAction(entry: {
  taskId?: string;
  userId?: string;
  actionType: string;
  description?: string;
  details?: Record<string, any>;
  channels?: string[];
  kpiSnapshot?: Record<string, any>;
  success?: boolean;
  error?: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from('agent_action_log').insert({
      task_id: entry.taskId || null,
      user_id: entry.userId || null,
      action_type: entry.actionType,
      action_description: entry.description || null,
      details: entry.details || {},
      channels_used: entry.channels || [],
      kpi_snapshot: entry.kpiSnapshot || null,
      success: entry.success !== false,
      error_message: entry.error || null,
    });
  } catch (err) {
    console.error('[Agent] Error logging action:', err);
  }
}

/**
 * Buscar log de ações recentes
 */
export async function getRecentActions(opts?: {
  userId?: string;
  actionType?: string;
  limit?: number;
}): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('agent_action_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit || 50);

    if (opts?.userId) query = query.eq('user_id', opts.userId);
    if (opts?.actionType) query = query.eq('action_type', opts.actionType);

    const { data } = await query;
    return data || [];
  } catch {
    return [];
  }
}
