'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';

function normalizarNomeSetor(str: string | null | undefined): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Hook para verificação de permissões do usuário em Matrizes de Treinamento.
 * Checa a tríade de segurança do projeto:
 * 1. Role (ADMIN, MANAGER)
 * 2. Features JSONB (gestao-tripulantes.matrizes.manage)
 * 3. Setor (DP, RH, Treinamento, Operações, SMS/QHSE, Gestão de Tripulantes com módulo gestao-tripulantes)
 * 4. Permissões granulares de ACL (user_acl_permissions / role_acl_permissions via API)
 */
export function useGtMatrizPermissions() {
  const { user, profile, isAdmin, isManager, hasFeature, hasAccess } = useSupabaseAuth();
  const [serverPerms, setServerPerms] = useState<{
    canManage?: boolean;
    canView?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Avaliação instantânea via perfil / setor / role local
  const localCanManage = useMemo(() => {
    if (isAdmin || isManager) return true;
    if (hasFeature('gestao-tripulantes.matrizes.manage') || hasFeature('gestao-tripulantes.admin')) {
      return true;
    }

    // Setor autorizado com o módulo gestao-tripulantes
    const sector = profile?.sector;
    const sectorAllowedModules = sector?.allowed_modules || [];
    const hasGtModule =
      hasAccess('gestao-tripulantes') ||
      (Array.isArray(sectorAllowedModules) && sectorAllowedModules.includes('gestao-tripulantes'));

    if (sector?.name && hasGtModule) {
      const n = normalizarNomeSetor(sector.name);
      if (
        n.includes('departamento pessoal') ||
        n.includes('depto pessoal') ||
        n.includes('recursos humanos') ||
        n.includes('treinamento') ||
        n.includes('capacitacao') ||
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
      if (tokens.includes('dp') || tokens.includes('rh') || tokens.includes('gt') || tokens.includes('sms') || tokens.includes('qhse')) {
        return true;
      }
    }

    return false;
  }, [isAdmin, isManager, hasFeature, hasAccess, profile?.sector]);

  const localCanView = useMemo(() => {
    if (localCanManage) return true;
    if (hasFeature('gestao-tripulantes.matrizes.view')) return true;
    return false;
  }, [localCanManage, hasFeature]);

  // 2. Consulta autoritativa ao endpoint do servidor (valida tabelas ACL)
  useEffect(() => {
    if (!user?.id) return;
    let isCancelled = false;

    const checkServer = async () => {
      try {
        setIsLoading(true);
        const res = await fetchWithToken('/api/gestao-tripulantes/matrizes/permissions');
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.success) {
            setServerPerms({
              canManage: json.canManage,
              canView: json.canView,
            });
          }
        }
      } catch {
        /* fail-soft com fallback local */
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    checkServer();
    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  const canManageMatrizes = serverPerms?.canManage !== undefined ? serverPerms.canManage : localCanManage;
  const canViewMatrizes = serverPerms?.canView !== undefined ? serverPerms.canView : localCanView;

  return {
    canManageMatrizes,
    canViewMatrizes,
    isLoading,
  };
}
