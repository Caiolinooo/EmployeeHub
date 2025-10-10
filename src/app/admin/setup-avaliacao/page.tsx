'use client';

import React, { useState } from 'react';
import { FiPlay, FiCheck, FiX, FiDatabase, FiSettings, FiAlertCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

export default function SetupAvaliacaoPage() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [migrationApplied, setMigrationApplied] = useState(false);

  const applyMigrations = async () => {
    setLoading(true);
    setResults([]);

    try {
      const token = localStorage.getItem('abzToken');

      const response = await fetch('/api/avaliacao/setup-direct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
        if (data.observacoes) {
          setResults(prev => [...prev, '', {t('admin.observacoes')}, ...data.observacoes.map((obs: string) => `• ${obs}`)]);
        }
        setMigrationApplied(true);
        alert('Configuração aplicada com sucesso!');
      } else {
        setResults([`❌ Erro: ${data.error}`]);
        alert(`Erro ao aplicar configuração: ${data.error}`);
      }
    } catch (error) {
      console.error({t('admin.erroAoAplicarConfiguracao')}, error);
      setResults([{t('admin.erroDeConexaoErrorInstanceofErrorErrormessage')}Erro desconhecido'}`]);
      alert('Erro de conexão ao aplicar configuração');
    } finally {
      setLoading(false);
    }
  };

  const checkTables = async () => {
    try {
      const token = localStorage.getItem('abzToken');

      const response = await fetch('/api/avaliacao/setup-direct', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
      } else {
        setResults([`❌ Erro ao verificar sistema: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao verificar sistema:', error);
      setResults([{t('admin.erroDeConexaoErrorInstanceofErrorErrormessage')}Erro desconhecido'}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
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
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
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
                  <li>Atualizar pesos dos critérios para 1.0</li>
                  <li>Unificar Pontualidade com Comprometimento</li>
                  <li>Dividir Liderança em dois critérios</li>
                  <li>Verificar/criar tabelas necessárias</li>
                  <li>Criar período de avaliação de teste</li>
                  <li>Configurar sistema para novo workflow</li>
                </ul>
              </div>
              
              <button
                onClick={applyMigrations}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <FiPlay className="mr-2" size={16} />
                {loading ? 'Configurando...' : 'Configurar Sistema'}
              </button>
            </div>
          </div>

          {/* Card de Verificar Tabelas */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
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
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultados</h3>
            <div className="space-y-2">
              {results.map((result, index) => {
                if (result === '') {
                  return <div key={index} className="h-2"></div>;
                }

                if (result.startsWith('📋')) {
                  return (
                    <div key={index} className="font-semibold text-blue-900 mt-4">
                      {result}
                    </div>
                  );
                }

                if (result.startsWith('•')) {
                  return (
                    <div key={index} className="ml-4 text-sm text-blue-700">
                      {result}
                    </div>
                  );
                }

                return (
                  <div key={index} className="flex items-start space-x-2">
                    {result.startsWith('✅') ? (
                      <FiCheck className="text-green-500 mt-0.5" size={16} />
                    ) : result.startsWith('⚠️') ? (
                      <FiAlertCircle className="text-yellow-500 mt-0.5" size={16} />
                    ) : (
                      <FiX className="text-red-500 mt-0.5" size={16} />
                    )}
                    <span className="text-sm text-gray-700">
                      {result.startsWith('✅') || result.startsWith('❌') || result.startsWith('⚠️')
                        ? result.substring(2)
                        : result
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status do Sistema */}
        {migrationApplied && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-sm mb-8">
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Próximos Passos</h3>
          <div className="text-blue-800 space-y-2">
            <p><strong>1.</strong> Aplique as migrações clicando no botão acima</p>
            <p><strong>2.</strong> Verifique se todas as tabelas foram criadas</p>
            <p><strong>3.</strong> Configure o primeiro período de avaliação</p>
            <p><strong>4.</strong> Identifique os líderes no sistema</p>
            <p><strong>5.</strong> Teste o fluxo completo de avaliação</p>
          </div>
        </div>

        {/* Botão para voltar */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
