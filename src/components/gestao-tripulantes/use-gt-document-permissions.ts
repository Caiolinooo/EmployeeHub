'use client';

import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { resolveGtDocumentPermissionFlags } from '@/lib/effective-feature';

/**
 * Edit/delete de treinamentos, ASOs, documentos e passaportes (`gt_documentos`).
 * Local: `hasFeature` (role + JSONB + ACL names via effective-permissions).
 * Autoridade: `GET /api/gestao-tripulantes/documentos/permissions` (mesmo gate do PUT/DELETE).
 */
export function useGtDocumentPermissions() {
  const { hasFeature, user } = useSupabaseAuth();
  const [server, setServer] = useState<{ canEdit?: boolean; canDelete?: boolean } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/documentos/permissions');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success) {
          setServer({
            canEdit: json.canEdit,
            canDelete: json.canDelete,
          });
        }
      } catch {
        /* fail-soft: usa hasFeature local */
      }
    };

    load();

    const onRefresh = () => {
      void load();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('permissions-updated', onRefresh);
      window.addEventListener('visibilitychange', onRefresh);
      window.addEventListener('focus', onRefresh);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('permissions-updated', onRefresh);
        window.removeEventListener('visibilitychange', onRefresh);
        window.removeEventListener('focus', onRefresh);
      }
    };
  }, [user?.id]);

  return resolveGtDocumentPermissionFlags(
    {
      canEdit: hasFeature('gestao-tripulantes.documents.edit'),
      canDelete: hasFeature('gestao-tripulantes.documents.delete'),
    },
    server,
  );
}
