import { supabaseAdmin } from '@/lib/supabase';
import { featureGrantedByAcl, featureGrantedByJsonb, roleBypassesGate } from '@/lib/effective-feature';
import { loadEffectivePermissions } from '@/lib/effective-permissions-server';
import { setorPermiteDesligamento, type SetorDesligamento } from './desligamento-setor';
import {
  DOCS_VIEW_ALL,
  decidirEscopoDocumentos,
  viewAllNegadoNoUsuario,
  type EscopoDocumentosGt,
} from './documento-escopo-regra';

export * from './documento-escopo-regra';

const ESCOPO_ADMIN: EscopoDocumentosGt = { escopo: 'todos', colaboradorIds: [] };

export async function resolverEscopoDocumentosGt(
  userId: string,
  role: string | null | undefined,
): Promise<EscopoDocumentosGt> {
  if (roleBypassesGate(role, 'admin')) return ESCOPO_ADMIN;
  const [snapshot, userRes, colabRes] = await Promise.all([
    loadEffectivePermissions(userId),
    supabaseAdmin.from('users_unified').select('sector_id, access_permissions').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('gt_colaboradores').select('id').eq('user_id', userId).is('deleted_at', null),
  ]);
  const sectorId = userRes.data?.sector_id as string | null | undefined;
  const { data: sector } = sectorId
    ? await supabaseAdmin.from('sectors').select('name, allowed_modules').eq('id', sectorId).maybeSingle()
    : { data: null };
  const rawFeatures = (userRes.data?.access_permissions as { features?: Record<string, unknown> } | null)?.features;
  return {
    escopo: decidirEscopoDocumentos({
      role,
      setorDp: !!sector && setorPermiteDesligamento(sector as SetorDesligamento),
      viewAll:
        !!snapshot &&
        (featureGrantedByJsonb(snapshot.features, DOCS_VIEW_ALL) || featureGrantedByAcl(snapshot.aclNames, DOCS_VIEW_ALL)),
      viewAllNegado: viewAllNegadoNoUsuario(rawFeatures, snapshot?.aclDeniedNames),
    }),
    colaboradorIds: ((colabRes.data || []) as Array<{ id: string }>).map((c) => c.id),
  };
}
