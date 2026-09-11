import { supabaseAdmin } from '@/lib/supabase';
import { checkAclPermission } from '@/lib/auth';
import { setorTemModuloGestaoTripulantes } from './aso-agendamento-logistica';

export function isMatrizGestorRole(role: string | undefined): boolean {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR' || r === 'SUPERADMIN' || r === 'MANAGER';
}

function normalizarNome(str: string | null | undefined): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica se o setor tem atribuição operacional/administrativa sobre
 * tripulação e treinamentos (DP, RH, Treinamento, Operações, SMS/QHSE, Gestão de Tripulantes)
 * e possui o módulo Gestão de Tripulantes liberado em allowed_modules.
 */
export function setorPermiteGestaoMatriz(
  sectorName: string | null | undefined,
  allowedModules: unknown,
): boolean {
  if (!setorTemModuloGestaoTripulantes(allowedModules)) return false;
  const n = normalizarNome(sectorName);
  if (!n) return false;

  // Setores típicos com responsabilidade sobre tripulação/treinamento
  if (
    n.includes('departamento pessoal') ||
    n.includes('depto pessoal') ||
    n.includes('dept pessoal') ||
    n.includes('recursos humanos') ||
    n.includes('treinamento') ||
    n.includes('capacitacao') ||
    n.includes('desenvolvimento humano') ||
    n.includes('dho') ||
    n.includes('operacoes') ||
    n.includes('operacao') ||
    n.includes('tripulacao') ||
    n.includes('crewing') ||
    n.includes('maritimo') ||
    n.includes('maritima') ||
    n.includes('sms') ||
    n.includes('qhse') ||
    n.includes('qsms') ||
    n.includes('seguranca') ||
    n.includes('gestao de tripulantes')
  ) {
    return true;
  }

  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes('dp') || tokens.includes('rh') || tokens.includes('gt') || tokens.includes('sms') || tokens.includes('qhse');
}

/**
 * Checa se o usuário pode gerenciar (criar, editar, excluir, importar) matrizes de treinamento:
 * 1. Role ADMIN/MANAGER/SUPERADMIN
 * 2. Feature JSONB: gestao-tripulantes.matrizes.manage ou gestao-tripulantes.admin
 * 3. ACL permissions: resource 'gestao-tripulantes' com action 'matrizes.manage', 'manage' ou 'admin'
 * 4. Setor: setor autorizado (DP, RH, Treinamento, Operações, SMS, etc.) com módulo gestao-tripulantes
 */
export async function podeGerenciarMatrizesTreinamento(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (isMatrizGestorRole(role)) return true;
  if (!userId) return false;

  // 1. Busca perfil do usuário (access_permissions e sector_id)
  const { data: user, error: userError } = await supabaseAdmin
    .from('users_unified')
    .select('id, role, sector_id, access_permissions')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) return false;

  const userRole = (user.role || role || '').toUpperCase();
  if (isMatrizGestorRole(userRole)) return true;

  // 2. Feature JSONB granular
  const features = (user.access_permissions as any)?.features || {};
  if (
    features['gestao-tripulantes.matrizes.manage'] === true ||
    features['gestao-tripulantes.admin'] === true ||
    features['gestao-tripulantes.manage'] === true
  ) {
    return true;
  }

  // 3. Permissão por ACL (acl_permissions / user_acl_permissions / role_acl_permissions)
  const hasAclManage =
    (await checkAclPermission(userId, userRole, 'gestao-tripulantes', 'matrizes.manage')) ||
    (await checkAclPermission(userId, userRole, 'gestao-tripulantes', 'manage')) ||
    (await checkAclPermission(userId, userRole, 'gestao-tripulantes', 'admin'));

  if (hasAclManage) return true;

  // 4. Permissão por Setor
  if (user.sector_id) {
    const { data: sector, error: sectorError } = await supabaseAdmin
      .from('sectors')
      .select('name, allowed_modules')
      .eq('id', user.sector_id)
      .maybeSingle();

    if (!sectorError && sector) {
      if (setorPermiteGestaoMatriz(sector.name, sector.allowed_modules)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checa se o usuário pode ao menos visualizar as matrizes de treinamento.
 */
export async function podeVisualizarMatrizesTreinamento(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (await podeGerenciarMatrizesTreinamento(userId, role)) return true;
  if (!userId) return false;

  const userRole = (role || '').toUpperCase();
  const hasAclView =
    (await checkAclPermission(userId, userRole, 'gestao-tripulantes', 'matrizes.view')) ||
    (await checkAclPermission(userId, userRole, 'gestao-tripulantes', 'view'));

  return hasAclView;
}
