import { checkAclPermission } from '@/lib/auth';
import { hasEffectiveFeature } from '@/lib/effective-feature';

export interface GtDocumentPermissionUser {
  id: string;
  role?: string | null;
  access_permissions?: {
    features?: Record<string, boolean | undefined>;
  } | null;
}

function roleOf(user: GtDocumentPermissionUser): string {
  return (user.role || '').toUpperCase();
}

function hasFeature(
  user: GtDocumentPermissionUser,
  feature: 'gestao-tripulantes.documents.edit' | 'gestao-tripulantes.documents.delete',
): boolean {
  return hasEffectiveFeature(
    { role: user.role, features: user.access_permissions?.features },
    feature,
  );
}

async function hasGtAcl(
  user: GtDocumentPermissionUser,
  action: 'documents.edit' | 'documents.delete' | 'manage' | 'admin',
): Promise<boolean> {
  return checkAclPermission(user.id, roleOf(user), 'gestao-tripulantes', action);
}

/** ADMIN/MANAGER, feature JSONB, ou ACL documents.edit / manage / admin. */
export async function canEditGtDocuments(user: GtDocumentPermissionUser): Promise<boolean> {
  const role = roleOf(user);
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  if (hasFeature(user, 'gestao-tripulantes.documents.edit')) return true;
  return (
    (await hasGtAcl(user, 'documents.edit')) ||
    (await hasGtAcl(user, 'manage')) ||
    (await hasGtAcl(user, 'admin'))
  );
}

/** ADMIN/MANAGER, feature JSONB, ou ACL documents.delete / manage / admin. */
export async function canDeleteGtDocuments(user: GtDocumentPermissionUser): Promise<boolean> {
  const role = roleOf(user);
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  if (hasFeature(user, 'gestao-tripulantes.documents.delete')) return true;
  return (
    (await hasGtAcl(user, 'documents.delete')) ||
    (await hasGtAcl(user, 'manage')) ||
    (await hasGtAcl(user, 'admin'))
  );
}
