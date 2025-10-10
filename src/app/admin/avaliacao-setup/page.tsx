'use client';

import React, { useState, useEffect } from 'react';
import { FiPlay, FiCheck, FiX, FiAlertCircle, FiDatabase, FiSettings } from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  role: string;
  name?: string;
}

export default function AvaliacaoSetupPage() {
  const { t } = useI18n();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [results, setResults] = useState<string[]>([]);
  const [migrationApplied, setMigrationApplied] = useState(false);

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('abzToken');
        if (!token) {
          setAuthLoading(false);
          return;
        }

        const response = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser({
              id: data.userId,
              role: data.role
            });
          }
        }
      } catch (error) {
        console.error(t('admin.erroAoVerificarAutenticacao'), error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  const applyMigrations = async () => {
    setLoading(true);
    setResults([]);

    try {
      const token = localStorage.getItem('abzToken');
      
      const response = await fetch('/api/avaliacao/apply-migrations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
        setMigrationApplied(true);
        alert('Migrações aplicadas com sucesso!');
      } else {
        setResults([`❌ Erro: ${data.error}`]);
        alert(`Erro ao aplicar migrações: ${data.error}`);
      }
    } catch (error) {
      console.error(t('admin.erroAoAplicarMigracoes'), error);
      setResults([{t('admin.erroDeConexaoErrorInstanceofErrorErrormessage')}Erro desconhecido'}`]);
      alert('Erro de conexão ao aplicar migrações');
    } finally {
      setLoading(false);
    }
  };

  const checkTables = async () => {
    try {
      const token = localStorage.getItem('abzToken');
      
      const response = await fetch('/api/avaliacao/check-tables', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        const tableResults = Object.entries(data.tables).map(([table, exists]) => 
          `${exists ? '✅' : '❌'} Tabela ${table}: ${exists ? 'Existe' : {t('admin.naoEncontrada')}}`
        );
        setResults(tableResults);
      } else {
        setResults([`❌ Erro ao verificar tabelas: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao verificar tabelas:', error);
      setResults([{t('admin.erroDeConexaoErrorInstanceofErrorErrormessage')}Erro desconhecido'}`]);
    }
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Carregando...
            </h2>
            <p className="text-gray-600">
              Verificando permissões de acesso
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <FiAlertCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acesso Negado
            </h2>
            <p className="text-gray-600">
              Apenas administradores podem acessar esta página.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuração do Sistema de Avaliação
          </h1>
          <p className="text-gray-600">
            Configure e valide o sistema de avaliação de funcionários
          </p>
        </div>

        {/* Cards de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card de Aplicar Migrações */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiDatabase className="text-blue-600" size={24} />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">Aplicar Migrações</h3>
                <p className="text-sm text-gray-600">
                  Cria as tabelas e estruturas necessárias para o sistema de avaliação
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <strong>Esta ação irá:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Adicionar coluna apenas_lideres aos critérios</li>
                  <li>Unificar Pontualidade com Comprometimento</li>
                  <li>Dividir Liderança em dois critérios</li>
                  <li>Criar tabela de líderes</li>
                  <li>Criar tabelas do novo workflow</li>
                  <li>Criar período de teste</li>
                </ul>
              </div>
              
              <button
                onClick={applyMigrations}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <FiPlay className="mr-2" size={16} />
                {loading ? 'Aplicando...' : {t('admin.aplicarMigracoes')}}
              </button>
            </div>
          </div>

          {/* Card de Verificar Tabelas */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiSettings className="text-green-600" size={24} />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">Verificar Sistema</h3>
                <p className="text-sm text-gray-600">
                  Verifica se todas as tabelas necessárias existem
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <strong>Verifica:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Tabela de critérios</li>
                  <li>Tabela de avaliações</li>
                  <li>Tabela de líderes</li>
                  <li>Tabela de períodos</li>
                  <li>Tabela de autoavaliações</li>
                </ul>
              </div>
              
              <button
                onClick={checkTables}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <FiCheck className="mr-2" size={16} />
                Verificar Tabelas
              </button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultados</h3>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-start space-x-2">
                  {result.startsWith('✅') ? (
                    <FiCheck className="text-green-500 mt-0.5" size={16} />
                  ) : (
                    <FiX className="text-red-500 mt-0.5" size={16} />
                  )}
                  <span className="text-sm text-gray-700">{result.substring(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status do Sistema */}
        {migrationApplied && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <FiCheck className="text-green-600 mr-3" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-green-900">Sistema Configurado!</h3>
                <p className="text-green-700 mt-1">
                  O sistema de avaliação foi configurado com sucesso. Agora você pode:
                </p>
                <ul className="list-disc list-inside mt-2 text-green-700 space-y-1">
                  <li>Configurar períodos de avaliação no painel admin</li>
                  <li>Identificar líderes no sistema</li>
                  <li>Testar o fluxo de autoavaliação</li>
                  <li>Acessar o módulo de avaliação</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Próximos Passos</h3>
          <div className="text-blue-800 space-y-2">
            <p><strong>1.</strong> Aplique as migrações clicando no botão acima</p>
            <p><strong>2.</strong> Verifique se todas as tabelas foram criadas</p>
            <p><strong>3.</strong> Configure o primeiro período de avaliação</p>
            <p><strong>4.</strong> Identifique os líderes no sistema</p>
            <p><strong>5.</strong> Teste o fluxo completo de avaliação</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
