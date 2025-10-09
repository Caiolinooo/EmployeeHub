'use client';

import React, { useState } from 'react';
import { FiPlay, FiCheck, FiX, FiDatabase, FiSettings, FiAlertCircle } from 'react-icons/fi';

export default function SetupSistemaPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [migrationApplied, setMigrationApplied] = useState(false);

  const configurarSistema = async () => {
    setLoading(true);
    setResults([]);

    try {
      const token = localStorage.getItem('abzToken');
      
      if (!token) {
        alert('Você precisa estar logado para configurar o sistema');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/avaliacao/setup-simple', {
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
          setResults(prev => [...prev, '', '📋 Observações:', ...data.observacoes.map((obs: string) => `• ${obs}`)]);
        }
        setMigrationApplied(true);
        alert('Sistema configurado com sucesso!');
      } else {
        setResults([`❌ Erro: ${data.error}`]);
        if (data.debug) {
          setResults(prev => [...prev, '', '🔍 Debug:', JSON.stringify(data.debug, null, 2)]);
        }
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao configurar sistema:', error);
      setResults([`❌ Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const verificarSistema = async () => {
    try {
      const token = localStorage.getItem('abzToken');
      
      const response = await fetch('/api/avaliacao/setup-simple', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.resultados || []);
      } else {
        setResults([`❌ Erro ao verificar: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao verificar:', error);
      setResults([`❌ Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔧 Configuração do Sistema de Avaliação
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Configure o sistema de avaliação de funcionários com as novas especificações
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={configurarSistema}
            disabled={loading}
            className="flex flex-col items-center p-8 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
          >
            <FiDatabase size={48} className="mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {loading ? 'Configurando...' : 'Configurar Sistema'}
            </h3>
            <p className="text-blue-100 text-center">
              Aplica todas as mudanças necessárias no sistema de avaliação
            </p>
          </button>

          <button
            onClick={verificarSistema}
            disabled={loading}
            className="flex flex-col items-center p-8 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
          >
            <FiSettings size={48} className="mb-4" />
            <h3 className="text-xl font-semibold mb-2">Verificar Sistema</h3>
            <p className="text-green-100 text-center">
              Verifica o status atual do sistema e tabelas
            </p>
          </button>
        </div>

        {/* O que será feito */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            🎯 O que será configurado:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Remover pesos da avaliação</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Unificar Pontualidade + Comprometimento</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Dividir Liderança em 2 critérios</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Criar sistema de líderes</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Configurar novo workflow</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Criar período de teste</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Resultados</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => {
                if (result === '') {
                  return <div key={index} className="h-4"></div>;
                }
                
                if (result.startsWith('📋')) {
                  return (
                    <div key={index} className="font-semibold text-blue-900 text-lg mt-6">
                      {result}
                    </div>
                  );
                }
                
                if (result.startsWith('•')) {
                  return (
                    <div key={index} className="ml-6 text-blue-700 bg-blue-50 p-2 rounded">
                      {result}
                    </div>
                  );
                }

                if (result.startsWith('🔍')) {
                  return (
                    <div key={index} className="font-semibold text-purple-900 text-lg mt-6">
                      {result}
                    </div>
                  );
                }

                if (result.startsWith('{')) {
                  return (
                    <pre key={index} className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                      {result}
                    </pre>
                  );
                }
                
                return (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                    {result.startsWith('✅') ? (
                      <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" size={20} />
                    ) : result.startsWith('⚠️') ? (
                      <FiAlertCircle className="text-yellow-500 mt-0.5 flex-shrink-0" size={20} />
                    ) : (
                      <FiX className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
                    )}
                    <span className="text-gray-700">
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

        {/* Status de Sucesso */}
        {migrationApplied && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 shadow-lg mb-8">
            <div className="flex items-center mb-4">
              <FiCheck className="text-green-600 mr-3" size={32} />
              <h3 className="text-2xl font-semibold text-green-900">
                🎉 Sistema Configurado!
              </h3>
            </div>
            <p className="text-green-800 mb-4">
              O sistema de avaliação foi configurado com sucesso. Agora você pode:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Acessar o módulo de avaliação</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Configurar períodos de avaliação</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Identificar líderes no sistema</span>
              </div>
              <div className="flex items-center text-green-700">
                <FiCheck className="mr-2" size={16} />
                <span>Testar o novo workflow</span>
              </div>
            </div>
          </div>
        )}

        {/* Botão para voltar */}
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium"
          >
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
