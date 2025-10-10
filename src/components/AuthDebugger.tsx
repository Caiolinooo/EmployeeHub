'use client';

import React from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente para depurar o estado de autenticação
 * Exibe informações sobre o usuário, perfil e permissões
 */
export default function AuthDebugger() {
  const { t } = useI18n();

  const { 
    user, 
    profile, 
    isLoading, 
    isAuthenticated, 
    isAdmin, 
    isManager,
    hasAccess
  } = useSupabaseAuth();

  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 my-4 text-sm">
      <h3 className="font-bold text-lg mb-2">Auth Debugger</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="font-semibold">Loading:</div>
        <div>{isLoading ? 'Sim' : {t('components.nao')}}</div>
        
        <div className="font-semibold">Authenticated:</div>
        <div>{isAuthenticated ? 'Sim' : {t('components.nao')}}</div>
        
        <div className="font-semibold">User ID:</div>
        <div>{user?.id || 'N/A'}</div>
        
        <div className="font-semibold">User Email:</div>
        <div>{user?.email || 'N/A'}</div>
        
        <div className="font-semibold">Profile ID:</div>
        <div>{profile?.id || 'N/A'}</div>
        
        <div className="font-semibold">Profile Role:</div>
        <div>{profile?.role || 'N/A'}</div>
        
        <div className="font-semibold">Is Admin:</div>
        <div>{isAdmin ? 'Sim' : {t('components.nao')}}</div>
        
        <div className="font-semibold">Is Manager:</div>
        <div>{isManager ? 'Sim' : {t('components.nao')}}</div>
        
        <div className="font-semibold">Access to 'avaliacao':</div>
        <div>{hasAccess('avaliacao') ? 'Sim' : {t('components.nao')}}</div>
      </div>
      
      <div className="mt-4">
        <div className="font-semibold mb-1">Profile Data:</div>
        <pre className="bg-gray-200 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </div>
    </div>
  );
}
