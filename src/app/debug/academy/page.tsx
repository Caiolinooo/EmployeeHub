'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getTranslatedCards } from '@/data/cards';
import { useI18n } from '@/contexts/I18nContext';

interface DebugInfo {
  user: any;
  permissions: any;
  cards: any[];
  academyCard: any;
  hasAcademyAccess: boolean;
  modulePermissions: Record<string, boolean>;
}

const AcademyDebugPage: React.FC = () => {
  const { user, permissions, hasAccess } = useSupabaseAuth();
  const { t } = useI18n();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDebugInfo();
    } else {
      setLoading(false);
    }
  }, [user, permissions]);

  const loadDebugInfo = async () => {
    try {
      // Obter cards
      const cards = getTranslatedCards(t);
      const academyCard = cards.find(card => card.id === 'academy' || card.moduleKey === 'academy');
      
      // Verificar acesso ao Academy
      const hasAcademyAccess = hasAccess('academy');
      
      // Obter permissões de módulos
      const moduleKeys = ['dashboard', 'manual', 'academy', 'reembolso', 'avaliacao'];
      const modulePermissions: Record<string, boolean> = {};
      
      moduleKeys.forEach(key => {
        modulePermissions[key] = hasAccess(key);
      });

      setDebugInfo({
        user: {
          id: user?.id,
          email: user?.email,
          first_name: user?.first_name,
          last_name: user?.last_name,
          role: user?.role,
          is_active: user?.is_active
        },
        permissions,
        cards: cards.map(card => ({
          id: card.id,
          title: card.title,
          moduleKey: card.moduleKey,
          enabled: card.enabled,
          adminOnly: card.adminOnly,
          managerOnly: card.managerOnly
        })),
        academyCard,
        hasAcademyAccess,
        modulePermissions
      });
    } catch (error) {
      console.error('Erro ao carregar informações de debug:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">Acesso restrito</h3>
            <p className="mt-1 text-sm text-gray-500">
              Faça login para ver as informações de debug.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Debug - Academy Module</h1>
          <p className="text-gray-600 mt-1">
            Informações de debug para diagnosticar problemas com o módulo Academy
          </p>
        </div>

        {debugInfo && (
          <div className="space-y-6">
            {/* Informações do usuário */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Usuário</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">ID:</span> {debugInfo.user.id}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {debugInfo.user.email}
                </div>
                <div>
                  <span className="font-medium">Nome:</span> {debugInfo.user.first_name} {debugInfo.user.last_name}
                </div>
                <div>
                  <span className="font-medium">Role:</span> {debugInfo.user.role}
                </div>
                <div>
                  <span className="font-medium">Ativo:</span> {debugInfo.user.is_active ? 'Sim' : 'Não'}
                </div>
              </div>
            </div>

            {/* Status do Academy */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status do Academy</h2>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="font-medium mr-2">Acesso ao Academy:</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    debugInfo.hasAcademyAccess 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {debugInfo.hasAcademyAccess ? 'Permitido' : 'Negado'}
                  </span>
                </div>
                
                <div className="flex items-center">
                  <span className="font-medium mr-2">Card do Academy encontrado:</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    debugInfo.academyCard 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {debugInfo.academyCard ? 'Sim' : 'Não'}
                  </span>
                </div>

                {debugInfo.academyCard && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Detalhes do Card Academy:</h3>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.academyCard, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Permissões de módulos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissões de Módulos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(debugInfo.modulePermissions).map(([module, hasAccess]) => (
                  <div key={module} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{module}</span>
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      hasAccess 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {hasAccess ? 'Sim' : 'Não'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Todos os cards */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Todos os Cards Disponíveis</h2>
              <div className="space-y-3">
                {debugInfo.cards.map((card, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{card.title}</span>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        card.enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {card.enabled ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>ID: {card.id}</div>
                      <div>Module Key: {card.moduleKey || 'N/A'}</div>
                      <div>Admin Only: {card.adminOnly ? 'Sim' : 'Não'}</div>
                      <div>Manager Only: {card.managerOnly ? 'Sim' : 'Não'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões completas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissões Completas</h2>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(debugInfo.permissions, null, 2)}
              </pre>
            </div>

            {/* Ações de correção */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-4">Ações de Correção</h2>
              <div className="space-y-3 text-sm text-yellow-700">
                <p>Se o Academy não estiver aparecendo no dashboard, tente:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Fazer logout e login novamente</li>
                  <li>Limpar o cache do navegador</li>
                  <li>Verificar se o usuário tem permissão para o módulo 'academy'</li>
                  <li>Verificar se o card está habilitado no banco de dados</li>
                  <li>Executar o script de configuração do Academy</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AcademyDebugPage;

