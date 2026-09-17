// =====================================================
// Autonomous KPI Agent - Core Loop
// =====================================================

import { generateDashboard } from './dashboard-service';
import { analyzeKPIs } from './agent-service';
import { AdvancedOrchestrator, GapAnalysis } from './advanced-orchestrator';
import { ContextManager } from './context-manager';
import type { IADashboardLayout } from '@/types/ia';
import type { AutonomousConfig, AgentStatus, CycleData, DecisionLog } from './autonomous-config';

export interface AutonomousAgentEvents {
  layoutUpdate: (layout: IADashboardLayout) => void;
  decision: (decision: DecisionLog) => void;
  statusChange: (status: AgentStatus) => void;
  error: (error: Error) => void;
  cycleComplete: (cycleData: CycleData) => void;
}

export class AutonomousKPIAgent {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private status: AgentStatus = 'idle';
  private currentCycleId: string | null = null;
  
  private readonly userId: string;
  private readonly sectorId: string;
  private config: AutonomousConfig;
  
  private orchestrator: AdvancedOrchestrator;
  private contextManager: ContextManager;
  
  private layouts: IADashboardLayout[] = [];
  private decisionLog: DecisionLog[] = [];
  private cycleHistory: CycleData[] = [];
  
  private eventHandlers: { [K in keyof AutonomousAgentEvents]?: AutonomousAgentEvents[K][] } = {};

  constructor(
    userId: string,
    sectorId: string,
    config: Partial<AutonomousConfig> = {}
  ) {
    this.userId = userId;
    this.sectorId = sectorId;
    this.config = { ...this.getDefaultConfig(), ...config };
    this.orchestrator = new AdvancedOrchestrator();
    this.contextManager = new ContextManager();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AutonomousConfig {
    return {
      interval: 30000,
      autonomyLevel: 'medium',
      autoRender: true,
      maxLayouts: 5,
      learning: {
        enabled: true,
        memorySize: 1000,
        patternDetection: true,
        autoAdjust: true,
      },
      alerts: {
        enabled: true,
        channels: ['push', 'portal'],
        thresholds: {},
      },
      autoActions: {
        enabled: true,
        maxPerCycle: 3,
        requireConfirmation: false,
      },
      sectorConfig: {},
    };
  }

  /**
   * Start the autonomous agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[AutonomousKPIAgent] Agent is already running');
      return;
    }

    this.isRunning = true;
    this.setStatus('running');
    
    console.log(`[AutonomousKPIAgent] Starting agent for user ${this.userId}, sector ${this.sectorId}`);
    console.log(`[AutonomousKPIAgent] Cycle interval: ${this.config.interval}ms`);
    console.log(`[AutonomousKPIAgent] Autonomy level: ${this.config.autonomyLevel}`);

    // Execute initial cycle immediately
    await this.executeCycle();

    // Start periodic cycles
    this.interval = setInterval(async () => {
      await this.executeCycle();
    }, this.config.interval);

    this.emit('statusChange', this.status);
  }

  /**
   * Stop the autonomous agent
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[AutonomousKPIAgent] Agent is not running');
      return;
    }

    this.isRunning = false;
    this.setStatus('idle');
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('[AutonomousKPIAgent] Agent stopped');
    this.emit('statusChange', this.status);
  }

  /**
   * Pause the autonomous agent
   */
  pause(): void {
    if (!this.isRunning) return;
    
    this.setStatus('paused');
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    console.log('[AutonomousKPIAgent] Agent paused');
    this.emit('statusChange', this.status);
  }

  /**
   * Resume the autonomous agent
   */
  resume(): void {
    if (this.isRunning && this.status === 'paused') {
      this.setStatus('running');
      this.executeCycle();
      this.interval = setInterval(async () => {
        await this.executeCycle();
      }, this.config.interval);
      
      console.log('[AutonomousKPIAgent] Agent resumed');
      this.emit('statusChange', this.status);
    }
  }

  /**
   * Execute a single cycle
   */
  async executeCycle(): Promise<void> {
    if (!this.isRunning) return;
    
    const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentCycleId = cycleId;
    
    const cycleStart = Date.now();
    const cycleData: CycleData = {
      cycleId,
      startTime: cycleStart,
      endTime: cycleStart,
      actions: [],
      layoutsGenerated: 0,
      kpisAnalyzed: 0,
      errors: [],
    };

    try {
      console.log(`[AutonomousKPIAgent] Starting cycle ${cycleId}`);

      // Step 1: Gather context
      const context = await this.contextManager.getContext(this.userId);
      console.log('[AutonomousKPIAgent] Context gathered');

      // Step 2: Fetch current KPIs
      const currentKPIs = await this.fetchCurrentKPIs();
      cycleData.kpisAnalyzed = currentKPIs.length;
      console.log(`[AutonomousKPIAgent] Fetched ${currentKPIs.length} KPIs`);

      // Step 3: Analyze KPIs for gaps
      const analysis = await this.analyzeGaps(currentKPIs, context);
      console.log(`[AutonomousKPIAgent] Identified ${analysis.length} gaps`);

      // Step 4: Generate plan
      const plan = await this.generatePlan(analysis, context);
      console.log(`[AutonomousKPIAgent] Generated plan with ${plan.steps.length} steps`);

      // Step 5: Execute actions
      const executedActions = await this.executeActions(plan.steps, context);
      cycleData.actions = executedActions;
      console.log(`[AutonomousKPIAgent] Executed ${executedActions.length} actions`);

      // Step 6: Render updated dashboard
      if (this.config.autoRender && plan.steps.length > 0) {
        await this.renderUpdatedDashboard(plan, context);
        cycleData.layoutsGenerated = 1;
        console.log('[AutonomousKPIAgent] Dashboard updated');
      }

      // Step 7: Evaluate results and learn
      await this.evaluateResults(plan, context, executedActions);
      console.log('[AutonomousKPIAgent] Results evaluated');

      // Log decision
      this.logDecision(plan, context, analysis);

      // Check alerts
      if (this.config.alerts.enabled) {
        await this.checkAlerts(analysis, context);
      }

      // Store interaction in memory
      await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
        type: 'kpi_check',
        category: 'autonomous_cycle',
        data: {
          cycleId,
          kpisAnalyzed: cycleData.kpisAnalyzed,
          actionsExecuted: executedActions.length,
          layoutsGenerated: cycleData.layoutsGenerated,
        },
        outcome: 'success',
        success: true,
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AutonomousKPIAgent] Cycle error:', err);
      cycleData.errors.push(err.message);
      this.setStatus('error');
      this.emit('error', err);
      
      // Store failed interaction
      await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
        type: 'kpi_check',
        category: 'autonomous_cycle',
        data: { cycleId, error: err.message },
        outcome: 'error',
        success: false,
      }).catch(console.error);
    } finally {
      cycleData.endTime = Date.now();
      this.cycleHistory.push(cycleData);
      this.currentCycleId = null;
      
      // Keep only last 100 cycles
      if (this.cycleHistory.length > 100) {
        this.cycleHistory = this.cycleHistory.slice(-100);
      }
      
      this.emit('cycleComplete', cycleData);
    }
  }

  /**
   * Fetch current KPIs from dashboard service
   */
  private async fetchCurrentKPIs(): Promise<any[]> {
    try {
      const result = await generateDashboard(this.userId, 'USER', true);
      return result.data.kpis || [];
    } catch (err) {
      console.error('[AutonomousKPIAgent] Error fetching KPIs:', err);
      return [];
    }
  }

  /**
   * Analyze gaps in KPI performance
   */
  private async analyzeGaps(
    kpis: any[],
    context: any
  ): Promise<GapAnalysis[]> {
    const gaps: GapAnalysis[] = [];
    
    // Use agent service to analyze KPIs
    const analyses = await analyzeKPIs(context.department);
    
    for (const analysis of analyses) {
      const gap: GapAnalysis = {
        kpiKey: analysis.kpiKey,
        kpiLabel: analysis.kpiLabel,
        currentValue: analysis.currentValue,
        targetValue: analysis.targetValue,
        gap: analysis.gap,
        unit: analysis.unit,
        priority: analysis.priority,
        affectedUsers: analysis.affectedUsers,
        trend: analysis.gap > 0 ? 'declining' : 'improving',
      };
      gaps.push(gap);
    }
    
    // Also check for gaps in regular KPIs
    for (const kpi of kpis) {
      if (kpi.target && typeof kpi.value === 'number') {
        const gap = ((kpi.target - kpi.value) / kpi.target) * 100;
        if (gap > 10) { // Only report significant gaps
          gaps.push({
            kpiKey: kpi.label.toLowerCase().replace(/\s/g, '_'),
            kpiLabel: kpi.label,
            currentValue: kpi.value,
            targetValue: kpi.target,
            gap,
            unit: kpi.unit || '',
            priority: gap > 50 ? 'critical' : gap > 25 ? 'high' : 'medium',
            affectedUsers: context.teamMemberIds || [],
            trend: 'stable',
          });
        }
      }
    }
    
    return gaps.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || b.gap - a.gap;
    });
  }

  /**
   * Generate plan from analysis
   */
  private async generatePlan(
    analysis: GapAnalysis[],
    context: any
  ): Promise<any> {
    if (analysis.length === 0) {
      return {
        steps: [],
        justification: 'No significant gaps identified. All KPIs within acceptable ranges.',
        metadata: {
          generatedAt: new Date().toISOString(),
          confidence: 100,
          alternatives: [],
          estimatedImpact: 'No action needed',
        },
      };
    }
    
    return this.orchestrator.generatePlan(analysis, context);
  }

  /**
   * Execute plan actions
   */
  private async executeActions(
    steps: any[],
    context: any
  ): Promise<Array<{ type: string; success: boolean; duration: number; details: any }>> {
    const executedActions: Array<{ type: string; success: boolean; duration: number; details: any }> = [];
    
    const maxActions = Math.min(this.config.autoActions.maxPerCycle, steps.length);
    
    for (let i = 0; i < maxActions; i++) {
      const step = steps[i];
      const startTime = Date.now();
      
      try {
        let success = false;
        let details: any = {};
        
        switch (step.action) {
          case 'send_notification':
            success = await this.executeNotification(step, context);
            details = { channels: step.parameters.channels };
            break;
            
          case 'send_email':
            success = await this.executeEmail(step, context);
            details = { template: step.parameters.template };
            break;
            
          case 'analyze_kpi':
            success = await this.executeKPIAnalysis(step, context);
            details = { kpiKey: step.parameters.kpiKey };
            break;
            
          case 'create_task':
            success = await this.executeTaskCreation(step, context);
            details = { assignee: step.parameters.assignee };
            break;
            
          case 'generate_report':
            success = await this.executeReportGeneration(step, context);
            details = { format: step.parameters.format };
            break;
            
          case 'update_dashboard':
            success = true; // Dashboard update is handled separately
            details = { highlightIssue: step.parameters.highlightIssue };
            break;
            
          case 'monitor_outcome':
            success = true; // Monitoring is passive
            details = { duration: step.parameters.duration };
            break;
            
          default:
            console.warn(`[AutonomousKPIAgent] Unknown action type: ${step.action}`);
            success = false;
        }
        
        const duration = Date.now() - startTime;
        
        executedActions.push({
          type: step.action,
          success,
          duration,
          details,
        });
        
        // Log action
        await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
          type: step.action as any,
          category: 'autonomous_action',
          data: { step, success, duration },
          outcome: success ? 'success' : 'failure',
          success,
        });
        
      } catch (err) {
        console.error(`[AutonomousKPIAgent] Error executing action ${step.action}:`, err);
        
        executedActions.push({
          type: step.action,
          success: false,
          duration: Date.now() - startTime,
          details: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
    
    return executedActions;
  }

  /**
   * Execute notification action
   */
  private async executeNotification(step: any, context: any): Promise<boolean> {
    try {
      // In a real implementation, this would send actual notifications
      console.log(`[AutonomousKPIAgent] Would send notification via ${step.parameters.channels.join(', ')}`);
      return true;
    } catch (err) {
      console.error('[AutonomousKPIAgent] Notification error:', err);
      return false;
    }
  }

  /**
   * Execute email action
   */
  private async executeEmail(step: any, context: any): Promise<boolean> {
    try {
      // In a real implementation, this would send actual emails
      console.log(`[AutonomousKPIAgent] Would send email using template ${step.parameters.template}`);
      return true;
    } catch (err) {
      console.error('[AutonomousKPIAgent] Email error:', err);
      return false;
    }
  }

  /**
   * Execute KPI analysis action
   */
  private async executeKPIAnalysis(step: any, context: any): Promise<boolean> {
    try {
      const analyses = await analyzeKPIs(context.department);
      const relevantAnalysis = analyses.find(a => a.kpiKey === step.parameters.kpiKey);
      
      if (relevantAnalysis) {
        console.log(`[AutonomousKPIAgent] KPI ${step.parameters.kpiKey} analysis complete`);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[AutonomousKPIAgent] KPI analysis error:', err);
      return false;
    }
  }

  /**
   * Execute task creation action
   */
  private async executeTaskCreation(step: any, context: any): Promise<boolean> {
    try {
      // In a real implementation, this would create an actual task
      console.log(`[AutonomousKPIAgent] Would create task for ${step.parameters.assignee}`);
      return true;
    } catch (err) {
      console.error('[AutonomousKPIAgent] Task creation error:', err);
      return false;
    }
  }

  /**
   * Execute report generation action
   */
  private async executeReportGeneration(step: any, context: any): Promise<boolean> {
    try {
      // In a real implementation, this would generate an actual report
      console.log(`[AutonomousKPIAgent] Would generate ${step.parameters.format} report`);
      return true;
    } catch (err) {
      console.error('[AutonomousKPIAgent] Report generation error:', err);
      return false;
    }
  }

  /**
   * Render updated dashboard
   */
  private async renderUpdatedDashboard(plan: any, context: any): Promise<void> {
    try {
      const result = await generateDashboard(this.userId, 'USER', true);
      const layout = this.createLayoutFromDashboard(result.data, plan);
      
      this.layouts.unshift(layout);
      
      // Keep only recent layouts
      if (this.layouts.length > this.config.maxLayouts) {
        this.layouts = this.layouts.slice(0, this.config.maxLayouts);
      }
      
      this.emit('layoutUpdate', layout);
    } catch (err) {
      console.error('[AutonomousKPIAgent] Dashboard render error:', err);
      throw err;
    }
  }

  /**
   * Create layout from dashboard data
   */
  private createLayoutFromDashboard(
    dashboardData: any,
    plan: any
  ): IADashboardLayout {
    const widgets: any[] = [];
    
    // Add KPI widgets
    dashboardData.kpis?.forEach((kpi: any, index: number) => {
      widgets.push({
        id: `kpi_${index}_${Date.now()}`,
        type: 'metric',
        title: kpi.label,
        data: {
          value: kpi.value,
          label: kpi.label,
          change: kpi.change,
          trend: kpi.trend,
          unit: kpi.unit || '',
        },
      });
    });
    
    // Add pendencies widget if there are any
    if (dashboardData.pendencies?.length > 0) {
      widgets.push({
        id: `pendencies_${Date.now()}`,
        type: 'list',
        title: 'Pendências',
        data: {
          items: dashboardData.pendencies.map((p: any) => ({
            id: p.id,
            title: p.title,
            subtitle: p.description,
            status: p.priority,
          })),
        },
      });
    }
    
    // Add plan summary widget if plan exists
    if (plan?.steps?.length > 0) {
      widgets.push({
        id: `plan_${Date.now()}`,
        type: 'list',
        title: 'Plano de Ação',
        data: {
          items: plan.steps.slice(0, 5).map((step: any, index: number) => ({
            id: `step_${index}`,
            title: step.action,
            subtitle: step.justification,
          })),
        },
      });
    }
    
    return {
      id: `layout_${Date.now()}`,
      widgets,
      columns: Math.min(3, Math.ceil(widgets.length / 2)),
    };
  }

  /**
   * Evaluate results and learn
   */
  private async evaluateResults(
    plan: any,
    context: any,
    executedActions: any[]
  ): Promise<void> {
    try {
      const successRate = executedActions.length > 0
        ? executedActions.filter(a => a.success).length / executedActions.length
        : 1;
      
      // Store evaluation in memory
      await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
        type: 'plan_evaluation',
        category: 'autonomous_learning',
        data: {
          planId: plan.metadata?.generatedAt,
          successRate,
          actionsExecuted: executedActions.length,
          actionsSuccessful: executedActions.filter(a => a.success).length,
        },
        outcome: successRate > 0.7 ? 'success' : 'needs_improvement',
        success: successRate > 0.7,
      });
      
      // Adjust configuration based on performance
      if (this.config.learning.autoAdjust && successRate < 0.5) {
        this.adjustConfiguration();
      }
    } catch (err) {
      console.error('[AutonomousKPIAgent] Evaluation error:', err);
    }
  }

  /**
   * Adjust configuration based on performance
   */
  private adjustConfiguration(): void {
    console.log('[AutonomousKPIAgent] Adjusting configuration based on performance');
    
    // Reduce autonomy level if performance is poor
    const autonomyLevels: Array<AutonomousConfig['autonomyLevel']> = ['low', 'medium', 'high', 'full'];
    const currentIndex = autonomyLevels.indexOf(this.config.autonomyLevel);
    
    if (currentIndex > 0) {
      this.config.autonomyLevel = autonomyLevels[currentIndex - 1];
      console.log(`[AutonomousKPIAgent] Reduced autonomy level to ${this.config.autonomyLevel}`);
    }
    
    // Increase interval to reduce frequency
    this.config.interval = Math.min(this.config.interval * 1.5, 300000); // Max 5 minutes
    console.log(`[AutonomousKPIAgent] Increased interval to ${this.config.interval}ms`);
  }

  /**
   * Check and trigger alerts
   */
  private async checkAlerts(analysis: GapAnalysis[], context: any): Promise<void> {
    for (const gap of analysis) {
      const threshold = this.config.alerts.thresholds[gap.kpiKey];
      
      if (threshold && (threshold.min !== undefined && gap.currentValue < threshold.min ||
                        threshold.max !== undefined && gap.currentValue > threshold.max)) {
        
        // Check if alert should be sent based on role
        if (this.config.alerts.channels.length > 0) {
          console.log(`[AutonomousKPIAgent] Alert: ${gap.kpiLabel} is outside threshold`);
          
          await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
            type: 'alert_triggered',
            category: 'autonomous_alert',
            data: {
              kpiKey: gap.kpiKey,
              kpiLabel: gap.kpiLabel,
              currentValue: gap.currentValue,
              threshold,
            },
            outcome: 'alert_sent',
            success: true,
          });
        }
      }
    }
  }

  /**
   * Log decision
   */
  private logDecision(plan: any, context: any, analysis: GapAnalysis[]): void {
    const decision: DecisionLog = {
      timestamp: new Date().toISOString(),
      cycleId: this.currentCycleId || '',
      decision: plan.steps.length > 0 ? 'actions_planned' : 'no_action_needed',
      reasoning: plan.justification,
      confidence: plan.metadata?.confidence || 0,
      outcome: 'pending',
    };
    
    this.decisionLog.push(decision);
    
    // Keep only last 50 decisions
    if (this.decisionLog.length > 50) {
      this.decisionLog = this.decisionLog.slice(-50);
    }
    
    this.emit('decision', decision);
  }

  /**
   * Set agent status
   */
  private setStatus(newStatus: AgentStatus): void {
    this.status = newStatus;
  }

  /**
   * Emit event
   */
  private emit<K extends keyof AutonomousAgentEvents>(
    event: K,
    ...args: Parameters<AutonomousAgentEvents[K]>
  ): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      handlers.forEach(handler => {
        try {
          // TS não correlaciona `handler` (E[K]) com `args` (Parameters<E[K]>)
          // através do forEach — o cast preserva a chamada tipada em runtime.
          (handler as (...a: unknown[]) => void)(...args);
        } catch (err) {
          console.error(`[AutonomousKPIAgent] Error in event handler for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Register event handler
   */
  on<K extends keyof AutonomousAgentEvents>(event: K, handler: AutonomousAgentEvents[K]): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]!.push(handler);
  }

  /**
   * Remove event handler
   */
  off<K extends keyof AutonomousAgentEvents>(event: K, handler: AutonomousAgentEvents[K]): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get current layouts
   */
  getLayouts(): IADashboardLayout[] {
    return [...this.layouts];
  }

  /**
   * Get decision log
   */
  getDecisionLog(): DecisionLog[] {
    return [...this.decisionLog];
  }

  /**
   * Get cycle history
   */
  getCycleHistory(): CycleData[] {
    return [...this.cycleHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutonomousConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart interval if running
    if (this.isRunning && this.interval) {
      clearInterval(this.interval);
      this.interval = setInterval(async () => {
        await this.executeCycle();
      }, this.config.interval);
    }
    
    console.log('[AutonomousKPIAgent] Configuration updated');
  }

  /**
   * Manual override - execute specific action
   */
  async manualOverride(action: string, parameters: any): Promise<{ success: boolean; details: any }> {
    console.log(`[AutonomousKPIAgent] Manual override: ${action}`);
    
    try {
      const context = await this.contextManager.getContext(this.userId);
      
      // Store override interaction
      await this.contextManager.storeInteraction(this.userId, {
          timestamp: new Date().toISOString(),
        type: 'manual_override',
        category: 'autonomous_override',
        data: { action, parameters },
        outcome: 'executed',
        success: true,
      });
      
      return { success: true, details: { action, parameters } };
    } catch (err) {
      console.error('[AutonomousKPIAgent] Manual override error:', err);
      return { success: false, details: { error: err instanceof Error ? err.message : String(err) } };
    }
  }

  /**
   * Get agent info
   */
  getInfo(): {
    userId: string;
    sectorId: string;
    status: AgentStatus;
    isRunning: boolean;
    config: AutonomousConfig;
    layoutsCount: number;
    decisionsCount: number;
    cyclesCount: number;
  } {
    return {
      userId: this.userId,
      sectorId: this.sectorId,
      status: this.status,
      isRunning: this.isRunning,
      config: this.config,
      layoutsCount: this.layouts.length,
      decisionsCount: this.decisionLog.length,
      cyclesCount: this.cycleHistory.length,
    };
  }
}
