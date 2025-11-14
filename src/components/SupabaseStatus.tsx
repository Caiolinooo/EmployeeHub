'use client';

import { useState, useEffect } from 'react';
import { FiDatabase, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

export default function SupabaseStatus() {
  const { t } = useI18n();

  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [message, setMessage] = useState<string>(t('components.verificandoConexao', 'Verificando conexão...'));
  const [details, setDetails] = useState<any>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkConnection = async () => {
    setIsChecking(true);
    setStatus('loading');
    setMessage(t('components.verificandoConexao', 'Verificando conexão...'));

    try {
      const response = await fetch('/api/test/supabase');
      const data = await response.json();

      if (data.status === 'ok') {
        setStatus('connected');
        setMessage(t('components.conexaoEstabelecidaComSucesso', 'Conexão estabelecida com sucesso'));
        setDetails(data);
      } else {
        setStatus('error');
        setMessage(data.message || 'Erro ao conectar com o Supabase');
        setDetails(data);
      }
    } catch (error) {
      setStatus('error');
      setMessage(t('components.erroAoVerificarConexao', 'Erro ao verificar conexão'));
      setDetails({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium flex items-center">
          <FiDatabase className="mr-2" />
          Status do Supabase
        </h2>
        <button
          onClick={checkConnection}
          disabled={isChecking}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Verificar novamente"
        >
          <FiRefreshCw className={`${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          status === 'connected' ? 'bg-green-500' :
          status === 'error' ? 'bg-red-500' :
          'bg-yellow-500'
        }`} />
        <span className="font-medium">
          {status === 'connected' ? 'Conectado' :
           status === 'error' ? 'Erro' :
           'Verificando...'}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-2">{message}</p>
      
      {details && status === 'connected' && (
        <div className="mt-4 text-xs text-gray-500 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>Usuários:</div>
            <div>{details.usersCount?.[0]?.count || 'N/A'}</div>
            
            <div>Versão:</div>
            <div>{details.version || 'N/A'}</div>
            
            <div>Timestamp:</div>
            <div>{new Date(details.timestamp).toLocaleString()}</div>
          </div>
        </div>
      )}
      
      {details && status === 'error' && (
        <div className="mt-4 text-xs text-red-500 border-t pt-2">
          <pre className="whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
