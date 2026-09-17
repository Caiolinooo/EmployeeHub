/**
 * Registry de Ações Interativas do Sistema IA
 * Portal ABZ - Ações que o agente pode executar (aprovar, reprovar, criar, etc)
 */
import type { 
  IAAction, 
  IAActionContext, 
  IAActionResult, 
  IAActionData,
  IAActionButton,
  IARole 
} from '@/types/ia-global';
import { canAccessModule } from '../permissions';

/**
 * Registry central de todas as ações
 */
const actionsRegistry = new Map<string, IAAction>();

/**
 * Registra uma nova ação no sistema
 */
export function registerAction(action: IAAction): void {
  actionsRegistry.set(action.id, action);
  console.log(`[IA Actions Registry] Registered: ${action.name} (module: ${action.module})`);
}

/**
 * Remove uma ação do registry
 */
export function unregisterAction(actionId: string): boolean {
  return actionsRegistry.delete(actionId);
}

/**
 * Retorna todas as ações registradas
 */
export function getAllActions(): IAAction[] {
  return Array.from(actionsRegistry.values());
}

/**
 * Retorna uma ação específica pelo ID
 */
export function getAction(actionId: string): IAAction | undefined {
  return actionsRegistry.get(actionId);
}

/**
 * Retorna uma ação pelo nome
 */
export function getActionByName(name: string): IAAction | undefined {
  return Array.from(actionsRegistry.values()).find(a => a.name === name);
}

/**
 * Retorna ações por módulo
 */
export function getActionsByModule(module: string): IAAction[] {
  return Array.from(actionsRegistry.values()).filter(a => a.module === module);
}

/**
 * Retorna ações disponíveis para um usuário específico
 * Considera role e permissões
 */
export async function getAvailableActionsForUser(
  userId: string,
  role: IARole,
  teamMemberIds?: string[]
): Promise<IAAction[]> {
  const allActions = Array.from(actionsRegistry.values());
  const availableActions: IAAction[] = [];

  for (const action of allActions) {
    // Verificar se a role do usuário tem permissão
    if (!action.requiresRole.includes(role)) {
      continue;
    }

    // Verificar se requer módulo específico
    if (action.requiresPermission) {
      const moduleName = action.requiresPermission.replace(':write', '');
      const hasModuleAccess = await canAccessModule(userId, moduleName);
      if (!hasModuleAccess) {
        continue;
      }
    }

    availableActions.push(action);
  }

  return availableActions;
}

/**
 * Executa uma ação específica
 */
export async function executeAction(
  actionId: string,
  params: Record<string, unknown>,
  context: IAActionContext
): Promise<IAActionResult> {
  const action = actionsRegistry.get(actionId);
  
  if (!action) {
    return {
      success: false,
      message: `Ação não encontrada: ${actionId}`,
    };
  }

  // Verificar role
  if (!action.requiresRole.includes(context.userRole)) {
    return {
      success: false,
      message: `Sua função (${context.userRole}) não tem permissão para executar esta ação`,
    };
  }

  // Verificar permissão de módulo
  if (action.requiresPermission) {
    const moduleName = action.requiresPermission.replace(':write', '');
    const hasModuleAccess = await canAccessModule(context.userId, moduleName);
    if (!hasModuleAccess) {
      return {
        success: false,
        message: `Acesso ao módulo '${moduleName}' não autorizado`,
      };
    }
  }

  // Verificar se o usuário pode executar a ação no target (ex: gerente aprovando funcionário)
  if (action.requiresTargetVerification && context.targetUserId) {
    // Se for gerente, só pode executar em sua equipe
    if (context.userRole === 'GERENTE') {
      if (!context.teamMemberIds?.includes(context.targetUserId)) {
        return {
          success: false,
          message: 'Você só pode executar esta ação em membros da sua equipe',
        };
      }
    }
    // Se for usuário comum, só pode executar em si mesmo
    if (context.userRole === 'USER' && context.targetUserId !== context.userId) {
      return {
        success: false,
        message: 'Você só pode executar esta ação em seus próprios dados',
      };
    }
  }

  try {
    return await action.execute(params, context);
  } catch (error) {
    console.error(`[IA Actions] Error executing ${action.name}:`, error);
    return {
      success: false,
      message: `Erro ao executar ação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

/**
 * Gera dados de ação interativa para o frontend
 * Usado para criar cards com botões de ação
 */
export function generateActionData(
  actionId: string,
  data: Record<string, unknown>,
  context: IAActionContext
): IAActionData | null {
  const action = actionsRegistry.get(actionId);
  
  if (!action) {
    return null;
  }

  // Verificar se o usuário pode executar
  const canExecute = action.requiresRole.includes(context.userRole);

  // Gerar botões de ação
  const actions: IAActionButton[] = [];

  if (canExecute) {
    actions.push({
      id: `execute_${action.id}`,
      label: action.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      action: action.id,
      params: data,
      variant: 'primary',
      icon: '⚡',
    });
  }

  // Adicionar botão de detalhes se aplicável
  actions.push({
    id: `details_${action.id}`,
    label: 'Ver Detalhes',
    action: 'view_details',
    params: { module: action.module, ...data },
    variant: 'secondary',
    icon: '🔍',
  });

  return {
    actionId: action.id,
    actionName: action.name,
    module: action.module,
    title: `${action.label}`,
    data,
    actions,
    permissions: {
      canExecute,
      reason: canExecute ? undefined : 'Você não tem permissão para executar esta ação',
    },
  };
}

/**
 * Lista todos os módulos com ações disponíveis
 */
export function getRegisteredActionModules(): string[] {
  const modules = new Set<string>();
  for (const action of actionsRegistry.values()) {
    modules.add(action.module);
  }
  return Array.from(modules);
}

/**
 * Verifica se uma ação existe
 */
export function hasAction(actionId: string): boolean {
  return actionsRegistry.has(actionId);
}

/**
 * Inicializa todas as ações do sistema
 * Called on app startup
 */
export async function initializeActions(): Promise<void> {
  console.log('[IA Actions Registry] Initializing actions...');
  
  // Importar e registrar todas as ações
  const actionModules = [
    await import('./definitions/ferias.actions'),
    await import('./definitions/reembolso.actions'),
    await import('./definitions/suprimentos.actions'),
    await import('./definitions/avaliacao.actions'),
    await import('./definitions/chat.actions'),
    await import('./definitions/calendario.actions'),
    await import('./definitions/microsoft.actions'),
  ];

  for (const moduleDef of actionModules) {
    if (moduleDef.registerActions) {
      await moduleDef.registerActions();
    }
  }

  console.log(`[IA Actions Registry] Initialized ${actionsRegistry.size} actions`);
}

// Export registry for external access
export const actionRegistry = actionsRegistry;