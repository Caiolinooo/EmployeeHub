'use client';

import { useState, useEffect } from 'react';
import { FiKey, FiUser, FiCheck, FiX, FiCopy, FiRefreshCw } from 'react-icons/fi';

export default function TokenTester() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Verificar se há um token no localStorage
    const storedToken = localStorage.getItem('token') || localStorage.getItem('token') || localStorage.getItem('abzToken');
    if (storedToken) {
      setToken(storedToken);
      verifyToken(storedToken);

      // Migrar de abzToken para token se necessário
      if (localStorage.getItem('token') || localStorage.getItem('abzToken')) {
        localStorage.setItem('token', storedToken);
        localStorage.removeItem('abzToken'); localStorage.removeItem('token');
      }
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: tokenToVerify })
      });

      const data = await response.json();

      if (data.valid) {
        setSuccess('Token válido! Informações decodificadas com sucesso.');
        setUserData(data.decoded);

        // Testar o token na API /api/auth/me
        try {
          const meResponse = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${tokenToVerify}`
            }
          });

          const meData = await meResponse.json();

          if (meResponse.ok) {
            setSuccess(prev => `${prev}\nAPI /api/auth/me respondeu com sucesso!`);
            setUserData((prev: any) => ({ ...prev, apiResponse: meData }));
          } else {
            setError(`API /api/auth/me retornou erro: ${meData.error || 'Erro desconhecido'}`);
          }
        } catch (apiError) {
          setError(`Erro ao chamar API /api/auth/me: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
      } else {
        setError(`Token inválido: ${data.error || 'Erro desconhecido'}`);
        setUserData(null);
      }
    } catch (err) {
      setError(`Erro ao verificar token: ${err instanceof Error ? err.message : String(err)}`);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setSuccess('Token copiado para a área de transferência!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToken(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      localStorage.setItem('token', token);
      verifyToken(token);
    } else {
      setError('Por favor, insira um token');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FiKey className="mr-2" /> Testador de Token JWT
      </h1>

      <div className="mb-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              Token JWT
            </label>
            <textarea
              id="token"
              value={token}
              onChange={handleTokenChange}
              className="w-full p-3 border border-gray-300 rounded-md h-32 font-mono text-sm"
              placeholder="Cole seu token JWT aqui..."
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
              disabled={loading || !token}
            >
              {loading ? <FiRefreshCw className="mr-2 animate-spin" /> : <FiKey className="mr-2" />}
              Verificar Token
            </button>

            {token && (
              <button
                type="button"
                onClick={copyToken}
                className="px-4 py-2 bg-gray-600 text-white rounded-md flex items-center"
              >
                <FiCopy className="mr-2" />
                Copiar Token
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center">
            <FiX className="mr-2 flex-shrink-0" />
            <div className="whitespace-pre-line">{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center">
            <FiCheck className="mr-2 flex-shrink-0" />
            <div className="whitespace-pre-line">{success}</div>
          </div>
        )}

        {userData && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h2 className="text-lg font-medium mb-2 flex items-center">
              <FiUser className="mr-2" /> Informações do Token
            </h2>
            <div className="bg-white p-4 rounded-md">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(userData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
