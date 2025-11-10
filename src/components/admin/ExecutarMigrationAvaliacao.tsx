'use client';

import React, { useState } from 'react';
import { FiDatabase, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

export default function ExecutarMigrationAvaliacao() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const executarMigration = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/avaliacao/run-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setResults(data);
      } else {
        setError(data.error || 'Erro ao executar migration');
        setResults(data);
      }
    } catch (err) {
      setError('Erro ao executar migration: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <FiDatabase className="text-blue-600 mr-3" size={24} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Migration do Banco de Dados
          </h3>
          <p className="text-sm text-gray-600">
            Execute a migration para adicionar os novos campos e tabelas necessários
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <FiAlertCircle className="text-blue-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">O que esta migration faz:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adiciona campos is_gerente_avaliacao e is_lider em funcionarios</li>
              <li>Cria tabela periodos_avaliacao</li>
              <li>Adiciona campo comentario_avaliador (Q15)</li>
              <li>Adiciona campos de workflow (status_aprovacao, data_aprovacao, etc)</li>
              <li>Cria índices otimizados</li>
              <li>Configura políticas de segurança (RLS)</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <FiX className="mr-2 flex-shrink-0" size={20} />
            <div>
              <p className="font-medium">Erro ao executar migration:</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          {results?.errors && (
            <div className="mt-2">
              <p className="text-sm font-medium mb-1">Detalhes dos erros:</p>
              <div className="bg-red-100 rounded p-2 text-xs">
                <pre>{JSON.stringify(results.errors, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <FiCheck className="mr-2" size={20} />
            <div>
              <p className="font-medium">Migration executada com sucesso!</p>
              <p className="text-sm">
                Todas as alterações foram aplicadas ao banco de dados.
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={executarMigration}
        disabled={loading || success}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            Executando Migration...
          </>
        ) : success ? (
          <>
            <FiCheck className="inline mr-2" />
            Migration Concluída
          </>
        ) : (
          <>
            <FiDatabase className="inline mr-2" />
            Executar Migration
          </>
        )}
      </button>

      {results && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            Ver detalhes técnicos
          </summary>
          <div className="mt-2 bg-gray-50 rounded p-3 text-xs">
            <pre className="overflow-auto">{JSON.stringify(results, null, 2)}</pre>
          </div>
        </details>
      )}
    </div>
  );
}
