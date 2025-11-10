'use client';

import React, { useState } from 'react';
import { FiCheck, FiX, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

export default function DiagnosticoForeignKeys() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const verificarForeignKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/avaliacao/check-foreign-keys');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Erro ao verificar foreign keys:', error);
      setResult({
        success: false,
        error: 'Erro ao verificar foreign keys',
        foreignKeys: { funcionario_id: false, avaliador_id: false }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <FiAlertCircle className="text-blue-600 mr-3" size={24} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Diagnóstico de Foreign Keys
          </h3>
          <p className="text-sm text-gray-600">
            Verifique se os relacionamentos entre tabelas estão configurados corretamente
          </p>
        </div>
      </div>

      <button
        onClick={verificarForeignKeys}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
      >
        {loading ? (
          <>
            <FiRefreshCw className="animate-spin mr-2" />
            Verificando...
          </>
        ) : (
          <>
            <FiRefreshCw className="mr-2" />
            Verificar Foreign Keys
          </>
        )}
      </button>

      {result && (
        <div className="space-y-4">
          {/* Status das Foreign Keys */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Status dos Relacionamentos:</h4>

            <div className="space-y-2">
              {/* funcionario_id */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center">
                  {result.foreignKeys?.funcionario_id ? (
                    <FiCheck className="text-green-600 mr-2" size={20} />
                  ) : (
                    <FiX className="text-red-600 mr-2" size={20} />
                  )}
                  <span className="font-mono text-sm">
                    avaliacoes_desempenho_funcionario_id_fkey
                  </span>
                </div>
                <span className={`text-sm font-medium ${
                  result.foreignKeys?.funcionario_id ? 'text-green-600' : 'text-red-600'
                }`}>
                  {result.foreignKeys?.funcionario_id ? 'Existe' : 'Faltando'}
                </span>
              </div>

              {/* avaliador_id */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center">
                  {result.foreignKeys?.avaliador_id ? (
                    <FiCheck className="text-green-600 mr-2" size={20} />
                  ) : (
                    <FiX className="text-red-600 mr-2" size={20} />
                  )}
                  <span className="font-mono text-sm">
                    avaliacoes_desempenho_avaliador_id_fkey
                  </span>
                </div>
                <span className={`text-sm font-medium ${
                  result.foreignKeys?.avaliador_id ? 'text-green-600' : 'text-red-600'
                }`}>
                  {result.foreignKeys?.avaliador_id ? 'Existe' : 'Faltando'}
                </span>
              </div>
            </div>
          </div>

          {/* Mensagem de resultado */}
          {result.allExist ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <FiCheck className="text-green-600 mr-2" size={20} />
                <p className="text-green-800 font-medium">
                  ✅ Todas as foreign keys estão configuradas corretamente!
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <FiX className="text-red-600 mr-2 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-red-800 font-medium mb-2">
                    ❌ Faltam foreign keys!
                  </p>
                  <p className="text-sm text-red-700 mb-3">
                    As foreign keys são necessárias para o sistema fazer joins entre as tabelas.
                    Sem elas, a página de avaliações não conseguirá carregar os dados dos funcionários.
                  </p>
                  <div className="bg-white border border-red-300 rounded p-3 text-sm">
                    <p className="font-semibold mb-2 text-red-900">Como corrigir:</p>
                    <ol className="list-decimal list-inside space-y-1 text-red-800">
                      <li>Abra o arquivo: <code className="bg-red-100 px-1 rounded">supabase/migrations/FIX_FOREIGN_KEYS.sql</code></li>
                      <li>Copie o conteúdo do <strong>PASSO 2</strong></li>
                      <li>Execute no Supabase SQL Editor</li>
                      <li>Clique em "Verificar Foreign Keys" novamente</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detalhes técnicos */}
          {result.constraints && result.constraints.length > 0 && (
            <details className="border border-gray-200 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                Ver detalhes técnicos
              </summary>
              <div className="mt-3 text-xs">
                <pre className="bg-gray-50 p-3 rounded overflow-auto">
                  {JSON.stringify(result.constraints, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
