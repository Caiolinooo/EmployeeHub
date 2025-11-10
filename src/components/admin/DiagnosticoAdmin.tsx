'use client';

import React, { useState } from 'react';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

export default function DiagnosticoAdmin() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const executarDiagnostico = async () => {
    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/debug/check-admin', {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <FiAlertCircle className="text-blue-600 mr-3" size={24} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Diagnóstico de Permissões de Admin
          </h3>
          <p className="text-sm text-gray-600">
            Verifique se você tem permissões de administrador
          </p>
        </div>
      </div>

      <button
        onClick={executarDiagnostico}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Verificando...' : 'Executar Diagnóstico'}
      </button>

      {result && (
        <div className="mt-4">
          <div className={`border rounded-lg p-4 ${
            result.isAdmin
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-3">
              {result.isAdmin ? (
                <>
                  <FiCheck className="text-green-600 mr-2" size={20} />
                  <span className="font-semibold text-green-800">Você é administrador!</span>
                </>
              ) : (
                <>
                  <FiX className="text-red-600 mr-2" size={20} />
                  <span className="font-semibold text-red-800">Você NÃO é administrador</span>
                </>
              )}
            </div>

            {result.diagnosis && (
              <div className="mt-3 space-y-2 text-sm">
                <h4 className="font-semibold text-gray-900 mb-2">Detalhes do Diagnóstico:</h4>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center">
                    {result.diagnosis.hasToken ? (
                      <FiCheck className="text-green-600 mr-2" size={16} />
                    ) : (
                      <FiX className="text-red-600 mr-2" size={16} />
                    )}
                    <span>Token presente</span>
                  </div>

                  <div className="flex items-center">
                    {result.diagnosis.tokenValid ? (
                      <FiCheck className="text-green-600 mr-2" size={16} />
                    ) : (
                      <FiX className="text-red-600 mr-2" size={16} />
                    )}
                    <span>Token válido</span>
                  </div>

                  <div className="flex items-center">
                    {result.diagnosis.userExists ? (
                      <FiCheck className="text-green-600 mr-2" size={16} />
                    ) : (
                      <FiX className="text-red-600 mr-2" size={16} />
                    )}
                    <span>Usuário encontrado</span>
                  </div>

                  <div className="flex items-center">
                    {result.diagnosis.adminCheckPassed ? (
                      <FiCheck className="text-green-600 mr-2" size={16} />
                    ) : (
                      <FiX className="text-red-600 mr-2" size={16} />
                    )}
                    <span>Verificação de admin</span>
                  </div>
                </div>

                {result.userFromDatabase && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h5 className="font-semibold text-gray-900 mb-2">Seus dados:</h5>
                    <div className="text-xs space-y-1">
                      <p><strong>ID:</strong> {result.userFromDatabase.id}</p>
                      <p><strong>Nome:</strong> {result.userFromDatabase.first_name} {result.userFromDatabase.last_name}</p>
                      <p><strong>Email:</strong> {result.userFromDatabase.email}</p>
                      <p><strong>Telefone:</strong> {result.userFromDatabase.phone_number}</p>
                      <p><strong>Role:</strong> <span className={`font-semibold ${
                        result.userFromDatabase.role === 'ADMIN' ? 'text-green-600' : 'text-red-600'
                      }`}>{result.userFromDatabase.role}</span></p>
                    </div>
                  </div>
                )}

                {!result.isAdmin && result.userFromDatabase && result.userFromDatabase.role !== 'ADMIN' && (
                  <div className="mt-3 pt-3 border-t border-red-300 bg-red-100 p-3 rounded">
                    <p className="font-semibold text-red-800">Problema identificado:</p>
                    <p className="text-red-700 text-xs mt-1">
                      Sua role no banco de dados é "{result.userFromDatabase.role}" mas deveria ser "ADMIN".
                      <br />
                      Você precisa atualizar sua role na tabela users_unified no Supabase.
                    </p>
                  </div>
                )}
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                Ver JSON completo
              </summary>
              <div className="mt-2 bg-gray-50 rounded p-3 text-xs">
                <pre className="overflow-auto">{JSON.stringify(result, null, 2)}</pre>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
