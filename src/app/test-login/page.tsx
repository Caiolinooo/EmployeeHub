'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiUser, FiMail, FiKey, FiCheck, FiX, FiLoader } from 'react-icons/fi';

export default function TestLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Função para testar o login
  const testLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setToken(null);
    setUserData(null);

    try {
      // Fazer a requisição de login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (response.ok && data.token) {
        setToken(data.token);
        
        // Se tiver token, buscar dados do usuário
        if (data.token) {
          await fetchUserData(data.token);
        }
      } else {
        setError(data.error || 'Erro desconhecido ao fazer login');
      }
    } catch (error) {
      setError(`Erro ao fazer requisição: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar dados do usuário com o token
  const fetchUserData = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      setUserData(data);

      if (!response.ok) {
        setError(data.error || 'Erro ao buscar dados do usuário');
      }
    } catch (error) {
      setError(`Erro ao buscar dados do usuário: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">Teste de Login</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold text-abz-text-black mb-4">Formulário de Teste</h2>
        
        <form onSubmit={testLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiMail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-abz-blue focus:border-abz-blue sm:text-sm"
                placeholder="exemplo@email.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiKey className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-abz-blue focus:border-abz-blue sm:text-sm"
                placeholder="Sua senha"
                required
              />
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                'Testar Login'
              )}
            </button>
          </div>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiX className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erro</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {result && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold text-abz-text-black mb-4">Resultado do Login</h2>
          
          <div className="bg-gray-50 p-4 rounded-md overflow-auto">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
          
          {token && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-abz-text-black mb-2">Token JWT</h3>
              <div className="bg-gray-50 p-4 rounded-md overflow-auto">
                <p className="text-sm break-all">{token}</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {userData && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-abz-text-black mb-4">Dados do Usuário</h2>
          
          <div className="bg-gray-50 p-4 rounded-md overflow-auto">
            <pre className="text-sm">{JSON.stringify(userData, null, 2)}</pre>
          </div>
          
          {userData.user && (
            <div className="mt-4 p-4 border border-green-200 rounded-md bg-green-50">
              <div className="flex items-center">
                <FiCheck className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="text-lg font-medium text-green-800">Autenticação bem-sucedida</h3>
              </div>
              <div className="mt-2">
                <p className="text-sm text-green-700">
                  <strong>Nome:</strong> {userData.user.firstName} {userData.user.lastName}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Email:</strong> {userData.user.email || 'Não informado'}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Telefone:</strong> {userData.user.phoneNumber}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Função:</strong> {userData.user.role}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}

