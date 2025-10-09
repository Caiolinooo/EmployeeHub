'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import AutomationSettings from '@/components/AutomationSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FiArrowLeft, 
  FiSettings, 
  FiGlobe, 
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle
} from 'react-icons/fi';

export default function AutomationPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  // Verificar permissões
  useEffect(() => {
    if (user) {
      const isAdmin = user.role === 'ADMIN';
      setHasPermission(isAdmin);
      setIsLoading(false);
      
      if (!isAdmin) {
        toast({
          title: 'Acesso Negado',
          description: 'Você não tem permissão para acessar esta página',
          variant: 'destructive',
          duration: 3000,
        });
        router.push('/dashboard');
      }
    }
  }, [user, router, toast]);

  const handleGoBack = () => {
    router.push('/admin');
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-abz-blue"></div>
        </div>
      </MainLayout>
    );
  }

  if (!hasPermission) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <FiAlertTriangle className="h-5 w-5" />
                <span>Acesso Negado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Você não tem permissão para acessar esta página.
              </p>
              <Button onClick={handleGoBack} className="w-full">
                <FiArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button
              onClick={handleGoBack}
              variant="outline"
              size="sm"
            >
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Configurações de Automação
              </h1>
              <p className="text-gray-600 mt-1">
                Configure sistemas automáticos de tradução e sincronização de dados
              </p>
            </div>
          </div>
        </div>

        {/* Cards de Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <FiGlobe className="h-5 w-5 text-blue-600" />
                <span>Tradução Automática</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <FiCheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Sistema ativo e funcionando
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Detecta automaticamente strings não traduzidas e gera traduções
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <FiLayers className="h-5 w-5 text-purple-600" />
                <span>Sistema Unificado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <FiCheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Sincronização ativa
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Mantém cards e menus sincronizados automaticamente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Configurações Detalhadas */}
        <AutomationSettings />

        {/* Informações Adicionais */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiSettings className="h-5 w-5 text-gray-600" />
              <span>Sobre os Sistemas de Automação</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Tradução Automática</h4>
                <p className="text-sm text-gray-600">
                  Quando uma chave de tradução não é encontrada, o sistema automaticamente:
                </p>
                <ul className="text-xs text-gray-500 mt-1 ml-4 space-y-1">
                  <li>• Detecta a string não traduzida</li>
                  <li>• Gera uma tradução usando algoritmos inteligentes</li>
                  <li>• Salva a tradução no cache para uso futuro</li>
                  <li>• Atualiza a interface automaticamente</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-1">Sistema Unificado Cards/Menus</h4>
                <p className="text-sm text-gray-600">
                  Centraliza o gerenciamento de cards e menus:
                </p>
                <ul className="text-xs text-gray-500 mt-1 ml-4 space-y-1">
                  <li>• Fonte única de dados para cards e menus</li>
                  <li>• Sincronização automática com Supabase</li>
                  <li>• Fallback inteligente para dados hardcoded</li>
                  <li>• Aplicação consistente de permissões</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  <FiAlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Importante</p>
                    <p className="text-xs text-yellow-700">
                      Essas configurações afetam todo o sistema. Mudanças podem levar alguns 
                      minutos para serem aplicadas completamente em todas as páginas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
