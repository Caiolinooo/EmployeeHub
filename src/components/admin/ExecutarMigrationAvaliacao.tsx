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
      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Token de autenticação não encontrado. Por favor, faça login novamente.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/avaliacao/run-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
          <div className="text-sm text-blue-800 flex-1">
            <p className="font-medium mb-1">O que esta migration faz:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adiciona campos is_gerente_avaliacao e is_lider em funcionarios</li>
              <li>Cria tabela periodos_avaliacao</li>
              <li>Adiciona campo comentario_avaliador (Q15)</li>
              <li>Adiciona campos de workflow (status_aprovacao, data_aprovacao, etc)</li>
              <li>Cria índices otimizados</li>
              <li>Configura políticas de segurança (RLS)</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-blue-300">
              <p className="font-medium">📖 Precisa de ajuda?</p>
              <p className="mt-1">
                <a
                  href="/docs/COMO_EXECUTAR_MIGRATION_AVALIACAO.md"
                  target="_blank"
                  className="text-blue-700 hover:text-blue-900 underline font-medium"
                >
                  Leia o guia passo a passo aqui
                </a>
              </p>
            </div>
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
              <p className="font-medium">
                {results?.needsManualExecution
                  ? 'Migration preparada!'
                  : 'Migration executada com sucesso!'}
              </p>
              <p className="text-sm">
                {results?.needsManualExecution
                  ? 'O SQL foi gerado. Execute manualmente no Supabase SQL Editor (veja abaixo).'
                  : 'Todas as alterações foram aplicadas ao banco de dados.'}
              </p>
            </div>
          </div>

          {results?.needsManualExecution && results?.manualSql && (
            <div className="mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">Instruções:</p>
                {results?.instructions && (
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    {results.instructions.map((instruction: string, idx: number) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                )}
              </div>

              <p className="font-semibold mb-2">SQL para executar manualmente:</p>
              <div className="bg-white border border-green-300 rounded p-3 text-xs">
                <pre className="overflow-auto max-h-96 text-gray-800 whitespace-pre-wrap">{results.manualSql}</pre>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(results.manualSql);
                    alert('SQL copiado para a área de transferência!');
                  }}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Copiar SQL
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/project/_/sql`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  Abrir SQL Editor
                  <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          )}
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
