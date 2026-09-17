/**
 * Gerenciador de Configurações Globais do Sistema IA
 * Portal ABZ - Permissões, configurações de módulos e Microsoft Graph
 */
import { supabaseAdmin } from '@/lib/supabase';
import type { IAModuleConfig, IAWritePermissions, IARole } from '@/types/ia-global';

// Cache de configurações
const configCache: Map<string, unknown> = new Map();
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minuto

// Configurações padrão dos módulos
const DEFAULT_MODULE_CONFIGS: Record<string, Omit<IAModuleConfig, 'key'>> = {
  ferias: {
    name: 'Férias',
    description: 'Gestão de férias e licenças',
    icon: '🏖️',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE'],
    enabled: true,
  },
  reembolso: {
    name: 'Reembolso',
    description: 'Solicitações de reembolso de despesas',
    icon: '💰',
    allowRead: true,
    allowWrite: false,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  ponto: {
    name: 'Ponto',
    description: 'Registros de ponto eletrônico',
    icon: '🕐',
    allowRead: true,
    allowWrite: false,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  contracheque: {
    name: 'Contracheque',
    description: 'Folha de pagamento e holerites',
    icon: '📄',
    allowRead: true,
    allowWrite: false,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  academy: {
    name: 'Academy',
    description: 'Cursos e certificações corporativas',
    icon: '🎓',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE', 'USER'],
    enabled: true,
  },
  avaliacao: {
    name: 'Avaliação de Desempenho',
    description: 'Sistema de avaliação 360 graus',
    icon: '📊',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE'],
    enabled: true,
  },
  epi: {
    name: 'EPI',
    description: 'Equipamentos de Proteção Individual',
    icon: '🦺',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE'],
    enabled: true,
  },
  mio: {
    name: 'MIO',
    description: 'Integração com sistema MIO',
    icon: '⚓',
    allowRead: true,
    allowWrite: false,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  suprimentos: {
    name: 'Suprimentos',
    description: 'Compras e ordens de compra',
    icon: '🛒',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE'],
    enabled: true,
  },
  chat: {
    name: 'Chat Interno',
    description: 'Mensagens internas e Teams',
    icon: '💬',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE', 'USER'],
    enabled: true,
  },
  social: {
    name: 'Feed Social',
    description: 'Feed corporativo e notícias',
    icon: '📱',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE', 'USER'],
    enabled: true,
  },
  calendario: {
    name: 'Calendário',
    description: 'Eventos e calendário corporativa',
    icon: '📅',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE', 'USER'],
    enabled: true,
  },
  microsoft: {
    name: 'Microsoft 365',
    description: 'Integração com Microsoft Graph API',
    icon: '📧',
    allowRead: true,
    allowWrite: false,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  admin: {
    name: 'Administração',
    description: 'Funções administrativas do sistema',
    icon: '⚙️',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  feedback: {
    name: 'Feedback',
    description: 'Feedbacks e sugestões dos usuários',
    icon: '💬',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN'],
    enabled: true,
  },
  contratos: {
    name: 'Contratos',
    description: 'Gestão de documentos e assinaturas digitais',
    icon: '✍️',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE'],
    enabled: true,
  },
  'lista-presenca': {
    name: 'Lista de Presença',
    description: 'Controle de presença e assinaturas',
    icon: '📋',
    allowRead: true,
    allowWrite: true,
    writeRoles: ['ADMIN', 'GERENTE', 'USER'],
    enabled: true,
  },
};

/**
 * Busca configuração de um módulo específico
 */
export async function getModuleConfig(moduleKey: string): Promise<IAModuleConfig | null> {
  // Verificar cache primeiro
  const cached = configCache.get(`module_${moduleKey}`);
  if (cached) return cached as IAModuleConfig;

  try {
    const { data, error } = await supabaseAdmin
      .from('ia_module_permissions')
      .select('*')
      .eq('module_key', moduleKey)
      .single();

    if (error || !data) {
      // Retornar configuração padrão se não existir no banco
      const defaultConfig = DEFAULT_MODULE_CONFIGS[moduleKey];
      if (defaultConfig) {
        return { key: moduleKey, ...defaultConfig };
      }
      return null;
    }

    const config: IAModuleConfig = {
      key: data.module_key,
      allowRead: data.allow_read,
      allowWrite: data.allow_write,
      writeRoles: data.write_roles || [],
      name: DEFAULT_MODULE_CONFIGS[moduleKey]?.name || moduleKey,
      description: DEFAULT_MODULE_CONFIGS[moduleKey]?.description || '',
      icon: DEFAULT_MODULE_CONFIGS[moduleKey]?.icon,
      enabled: true,
    };

    configCache.set(`module_${moduleKey}`, config);
    return config;
  } catch (error) {
    console.error('[IA Config] Error fetching module config:', error);
    // Retornar padrão em caso de erro
    const defaultConfig = DEFAULT_MODULE_CONFIGS[moduleKey];
    if (defaultConfig) {
      return { key: moduleKey, ...defaultConfig };
    }
    return null;
  }
}

/**
 * Busca todas as configurações de módulos
 */
export async function getAllModuleConfigs(): Promise<IAModuleConfig[]> {
  const keys = Object.keys(DEFAULT_MODULE_CONFIGS);
  const configs: IAModuleConfig[] = [];

  for (const key of keys) {
    const config = await getModuleConfig(key);
    if (config) configs.push(config);
  }

  return configs;
}

/**
 * Atualiza configuração de um módulo
 */
export async function updateModuleConfig(
  moduleKey: string,
  updates: Partial<Pick<IAModuleConfig, 'allowRead' | 'allowWrite' | 'writeRoles' | 'enabled'>>
): Promise<boolean> {
  try {
    // Primeiro verifica se existe
    const { data: existing } = await supabaseAdmin
      .from('ia_module_permissions')
      .select('id')
      .eq('module_key', moduleKey)
      .single();

    if (existing) {
      // Update
      const { error } = await supabaseAdmin
        .from('ia_module_permissions')
        .update({
          allow_read: updates.allowRead,
          allow_write: updates.allowWrite,
          write_roles: updates.writeRoles,
          updated_at: new Date().toISOString(),
        })
        .eq('module_key', moduleKey);

      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabaseAdmin
        .from('ia_module_permissions')
        .insert({
          module_key: moduleKey,
          allow_read: updates.allowRead ?? true,
          allow_write: updates.allowWrite ?? false,
          write_roles: updates.writeRoles ?? [],
        });

      if (error) throw error;
    }

    // Invalidar cache
    configCache.delete(`module_${moduleKey}`);
    return true;
  } catch (error) {
    console.error('[IA Config] Error updating module config:', error);
    return false;
  }
}

/**
 * Verifica se um usuário pode executar ação de escrita em um módulo
 */
export async function canWriteToModule(
  userId: string,
  moduleKey: string,
  userRole: IARole
): Promise<boolean> {
  const config = await getModuleConfig(moduleKey);
  
  if (!config) return false;
  if (!config.enabled) return false;
  if (!config.allowWrite) return false;
  
  // Verificar se a role do usuário está na lista de roles permitidas
  return config.writeRoles.includes(userRole);
}

/**
 * Verifica se um usuário pode ler um módulo
 */
export async function canReadModule(
  userId: string,
  moduleKey: string
): Promise<boolean> {
  const config = await getModuleConfig(moduleKey);
  
  if (!config) return false;
  if (!config.enabled) return false;
  
  return config.allowRead;
}

/**
 * Busca configurações de permissões de escrita do Microsoft Graph
 */
export async function getMicrosoftWritePermissions(): Promise<IAWritePermissions['microsoft']> {
  const cached = configCache.get('microsoft_write');
  if (cached) return cached as IAWritePermissions['microsoft'];

  const defaults: IAWritePermissions['microsoft'] = {
    mail: false, calendar: false, contacts: false, users: false,
    groups: false, directory: false, teams: false, chat: false,
    calls: false, files: false, notes: false, tasks: false,
    security: false, audit: false, identity: false, applications: false,
    devices: false, compliance: false, bookings: false, notifications: false,
    synchronization: false, copilot: false, backup: false, network: false,
    management_apis: false,
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('ia_global_config')
      .select('config_value')
      .eq('config_key', 'microsoft_write')
      .single();

    if (error || !data) return defaults;

    const saved = data.config_value as Partial<IAWritePermissions['microsoft']>;
    const permissions = { ...defaults, ...saved };
    configCache.set('microsoft_write', permissions);
    return permissions;
  } catch {
    return defaults;
  }
}

/**
 * Atualiza permissões de escrita do Microsoft Graph
 */
export async function updateMicrosoftWritePermissions(
  permissions: IAWritePermissions['microsoft']
): Promise<boolean> {
  try {
    const { data: existing } = await supabaseAdmin
      .from('ia_global_config')
      .select('id')
      .eq('config_key', 'microsoft_write')
      .single();

    if (existing) {
      await supabaseAdmin
        .from('ia_global_config')
        .update({
          config_value: permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'microsoft_write');
    } else {
      await supabaseAdmin
        .from('ia_global_config')
        .insert({
          config_key: 'microsoft_write',
          config_value: permissions,
          description: 'Permissões de escrita para APIs Microsoft Graph',
        });
    }

    configCache.delete('microsoft_write');
    return true;
  } catch (error) {
    console.error('[IA Config] Error updating Microsoft permissions:', error);
    return false;
  }
}

/**
 * Busca todas as configurações globais
 */
export async function getGlobalConfig(key: string): Promise<unknown | null> {
  if (configCache.has(key)) {
    return configCache.get(key);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ia_global_config')
      .select('config_value')
      .eq('config_key', key)
      .single();

    if (error || !data) return null;

    configCache.set(key, data.config_value);
    return data.config_value;
  } catch {
    return null;
  }
}

/**
 * Atualiza configuração global
 */
export async function setGlobalConfig(
  key: string,
  value: unknown,
  description?: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabaseAdmin
      .from('ia_global_config')
      .select('id')
      .eq('config_key', key)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('ia_global_config')
        .update({
          config_value: value,
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', key);
    } else {
      await supabaseAdmin
        .from('ia_global_config')
        .insert({
          config_key: key,
          config_value: value,
          description,
        });
    }

    configCache.delete(key);
    return true;
  } catch (error) {
    console.error('[IA Config] Error setting global config:', error);
    return false;
  }
}

/**
 * Limpa todo o cache de configurações
 */
export function invalidateConfigCache(): void {
  configCache.clear();
  configCacheTime = 0;
}

/**
 * Inicializa as configurações no banco se não existirem
 */
export async function initializeConfigs(): Promise<void> {
  console.log('[IA Config] Initializing module configurations...');

  // Criar tabelas se não existirem (via Supabase)
  // As tabelas devem ser criadas via migration
  
  console.log('[IA Config] Configuration ready');
}

// Export default
export default {
  getModuleConfig,
  getAllModuleConfigs,
  updateModuleConfig,
  canWriteToModule,
  canReadModule,
  getMicrosoftWritePermissions,
  updateMicrosoftWritePermissions,
  getGlobalConfig,
  setGlobalConfig,
  invalidateConfigCache,
  initializeConfigs,
};