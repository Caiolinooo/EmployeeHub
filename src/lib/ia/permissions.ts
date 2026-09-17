/**
 * Controle de acesso hierárquico para o sistema IA
 * 
 * Hierarquia:
 * - ADMIN: acesso a todos os dados de todos os usuários
 * - GERENTE: acesso aos dados da equipe (via avaliacao_colaborador_gerente)
 * - USER: acesso apenas aos próprios dados
 */
import { supabaseAdmin } from '@/lib/supabase';
import type { IAUserRole } from '@/types/ia';

/**
 * Determinar o role efetivo do usuário para o sistema IA
 * GERENTE é inferido pela existência de subordinados em avaliacao_colaborador_gerente
 */
export async function getEffectiveRole(userId: string, baseRole: string): Promise<IAUserRole> {
  if (baseRole === 'ADMIN') return 'ADMIN';

  // Verificar se o usuário é gerente de alguém
  try {
    const { data, error } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .select('colaborador_id')
      .eq('gerente_id', userId)
      .limit(1);

    if (!error && data && data.length > 0) {
      return 'GERENTE';
    }
  } catch {
    // Se a tabela não existir, ignorar
  }

  return 'USER';
}

/**
 * Obter IDs dos subordinados de um gerente
 */
export async function getTeamMemberIds(managerId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .select('colaborador_id')
      .eq('gerente_id', managerId);

    if (error || !data) return [];
    return data.map((r: { colaborador_id: string }) => r.colaborador_id);
  } catch {
    return [];
  }
}

/**
 * Verificar se um usuário pode acessar dados de outro usuário
 */
export async function canAccessUserData(
  requesterId: string,
  requesterRole: IAUserRole,
  targetUserId: string
): Promise<boolean> {
  // Pode acessar seus próprios dados
  if (requesterId === targetUserId) return true;

  // Admin pode acessar tudo
  if (requesterRole === 'ADMIN') return true;

  // Gerente pode acessar dados da equipe
  if (requesterRole === 'GERENTE') {
    const teamIds = await getTeamMemberIds(requesterId);
    return teamIds.includes(targetUserId);
  }

  return false;
}

/**
 * Resolver ID do usuário por identificador (email, nome, CPF)
 * @param identifier - Email, nome completo/parcial, ou CPF
 * @returns UUID do usuário ou null se não encontrado
 */
export async function resolveUserIdByIdentifier(identifier: string): Promise<string | null> {
  if (!identifier || identifier === 'meu' || identifier === 'minhas') {
    return null;
  }

  const cleanIdentifier = identifier.trim();

  // Verificar se é email
  if (cleanIdentifier.includes('@')) {
    const { data: byEmail } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('email', cleanIdentifier.toLowerCase())
      .maybeSingle();
    if (byEmail) return byEmail.id;
  }

  // Verificar se é CPF (só números, 11 dígitos)
  const cpfClean = cleanIdentifier.replace(/\D/g, '');
  if (cpfClean.length === 11) {
    const { data: byCpf } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('cpf', cpfClean)
      .maybeSingle();
    if (byCpf) return byCpf.id;
  }

  // Buscar por nome (first_name + last_name)
  const tokens = cleanIdentifier.split(/\s+/);
  if (tokens.length >= 2) {
    const t1 = tokens[0];
    const t2 = tokens.slice(1).join(' ');
    const { data: byName } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .or(`and(first_name.ilike.${t1},last_name.ilike.${t2}),and(first_name.ilike.${t2},last_name.ilike.${t1})`)
      .limit(1)
      .maybeSingle();
    if (byName) return byName.id;
  }

  // Fallback: busca em qualquer campo
  const { data: byAny } = await supabaseAdmin
    .from('users_unified')
    .select('id')
    .or(`first_name.ilike.%${cleanIdentifier}%,last_name.ilike.%${cleanIdentifier}%,email.ilike.%${cleanIdentifier}%`)
    .limit(1)
    .maybeSingle();
  
  return byAny?.id || null;
}

/**
 * Obter IDs de usuários que o solicitante pode ver
 * Retorna null para ADMIN (sem filtro), array de IDs para outros
 */
export async function getAccessibleUserIds(
  userId: string,
  role: IAUserRole
): Promise<string[] | null> {
  if (role === 'ADMIN') return null; // Sem restrição

  if (role === 'GERENTE') {
    const teamIds = await getTeamMemberIds(userId);
    return [userId, ...teamIds]; // Inclui o próprio gerente
  }

  return [userId]; // USER: apenas ele mesmo
}

/**
 * Construir filtro SQL/Supabase para queries baseadas em permissão
 */
export function buildUserFilter(
  accessibleIds: string[] | null
): { column: string; values: string[] } | null {
  if (accessibleIds === null) return null; // ADMIN: sem filtro
  return { column: 'user_id', values: accessibleIds };
}

/**
 * Aplica filtro de acesso global conforme role do usuário
 * ADMIN: sem filtro (retorna null)
 * GERENTE: filtra por usuários da equipe
 * USER: retorna erro (não tem acesso a dados globais)
 */
/**
 * Aplica filtro de acesso global conforme role do usuário
 * ADMIN: sem filtro (retorna null)
 * GERENTE: filtra por usuários da equipe
 * USER: retorna erro (não tem acesso a dados globais)
 */
export async function applyGlobalAccessFilter(
  queryBuilder: any,
  userId: string,
  role: IAUserRole,
  userIdColumnName: string = 'user_id'
): Promise<{ query: any; hasAccess: boolean; error?: string }> {
  const access = await getAccessibleUserIdsForGlobal(userId, role);
  
  if (!access.hasAccess) {
    return { query: null, hasAccess: false, error: access.error };
  }

  if (access.ids) {
    return { query: queryBuilder.in(userIdColumnName, access.ids), hasAccess: true };
  }

  return { query: queryBuilder, hasAccess: true };
}

/**
 * Versão síncrona de applyGlobalAccessFilter para uso imediato
 * Retorna apenas os IDs permitidos
 */
export async function getAccessibleUserIdsForGlobal(
  userId: string,
  role: IAUserRole
): Promise<{ ids: string[] | null; hasAccess: boolean; error?: string }> {
  if (role === 'ADMIN') {
    return { ids: null, hasAccess: true };
  }

  if (role === 'GERENTE') {
    const teamIds = await getTeamMemberIds(userId);
    return { ids: [...teamIds, userId], hasAccess: true };
  }

  return { ids: null, hasAccess: false, error: 'Acesso negado. Você não tem permissão para acessar dados globais.' };
}

/**
  * Verifica se um usuário tem acesso a um módulo específico no painel
  * Integrado com o sistema de permissões do portal (RBAC / Módulos)
  * Verifica tanto sys_modules quanto user_permissions.access_permissions
  */
export async function canAccessModule(userId: string, moduleName: string): Promise<boolean> {
  try {
    // Buscar dados do usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', userId)
      .single();

    if (userError || !user) return false;

    // Admin tem acesso a tudo
    if (user.role === 'ADMIN') return true;

    // Verificar access_permissions do usuário
    const accessPermissions = user.access_permissions as { modules?: Record<string, boolean> };
    if (accessPermissions?.modules && accessPermissions.modules[moduleName] === true) {
      return true;
    }

    // Verificar sys_modules permissions (fallback)
    try {
      const { data: moduleData, error: moduleError } = await supabaseAdmin
        .from('sys_modules')
        .select('permissions')
        .eq('key', moduleName)
        .single();

      if (!moduleError && moduleData?.permissions) {
        const userRole = user.role?.toLowerCase() || 'user';
        const allowedRoles = moduleData.permissions.read || [];
        if (allowedRoles.includes(userRole) || allowedRoles.includes('*')) {
          return true;
        }
      }
    } catch {
      // sys_modules não existe ou erro de query, ignorar
    }

    // Verificar SYSTEM_MODULES default roles
    try {
      const { SYSTEM_MODULES } = await import('@/config/modules');
      const moduleDef = SYSTEM_MODULES.find(m => m.key === moduleName);
      if (moduleDef && moduleDef.defaultRoles.includes(user.role as 'ADMIN' | 'MANAGER' | 'USER')) {
        return true;
      }
    } catch {
      // Ignorar erro de import
    }

    return false;
  } catch {
    return false;
  }
}
