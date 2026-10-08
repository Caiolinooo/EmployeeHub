import { loadEffectivePermissions } from '@/lib/effective-permissions-server';
import { featureGrantedByAcl, featureGrantedByJsonb, snapshotPodeGerenciarEpi } from '@/lib/effective-feature';

/**
 * Gerir EPI (catálogo, kits, estoque, responsáveis). Regra pura em `snapshotPodeGerenciarEpi`;
 * `acao` soma o grant granular `epi.<acao>` do catálogo (`module-grants.ts`) sem tirar ninguém.
 */
export async function podeGerenciarEpi(userId: string, role: string | undefined, acao?: string): Promise<boolean> {
  const r = (role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'MANAGER' || r === 'SUPERADMIN') return true;
  if (!userId) return false;
  const snapshot = await loadEffectivePermissions(userId);
  if (!snapshot) return false;
  if (snapshotPodeGerenciarEpi(snapshot)) return true;
  if (!acao) return false;
  const key = `epi.${acao}`;
  return featureGrantedByJsonb(snapshot.features, key) || featureGrantedByAcl(snapshot.aclNames, key);
}
