'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiRefreshCw, FiCheck, FiX, FiAlertCircle, FiUser, FiKey } from 'react-icons/fi';

export default function TestUserManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [generatingToken, setGeneratingToken] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Obter token do localStorage
      const abzToken = localStorage.getItem('token') || localStorage.getItem('abzToken');
      setToken(abzToken);

      if (!abzToken) {
        setError('Token não encontrado. Gere um token primeiro.');
        setLoading(false);
        return;
      }

      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      console.log('Buscando usuários com timestamp:', timestamp);

      const response = await fetch(`/api/users/supabase?_=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${abzToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      console.log('Status da resposta:', response.status);

      if (!response.ok) {
        let errorMessage = `Erro: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Se não conseguir analisar como JSON, usar o texto bruto
          const errorText = await response.text();
          console.error('Resposta de erro (texto bruto):', errorText);
        }

        setError(errorMessage);
        setLoading(false);
        return;
      }

      const result = await response.json();
      console.log('Usuários recebidos:', result);

      setData({
        status: 'success',
        message: 'Usuários carregados com sucesso',
        users: result
      });
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError(`Erro ao buscar usuários: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    if (!userId) {
      setError('ID do usuário é obrigatório');
      return;
    }

    setGeneratingToken(true);
    setError(null);

    try {
      const existing = localStorage.getItem('token') || localStorage.getItem('abzToken');
      const response = await fetch('/api/test-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(existing ? { Authorization: `Bearer ${existing}` } : {}),
        },
        body: JSON.stringify({
          userId,
          email,
          role: 'ADMIN'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar token');
      }

      const result = await response.json();
      console.log('Token gerado:', result);

      // Salvar token no localStorage
      localStorage.setItem('token', result.token);
      setToken(result.token);

      // Mostrar mensagem de sucesso
      setData({
        status: 'success',
        message: 'Token gerado com sucesso',
        token: result.token
      });
    } catch (err) {
      console.error('Erro ao gerar token:', err);
      setError(`Erro ao gerar token: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingToken(false);
    }
  };

  const testSupabaseConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const abzToken = localStorage.getItem('token') || localStorage.getItem('abzToken');
      const response = await fetch('/api/debug-supabase-auth', {
        headers: abzToken ? { Authorization: `Bearer ${abzToken}` } : {},
      });
      const result = await response.json();

      console.log('Resultado do diagnóstico de autenticação:', result);
      setData(result);

      if (!result.success) {
        setError(result.error || 'Erro ao conectar ao Supabase');
      }
    } catch (err) {
      console.error('Erro ao testar conexão:', err);
      setError(`Erro ao testar conexão: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verificar se já existe um token
    const existingToken = localStorage.getItem('token') || localStorage.getItem('token') || localStorage.getItem('abzToken');
    if (existingToken) {
      setToken(existingToken);
      // Migrar de abzToken para token se necessário
      if (localStorage.getItem('token') || localStorage.getItem('abzToken')) {
        localStorage.setItem('token', existingToken);
        localStorage.removeItem('abzToken'); localStorage.removeItem('token');
      }
    }
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FiUsers className="mr-2" /> Teste de Gerenciamento de Usuários
      </h1>

      <div className="mb-6 space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testSupabaseConnection}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            disabled={loading}
          >
            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Diagnóstico Supabase
          </button>

          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center"
            disabled={loading}
          >
            <FiUser className="mr-2" />
            Buscar Usuários
          </button>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h2 className="text-lg font-medium mb-2">Gerar Token de Teste</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID do Usuário (obrigatório)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="ID do usuário no Supabase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Email do usuário"
              />
            </div>
          </div>
          <button
            onClick={generateToken}
            className="px-4 py-2 bg-purple-600 text-white rounded-md flex items-center"
            disabled={generatingToken || !userId}
          >
            <FiKey className={`mr-2 ${generatingToken ? 'animate-spin' : ''}`} />
            Gerar Token de Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-start">
          <FiAlertCircle className="mr-2 mt-1 flex-shrink-0" />
          <div>
            <p className="font-medium">Erro</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {token && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h2 className="text-lg font-medium mb-2">Token</h2>
          <p className="text-sm font-mono break-all">{token}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : data && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            {data.status === 'success' ? (
              <div className="flex items-center text-green-600">
                <FiCheck className="mr-2" />
                <span className="font-medium">Sucesso</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <FiX className="mr-2" />
                <span className="font-medium">Erro</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-medium mb-2">Mensagem</h2>
            <p>{data.message}</p>
          </div>

          {data.users && (
            <div className="mb-4">
              <h2 className="text-lg font-medium mb-2">Usuários ({data.users.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Papel</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.users.map((user: any, index: number) => (
                      <tr key={user._id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user._id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.firstName} {user.lastName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phoneNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.sample && (
            <div className="mb-4">
              <h2 className="text-lg font-medium mb-2">Amostra de Usuários</h2>
              <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">
                {JSON.stringify(data.sample, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-4">
            <h2 className="text-lg font-medium mb-2">Dados Completos</h2>
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
