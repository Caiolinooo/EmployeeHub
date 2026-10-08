import { supabaseAdmin } from '@/lib/db';
import {
  aclNamesWithinModules,
  composeEffectiveModules,
  mergeEffectiveFeatures,
  type AclGrantSource,
} from '@/lib/effective-feature';

export interface EffectivePermissionsSnapshot {
  userId: string;
  role: string;
  sectorId: string | null;
  modules: Record<string, boolean>;
  features: Record<string, boolean>;
  aclNames: string[];
  /** Nomes ACL revogados no usuário (`user_acl_permissions.granted = false`). */
  aclDeniedNames?: string[];
  cards: string[];
  sectorModulesRaw: string[];
  /** `access_permissions.modules` as stored (explicit true/false per module). */
  explicitModules: Record<string, boolean | undefined>;
  aclModulesApplied: string[];
  hasUserOverride: boolean;
}

type UserPermissionsJson = {
  modules?: Record<string, boolean | undefined>;
  features?: Record<string, boolean | undefined>;
} | null;

/** Single server-side source of truth for sidebar (`/api/user/effective-permissions`) and route gates. */
export async function loadEffectivePermissions(
  userId: string,
): Promise<EffectivePermissionsSnapshot | null> {
  const { data: profile } = await supabaseAdmin
    .from('users_unified')
    .select('id, role, sector_id, access_permissions')
    .eq('id', userId)
    .single();
  if (!profile) return null;

  let sectorModulesRaw: string[] = [];
  let cards: string[] = [];
  if (profile.sector_id) {
    const { data: sector } = await supabaseAdmin
      .from('sectors')
      .select('allowed_modules, allowed_cards')
      .eq('id', profile.sector_id)
      .single();
    sectorModulesRaw = sector?.allowed_modules || [];
    cards = sector?.allowed_cards || [];
  }

  type AclRow = { id: string; resource: string; name: string; action: string };
  let grantedPerms: Array<AclRow & { source: AclGrantSource }> = [];
  let deniedPerms: AclRow[] = [];
  try {
    const role = String(profile.role || 'USER').toUpperCase();
    const [userAcl, roleAcl] = await Promise.all([
      supabaseAdmin
        .from('user_acl_permissions')
        .select('permission_id, granted')
        .eq('user_id', userId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      supabaseAdmin.from('role_acl_permissions').select('permission_id').eq('role', role),
    ]);
    if (userAcl.error) throw userAcl.error;
    const userRows = userAcl.data || [];
    const deniedIds = new Set(userRows.filter((row) => row.granted === false).map((row) => row.permission_id));
    const userIds = new Set(userRows.filter((row) => row.granted !== false).map((row) => row.permission_id));
    const roleIds = new Set(
      (roleAcl.data || []).map((row) => row.permission_id).filter((id) => !deniedIds.has(id)),
    );
    const ids = [...new Set([...userIds, ...roleIds, ...deniedIds])];
    if (ids.length > 0) {
      const { data: perms } = await supabaseAdmin
        .from('acl_permissions')
        .select('id, resource, name, action')
        .in('id', ids)
        .eq('enabled', true);
      for (const perm of (perms || []) as AclRow[]) {
        if (deniedIds.has(perm.id)) deniedPerms.push(perm);
        else grantedPerms.push({ ...perm, source: userIds.has(perm.id) ? 'user' : 'role' });
      }
    }
  } catch (aclError) {
    console.warn('[effective-permissions] ACL tables not available, skipping ACL layer:', aclError);
    grantedPerms = [];
    deniedPerms = [];
  }

  const userPermissions = profile.access_permissions as UserPermissionsJson;
  const { modules, aclModulesApplied } = composeEffectiveModules({
    role: profile.role,
    hasSector: !!profile.sector_id,
    sectorModules: sectorModulesRaw,
    userModules: userPermissions?.modules,
    aclGrants: grantedPerms,
    aclDenied: deniedPerms,
  });
  const aclNames = aclNamesWithinModules(grantedPerms, modules).filter(
    (name) => userPermissions?.features?.[name] !== false,
  );

  return {
    userId,
    role: String(profile.role || 'USER'),
    sectorId: profile.sector_id || null,
    modules,
    features: mergeEffectiveFeatures(userPermissions?.features, aclNames),
    aclNames,
    aclDeniedNames: deniedPerms.map((perm) => perm.name),
    cards,
    sectorModulesRaw,
    explicitModules: userPermissions?.modules || {},
    aclModulesApplied,
    hasUserOverride: !!userPermissions,
  };
}

/** Explicit grant only (JSONB feature or ACL name, revogações já aplicadas). Role bypass stays with the caller. */
export async function userHasGrant(userId: string, featureKeys: readonly string[]): Promise<boolean> {
  if (!userId) return false;
  const snapshot = await loadEffectivePermissions(userId);
  if (!snapshot) return false;
  return featureKeys.some((key) => snapshot.features[key] === true);
}

/** Module enabled for the user (explicit flag, sector, role default or ACL), same as the sidebar. */
export async function userHasModule(userId: string, moduleKey: string): Promise<boolean> {
  if (!userId) return false;
  const snapshot = await loadEffectivePermissions(userId);
  return snapshot?.modules[moduleKey] === true;
}
