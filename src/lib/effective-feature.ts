import { getFullPermissionsForRole, resolveModuleKey, SYSTEM_MODULES } from '@/config/modules';

export type EffectiveFeatureInput = {
  role?: string | null;
  features?: Record<string, boolean | undefined> | null;
  aclNames?: readonly string[] | null;
};

/** ACL names that also grant a catalog feature (mirrors documento-permissions manage/admin). */
const FEATURE_IMPLIED_BY_ACL: Record<string, readonly string[]> = {
  'gestao-tripulantes.cadastro.manage': [
    'gestao-tripulantes.cadastro.manage',
    'gestao-tripulantes.manage',
    'gestao-tripulantes.admin',
    'dp.manage',
    'dp.admin',
  ],
  // Feature keys whose ACL counterpart has a different resource name.
  'esocial.view': ['e-social.view', 'e-social.admin'],
  'esocial.prepare': ['e-social.prepare', 'e-social.admin'],
  'esocial.review': ['e-social.review', 'e-social.admin'],
  'esocial.send': ['e-social.send', 'e-social.admin'],
  'esocial.admin': ['e-social.admin'],
  'contracts.manage': ['contratos.manage'],
  'contracts.sign': ['contratos.sign'],
  reimbursement_approval: ['reimbursement.approve', 'reimbursement.manage'],
  reimbursement_edit: ['reimbursement.manage'],
  'gestao-tripulantes.documents.edit': [
    'gestao-tripulantes.documents.edit',
    'gestao-tripulantes.manage',
    'gestao-tripulantes.admin',
  ],
  'gestao-tripulantes.documents.delete': [
    'gestao-tripulantes.documents.delete',
    'gestao-tripulantes.manage',
    'gestao-tripulantes.admin',
  ],
  'gestao-tripulantes.matrizes.view': [
    'gestao-tripulantes.matrizes.view',
    'gestao-tripulantes.matrizes.manage',
    'gestao-tripulantes.manage',
    'gestao-tripulantes.admin',
  ],
  'gestao-tripulantes.matrizes.manage': [
    'gestao-tripulantes.matrizes.manage',
    'gestao-tripulantes.manage',
    'gestao-tripulantes.admin',
  ],
};

export function normalizeRole(role: string | null | undefined): string {
  return String(role || '').toUpperCase();
}

export function roleBypassesFeature(role: string | null | undefined, featureKey: string): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'ADMIN' || normalized === 'SUPERADMIN') return true;
  if (normalized === 'MANAGER' && !featureKey.startsWith('admin.')) return true;
  return false;
}

/** `staff` = ADMIN/MANAGER/SUPERADMIN passam; `admin` = só ADMIN/SUPERADMIN; `none` = só grant. */
export type GateBypass = 'staff' | 'admin' | 'none';

export function roleBypassesGate(role: string | null | undefined, bypass: GateBypass): boolean {
  const normalized = normalizeRole(role);
  if (bypass === 'none') return false;
  if (normalized === 'ADMIN' || normalized === 'SUPERADMIN') return true;
  return bypass === 'staff' && normalized === 'MANAGER';
}

export function featureGrantedByJsonb(
  features: Record<string, boolean | undefined> | null | undefined,
  featureKey: string,
): boolean {
  return features?.[featureKey] === true;
}

export function featureGrantedByAcl(
  aclNames: readonly string[] | null | undefined,
  featureKey: string,
): boolean {
  if (!aclNames?.length) return false;
  const granted = new Set(aclNames);
  if (granted.has(featureKey)) return true;
  const impliedBy = FEATURE_IMPLIED_BY_ACL[featureKey];
  if (!impliedBy) return false;
  return impliedBy.some((name) => granted.has(name));
}

/** Role bypass → `false` explícito no JSONB (revogação) → JSONB true → nome ACL. */
export function hasEffectiveFeature(input: EffectiveFeatureInput, featureKey: string): boolean {
  if (roleBypassesFeature(input.role, featureKey)) return true;
  if (input.features?.[featureKey] === false) return false;
  if (featureGrantedByJsonb(input.features, featureKey)) return true;
  return featureGrantedByAcl(input.aclNames, featureKey);
}

/** `aclNames` já chegam sem as revogações ACL; `false` no JSONB remove a key mesmo se a ACL a der. */
export function mergeEffectiveFeatures(
  jsonb: Record<string, boolean | undefined> | null | undefined,
  aclNames: readonly string[] | null | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (jsonb) {
    for (const [key, value] of Object.entries(jsonb)) {
      if (value === true) out[key] = true;
    }
  }
  if (aclNames) {
    for (const name of aclNames) {
      if (name) out[name] = true;
    }
  }
  for (const featureKey of Object.keys(FEATURE_IMPLIED_BY_ACL)) {
    if (featureGrantedByAcl(aclNames, featureKey)) {
      out[featureKey] = true;
    }
  }
  if (jsonb) {
    for (const [key, value] of Object.entries(jsonb)) {
      if (value === false) delete out[key];
    }
  }
  return out;
}

/** `user` = `user_acl_permissions` (granted); `role` = `role_acl_permissions`. */
export type AclGrantSource = 'user' | 'role';

export type AclGrant = { resource: string; action: string; source?: AclGrantSource };

/** Setor estrito só restringe o que o setor consegue listar: módulos do catálogo. */
const CATALOG_MODULE_KEYS = new Set(SYSTEM_MODULES.map((mod) => mod.key));

/** Revogar a ACL de acesso de um recurso (`<recurso>.view|read|access`) revoga o módulo. */
const MODULE_ACCESS_ACTIONS = new Set(['view', 'read', 'access']);

export type EffectiveModulesInput = {
  role?: string | null;
  hasSector: boolean;
  sectorModules: readonly string[];
  /** `access_permissions.modules`: true = grant do usuário, false = revogação do usuário. */
  userModules?: Record<string, boolean | undefined> | null;
  /** ACL ativas, já sem as revogadas. Sem `source` conta como grant do usuário. */
  aclGrants: ReadonlyArray<AclGrant>;
  /** `user_acl_permissions.granted = false`. */
  aclDenied?: ReadonlyArray<{ resource: string; action: string }>;
};

/**
 * Precedência por módulo, da mais forte para a mais fraca:
 *   1. revogação do usuário (`modules[k] === false` ou ACL de acesso com `granted = false`)
 *   2. grant do usuário (`modules[k] === true` ou `user_acl_permissions`)
 *   3. papel/setor: ADMIN = tudo; MANAGER = setor ∪ defaults do papel ∪ ACL do papel;
 *      USER com setor = só o setor (+ dashboard; setor estrito, ACL do papel não abre módulo do catálogo);
 *      USER sem setor = defaults do papel ∪ ACL do papel.
 * Alimenta a sidebar (`/api/user/effective-permissions`) e os gates de rota.
 */
export function composeEffectiveModules(input: EffectiveModulesInput): {
  modules: Record<string, boolean>;
  aclModulesApplied: string[];
} {
  const role = normalizeRole(input.role) || 'USER';
  const sector = new Set(input.sectorModules.map(resolveModuleKey));
  const roleDefaults = getFullPermissionsForRole(role);
  const strictSector = role === 'USER' && input.hasSector;

  const modules: Record<string, boolean> = {};
  if (strictSector) {
    for (const key of sector) modules[key] = true;
    modules.dashboard = true;
  } else {
    for (const [key, enabled] of Object.entries(roleDefaults)) {
      modules[key] = role === 'USER' ? enabled : enabled || sector.has(key);
    }
    for (const key of sector) if (role !== 'USER') modules[key] = true;
    if (role === 'ADMIN') modules.ferias_admin = true;
  }

  const aclModulesApplied: string[] = [];
  const enable = (key: string) => {
    if (modules[key]) return;
    modules[key] = true;
    aclModulesApplied.push(key);
  };
  for (const { resource, action, source = 'user' } of input.aclGrants) {
    const key = resolveModuleKey(resource);
    if (source === 'role' && strictSector && CATALOG_MODULE_KEYS.has(key)) continue;
    enable(key);
    if (resource === 'ferias' && (action === 'admin' || action === 'manage')) enable('ferias_admin');
  }

  for (const [key, value] of Object.entries(input.userModules || {})) {
    if (value === true) modules[resolveModuleKey(key)] = true;
  }
  for (const [key, value] of Object.entries(input.userModules || {})) {
    if (value === false) modules[resolveModuleKey(key)] = false;
  }
  for (const { resource, action } of input.aclDenied || []) {
    if (MODULE_ACCESS_ACTIONS.has(action)) modules[resolveModuleKey(resource)] = false;
  }

  return {
    modules,
    aclModulesApplied: aclModulesApplied.filter((key) => modules[key]),
  };
}

/** Nome ACL de um módulo do catálogo só vale com o módulo efetivo ligado (setor estrito / revogação). */
export function aclNamesWithinModules(
  perms: ReadonlyArray<{ resource: string; name: string }>,
  modules: Record<string, boolean>,
): string[] {
  const names = perms
    .filter((perm) => {
      const key = resolveModuleKey(perm.resource);
      return !CATALOG_MODULE_KEYS.has(key) || modules[key] === true;
    })
    .map((perm) => perm.name)
    .filter(Boolean);
  return [...new Set(names)];
}

const EPI_MANAGE_GRANTS = ['epi.manage', 'epi.admin'] as const;

/**
 * Gerir EPI: ADMIN/MANAGER, módulo `epi` marcado no usuário, módulo `epi` no setor (salvo
 * desligado explicitamente) ou feature/ACL `epi.manage|admin`. O role ACL `epi.view` do USER
 * não abre gestão.
 */
export function snapshotPodeGerenciarEpi(snapshot: {
  role: string;
  explicitModules: Record<string, boolean | undefined>;
  sectorModulesRaw: readonly string[];
  features: Record<string, boolean | undefined>;
  aclNames: readonly string[];
}): boolean {
  if (['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(normalizeRole(snapshot.role))) return true;
  const explicit = snapshot.explicitModules.epi;
  if (explicit === true) return true;
  if (explicit !== false && snapshot.sectorModulesRaw.some((id) => resolveModuleKey(id) === 'epi')) {
    return true;
  }
  return EPI_MANAGE_GRANTS.some(
    (key) => featureGrantedByJsonb(snapshot.features, key) || featureGrantedByAcl(snapshot.aclNames, key),
  );
}

export function resolveGtDocumentPermissionFlags(
  local: { canEdit: boolean; canDelete: boolean },
  server: { canEdit?: boolean; canDelete?: boolean } | null,
): { canEdit: boolean; canDelete: boolean } {
  return {
    canEdit: server?.canEdit !== undefined ? server.canEdit : local.canEdit,
    canDelete: server?.canDelete !== undefined ? server.canDelete : local.canDelete,
  };
}
