'use client';

import { useState, useEffect } from 'react';
import { FiRefreshCw, FiSearch, FiCopy, FiCheck } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface CodeEntry {
  identifier: string;
  code: string;
  method: 'email' | 'sms';
  timestamp: string;
  expires: string;
  used: boolean;
}

export default function DebugCodesPage() {
  const { t } = useI18n();
  const [codes, setCodes] = useState<CodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  
  // Função para buscar os códigos
  const fetchCodes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debug/codes');
      const data = await response.json();
      
      if (data.success) {
        setCodes(data.codes || []);
      } else {
        setError(data.error || 'Erro ao buscar códigos');
      }
    } catch (error) {
      setError('Erro ao conectar com a API');
      console.error('Erro ao buscar códigos:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Buscar códigos ao carregar a página
  useEffect(() => {
    fetchCodes();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchCodes, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Filtrar códigos com base na busca
  const filteredCodes = search
    ? codes.filter(code => 
        code.identifier.toLowerCase().includes(search.toLowerCase()) ||
        code.code.includes(search)
      )
    : codes;
  
  // Função para copiar o código
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    
    // Limpar o status de copiado após 2 segundos
    setTimeout(() => {
      setCopied(null);
    }, 2000);
  };
  
  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Códigos de Verificação (Debug)</h1>
          <button
            onClick={fetchCodes}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            <FiRefreshCw />
            Atualizar
          </button>
        </div>
        
        {process.env.NODE_ENV === 'production' && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
            <p className="font-bold">Atenção</p>
            <p>Esta página só deve ser usada em ambiente de desenvolvimento.</p>
          </div>
        )}
        
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search', 'Buscar por email, telefone ou código...')}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>
        
        {loading && <p className="text-gray-500">{t('common.loading', 'Carregando códigos...')}</p>}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p className="font-bold">{t('common.error', 'Erro')}</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && filteredCodes.length === 0 && (
          <p className="text-gray-500">{t('debug.noCodesFound', 'Nenhum código ativo encontrado.')}</p>
        )}
        
        {filteredCodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b text-left">Identificador</th>
                  <th className="py-2 px-4 border-b text-left">Código</th>
                  <th className="py-2 px-4 border-b text-left">Método</th>
                  <th className="py-2 px-4 border-b text-left">Criado em</th>
                  <th className="py-2 px-4 border-b text-left">Expira em</th>
                  <th className="py-2 px-4 border-b text-left">Status</th>
                  <th className="py-2 px-4 border-b text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((code, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b">{code.identifier}</td>
                    <td className="py-2 px-4 border-b font-mono text-lg font-bold">{code.code}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        code.method === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {code.method === 'email' ? 'Email' : 'SMS'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b">{formatDate(code.timestamp)}</td>
                    <td className="py-2 px-4 border-b">{formatDate(code.expires)}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        code.used ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {code.used ? 'Usado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <button
                        onClick={() => copyCode(code.code)}
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
                        title="Copiar código"
                      >
                        {copied === code.code ? <FiCheck /> : <FiCopy />}
                        {copied === code.code ? 'Copiado!' : 'Copiar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
