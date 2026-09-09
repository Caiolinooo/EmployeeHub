export type EffectiveFeatureInput = {
  role?: string | null;
  features?: Record<string, boolean | undefined> | null;
  aclNames?: readonly string[] | null;
};

/** ACL names that also grant a catalog feature (mirrors documento-permissions manage/admin). */
const FEATURE_IMPLIED_BY_ACL: Record<string, readonly string[]> = {
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

export function hasEffectiveFeature(input: EffectiveFeatureInput, featureKey: string): boolean {
  if (roleBypassesFeature(input.role, featureKey)) return true;
  if (featureGrantedByJsonb(input.features, featureKey)) return true;
  return featureGrantedByAcl(input.aclNames, featureKey);
}

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
  return out;
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
