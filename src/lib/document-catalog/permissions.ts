import { DEFAULT_PERMISSIONS_BY_ROLE, hasFeaturePermission, type AppUserLike } from '@/lib/permissions';
import type { CatalogDocument, DocumentCatalogSourceId } from './types';

/** Same module key as `/epi` and UserEditor “EPI” (`accessPermissions.modules.epi`). */
export const QHSE_MODULE_KEY = 'epi';

export interface CatalogViewer extends AppUserLike {
  id: string;
  role: string;
  access_permissions?: AppUserLike['access_permissions'];
  accessPermissions?: AppUserLike['accessPermissions'];
}

function roleUpper(user: AppUserLike | null): string {
  return (user?.role || '').toUpperCase();
}

export function isAdminOrManager(user: AppUserLike | null): boolean {
  const role = roleUpper(user);
  return role === 'ADMIN' || role === 'MANAGER';
}

export function hasModuleEnabled(user: AppUserLike | null, moduleId: string): boolean {
  if (!user) return false;
  if (roleUpper(user) === 'ADMIN') return true;
  const permissions = user.access_permissions || user.accessPermissions;
  const flag = permissions?.modules?.[moduleId];
  if (typeof flag === 'boolean') return flag;
  return DEFAULT_PERMISSIONS_BY_ROLE[roleUpper(user)]?.modules?.[moduleId] === true;
}

/**
 * Viewer may see QHSE/EPI on employee tabs: ADMIN/MANAGER, or module `epi` enabled.
 * No extra catalog ACLs (`lista-presenca.manage` / `gestao-tripulantes.view`).
 */
export function hasQhseModule(viewer: CatalogViewer | null): boolean {
  if (!viewer) return false;
  if (isAdminOrManager(viewer)) return true;
  return hasModuleEnabled(viewer, QHSE_MODULE_KEY);
}

/**
 * Who may open the global catalog for a given person.
 * Own profile, or ADMIN/MANAGER (user management / GT).
 */
export function canViewCollaboratorCatalog(
  viewer: CatalogViewer | null,
  subjectUserId: string | null
): boolean {
  if (!viewer) return false;
  if (subjectUserId && viewer.id === subjectUserId) return true;
  return isAdminOrManager(viewer);
}

export function canSeeQhseDocuments(
  viewer: CatalogViewer | null,
  _subjectUserId?: string | null
): boolean {
  return hasQhseModule(viewer);
}

export function canRequestCollaboratorCatalog(
  viewer: CatalogViewer | null,
  opts: { userId?: string | null; colaboradorId?: string | null; qhseOnly?: boolean }
): boolean {
  if (!viewer) return false;
  if (opts.qhseOnly) {
    return hasQhseModule(viewer) && !!(opts.userId || opts.colaboradorId);
  }
  if (opts.userId && canViewCollaboratorCatalog(viewer, opts.userId)) return true;
  if (opts.colaboradorId && (isAdminOrManager(viewer) || hasFeaturePermission(viewer, 'gestao-tripulantes.view'))) {
    return true;
  }
  return false;
}

export function filterCatalogDocuments(
  viewer: CatalogViewer,
  subjectUserId: string | null,
  documents: CatalogDocument[]
): CatalogDocument[] {
  const qhseOk = canSeeQhseDocuments(viewer, subjectUserId);
  return documents.filter((doc) => {
    if (doc.qhseRelated && !qhseOk) return false;
    return true;
  });
}

export function canDownloadCatalogSource(
  viewer: CatalogViewer,
  source: DocumentCatalogSourceId,
  qhseRelated: boolean,
  subjectUserId: string | null
): boolean {
  if (qhseRelated) {
    return canSeeQhseDocuments(viewer, subjectUserId);
  }
  if (!canViewCollaboratorCatalog(viewer, subjectUserId)) return false;

  switch (source) {
    case 'gt':
      return (
        isAdminOrManager(viewer) ||
        hasFeaturePermission(viewer, 'gestao-tripulantes.view') ||
        !!(subjectUserId && viewer.id === subjectUserId)
      );
    case 'epi':
    case 'lista_presenca':
      return isAdminOrManager(viewer) || !!(subjectUserId && viewer.id === subjectUserId);
    case 'academy':
    case 'contratos':
    case 'ferias':
    case 'reembolso':
    case 'assinatura':
      return isAdminOrManager(viewer) || !!(subjectUserId && viewer.id === subjectUserId);
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}
