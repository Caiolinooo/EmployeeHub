'use client';

import React, { useState } from 'react';
import { FiPlay, FiCheck, FiX, FiDatabase, FiSettings, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

export default function ConfigurarSistemaPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const criarTabelas = async () => {
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/database/create-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
      } else {
        setResults([`❌ Erro: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao criar tabelas:', error);
      setResults([`❌ Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setLoading(false);
    }
  };

  const configurarCriterios = async () => {
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/avaliacao/setup-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
        if (data.observacoes) {
          setResults(prev => [...prev, '', '📋 Observações:', ...data.observacoes.map((obs: string) => `• ${obs}`)]);
        }
      } else {
        setResults([`❌ Erro: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao configurar critérios:', error);
      setResults([`❌ Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setLoading(false);
    }
  };

  const verificarSistema = async () => {
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/database/create-tables', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.resultados || []);
      } else {
        setResults([`❌ Erro: ${data.error}`]);
      }
    } catch (error) {
      console.error('Erro ao verificar sistema:', error);
      setResults([`❌ Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-4">
            <FiSettings className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuração do Sistema de Avaliação
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Configure e prepare o sistema de avaliação de desempenho com as novas funcionalidades
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Verificar Sistema */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <FiCheck className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Verificar Sistema</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Verifique o status atual das tabelas e configurações do sistema
            </p>
            <button
              onClick={verificarSistema}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <FiRefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FiCheck className="h-4 w-4 mr-2" />
              )}
              Verificar
            </button>
          </div>

          {/* Criar Tabelas */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <FiDatabase className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Criar Tabelas</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Crie todas as tabelas necessárias para o sistema de avaliação
            </p>
            <button
              onClick={criarTabelas}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <FiRefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FiDatabase className="h-4 w-4 mr-2" />
              )}
              Criar Tabelas
            </button>
          </div>

          {/* Configurar Critérios */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <FiSettings className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Configurar Critérios</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Configure os critérios de avaliação com as novas regras
            </p>
            <button
              onClick={configurarCriterios}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <FiRefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FiSettings className="h-4 w-4 mr-2" />
              )}
              Configurar
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <FiAlertCircle className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Resultados</h3>
            </div>
            <div className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {results.map((result, index) => (
                  <div key={index} className={`mb-1 ${
                    result.startsWith('✅') ? 'text-green-600' :
                    result.startsWith('❌') ? 'text-red-600' :
                    result.startsWith('⚠️') ? 'text-yellow-600' :
                    result.startsWith('📋') ? 'text-blue-600 font-semibold' :
                    'text-gray-700'
                  }`}>
                    {result}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-lg font-semibold text-blue-900 mb-2">Instruções</h4>
              <div className="text-blue-800 space-y-2">
                <p><strong>1. Verificar Sistema:</strong> Primeiro, verifique o status atual das tabelas</p>
                <p><strong>2. Criar Tabelas:</strong> Se alguma tabela estiver faltando, clique em "Criar Tabelas"</p>
                <p><strong>3. Configurar Critérios:</strong> Configure os critérios de avaliação com as novas regras</p>
                <p><strong>4. Testar:</strong> Após a configuração, teste o módulo de avaliação</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="text-center mt-8">
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
