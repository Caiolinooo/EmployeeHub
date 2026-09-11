/**
 * Registry Central de Ferramentas do Sistema IA
 * Portal ABZ - Todas as ferramentas disponíveis para o agente
 */
import type { IATool, IAToolContext, IAToolResult, IARole } from '@/types/ia-global';
import { canAccessModule } from '../permissions';

/**
 * Registry central de todas as ferramentas
 * Nova ferramentas devem ser adicionadas aqui
 */
const toolsRegistry = new Map<string, IATool>();

/**
 * Registra uma nova ferramenta no sistema
 */
export function registerTool(tool: IATool): void {
  toolsRegistry.set(tool.name, tool);
  console.log(`[IA Tools Registry] Registered: ${tool.name} (module: ${tool.module})`);
}

/**
 * Remove uma ferramenta do registry
 */
export function unregisterTool(toolName: string): boolean {
  return toolsRegistry.delete(toolName);
}

/**
 * Retorna todas as ferramentas registradas
 */
export function getAllTools(): IATool[] {
  return Array.from(toolsRegistry.values());
}

/**
 * Retorna uma ferramenta específica pelo nome
 */
export function getTool(toolName: string): IATool | undefined {
  return toolsRegistry.get(toolName);
}

/**
 * Retorna ferramentas por módulo
 */
export function getToolsByModule(module: string): IATool[] {
  return Array.from(toolsRegistry.values()).filter(t => t.module === module);
}

/**
 * Retorna ferramentas disponíveis para um usuário específico
 * Considera role, permissões de módulo e Team (para gerentes)
 */
export async function getAvailableToolsForUser(
  userId: string,
  role: IARole,
  teamMemberIds?: string[]
): Promise<IATool[]> {
  const allTools = Array.from(toolsRegistry.values());
  const availableTools: IATool[] = [];

  for (const tool of allTools) {
    // Verificar se é admin-only
    if (tool.adminOnly && role !== 'ADMIN') {
      continue;
    }

    // Verificar se requer módulo específico
    if (tool.requireModule) {
      const hasModuleAccess = await canAccessModule(userId, tool.requireModule);
      if (!hasModuleAccess) {
        continue;
      }
    }

    // Tool disponível para este usuário
    availableTools.push(tool);
  }

  return availableTools;
}

/**
 * Converte ferramentas para formato OpenAI/LM Studio
 */
export function getToolsForLLM(
  userId: string,
  role: IARole,
  teamMemberIds?: string[]
): Promise<Array<{ type: string; function: { name: string; description: string; parameters: unknown } }>> {
  return getAvailableToolsForUser(userId, role, teamMemberIds).then(tools => {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.definition.parameters,
      },
    }));
  });
}

/**
 * Executa uma ferramenta específica
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: IAToolContext
): Promise<IAToolResult> {
  const tool = toolsRegistry.get(toolName);
  
  if (!tool) {
    return {
      success: false,
      error: `Ferramenta não encontrada: ${toolName}`,
    };
  }

  // Verificar permissão de admin
  if (tool.adminOnly && context.userRole !== 'ADMIN') {
    return {
      success: false,
      error: 'Acesso restrito a administradores',
    };
  }

  // Verificar acesso ao módulo
  if (tool.requireModule) {
    const hasModuleAccess = await canAccessModule(context.userId, tool.requireModule);
    if (!hasModuleAccess) {
      return {
        success: false,
        error: `Acesso ao módulo '${tool.requireModule}' não autorizado`,
      };
    }
  }

  try {
    return await tool.handler(args, context);
  } catch (error) {
    console.error(`[IA Tools] Error executing ${toolName}:`, error);
    return {
      success: false,
      error: `Erro ao executar ferramenta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

/**
 * Lista todos os módulos com ferramentas disponíveis
 */
export function getRegisteredModules(): string[] {
  const modules = new Set<string>();
  for (const tool of toolsRegistry.values()) {
    modules.add(tool.module);
  }
  return Array.from(modules);
}

/**
 * Verifica se uma ferramenta existe
 */
export function hasTool(toolName: string): boolean {
  return toolsRegistry.has(toolName);
}

let toolsInitialized = false;

/**
 * Inicializa todas as ferramentas do sistema
 * Called on app startup
 */
export async function initializeTools(): Promise<void> {
  if (toolsInitialized) return;
  toolsInitialized = true;

  console.log('[IA Tools Registry] Initializing tools...');
  
  // Importar e registrar todas as ferramentas
  const toolModules = [
    await import('./definitions/ferias.tools'),
    await import('./definitions/reembolso.tools'),
    await import('./definitions/ponto.tools'),
    await import('./definitions/contracheque.tools'),
    await import('./definitions/academy.tools'),
    await import('./definitions/avaliacao.tools'),
    await import('./definitions/epi.tools'),
    await import('./definitions/mio.tools'),
    await import('./definitions/suprimentos.tools'),
    await import('./definitions/chat.tools'),
    await import('./definitions/social.tools'),
    await import('./definitions/calendario.tools'),
    await import('./definitions/news.tools'),
    await import('./definitions/admin.tools'),
    await import('./definitions/microsoft.tools'),
    await import('./definitions/feedback.tools'),
    await import('./definitions/portal.tools'),
  ];

  for (const module of toolModules) {
    if (module.registerTools) {
      await module.registerTools();
    }
  }

  console.log(`[IA Tools Registry] Initialized ${toolsRegistry.size} tools`);
}

// Export registry for external access
export const registry = toolsRegistry;