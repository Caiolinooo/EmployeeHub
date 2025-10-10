'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiClock, FiActivity, FiInfo, FiRefreshCw } from 'react-icons/fi';
import { AccessHistoryEntry } from '@/models/User';
import { useI18n } from '@/contexts/I18nContext';

interface UserAccessHistoryProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

const UserAccessHistory: React.FC<UserAccessHistoryProps> = ({ userId, userName, onClose }) => {
  const [history, setHistory] = useState<AccessHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para formatar data
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Função para obter o histórico de acesso
  const fetchAccessHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.naoAutorizado'));
      }

      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      console.log(t('components.buscandoHistoricoParaUsuarioUseridComTimestampTime'));

      // Fazer até 3 tentativas em caso de falha
      let attempts = 0;
      const maxAttempts = 3;
      let response;

      while (attempts < maxAttempts) {
        try {
          response = await fetch(`/api/users/access-history?userId=${userId}&_=${timestamp}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });

          if (response.ok) break;

          console.log(`Tentativa ${attempts + 1} falhou com status ${response.status}. Tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre tentativas
        } catch (error) {
          console.error(`Erro na tentativa ${attempts + 1}:`, error);
        }

        attempts++;
      }

      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({}));
        throw new Error(errorData.error || t('components.falhaAoBuscarHistoricoAposMaxattemptsTentativas'));
      }

      const responseText = await response.text();

      // Verificar se a resposta está vazia
      if (!responseText || responseText.trim() === '') {
        console.error(t('components.respostaVaziaRecebidaDaApiDeHistorico'));
        setHistory([]);
        setError(t('components.nenhumHistoricoEncontradoARespostaDaApiEstaVazia'));
        setLoading(false);
        return;
      }

      try {
        const data = JSON.parse(responseText);
        console.log(t('components.historicoRecebido'), data);

        // Verificar se o histórico existe e está no formato correto
        let accessHistory = data.accessHistory || [];

        // Garantir que o histórico seja um array
        if (!Array.isArray(accessHistory)) {
          console.log(t('components.historicoNaoEUmArrayConvertendo'));
          try {
            // Tentar converter de string JSON para array
            if (typeof accessHistory === 'string') {
              accessHistory = JSON.parse(accessHistory);
            }
            // Se ainda não for um array, criar um vazio
            if (!Array.isArray(accessHistory)) {
              accessHistory = [];
            }
          } catch (error) {
            console.error(t('components.erroAoConverterHistorico'), error);
            accessHistory = [];
          }
        }

        setHistory(accessHistory);
      } catch (parseError) {
        console.error('Erro ao analisar resposta JSON:', parseError);
        console.log('Texto da resposta:', responseText);
        setError(t('components.erroAoProcessarDadosDeHistoricoFormatoInvalido'));
        setHistory([]);
      }
    } catch (error) {
      console.error(t('components.erroAoObterHistoricoDeAcesso'), error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico ao montar o componente
  useEffect(() => {
    fetchAccessHistory();
  }, [userId]);

  // Função para obter ícone com base na ação
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return <FiClock className="text-green-500" />;
      case 'LOGOUT':
        return <FiClock className="text-red-500" />;
      case 'PASSWORD_CHANGED':
        return <FiActivity className="text-blue-500" />;
      case 'CREATED':
        return <FiActivity className="text-purple-500" />;
      case 'PERMISSIONS_UPDATED':
        return <FiActivity className="text-orange-500" />;
      default:
        return <FiInfo className="text-gray-500" />;
    }
  };

  // Função para obter descrição legível da ação
  const getActionDescription = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'Login no sistema';
      case 'LOGOUT':
        return 'Logout do sistema';
      case 'PASSWORD_CHANGED':
        return 'Senha alterada';
      case 'CREATED':
        return t('components.usuarioCriado');
      case 'PERMISSIONS_UPDATED':
        return t('components.permissoesAtualizadas');
      default:
        return action.replace(/_/g, ' ').toLowerCase();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-abz-blue">
            Histórico de Acesso - {userName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-100"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-abz-blue mb-4"></div>
              <p className="text-gray-600">Carregando histórico de acesso...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-md">
              <h3 className="text-lg font-medium mb-2">Erro ao carregar histórico</h3>
              <p className="mb-4">{error}</p>
              <button
                onClick={fetchAccessHistory}
                className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark flex items-center justify-center"
              >
                <FiRefreshCw className="mr-2" /> Tentar novamente
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FiInfo className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum registro encontrado</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Não há registros de acesso para este usuário. Os registros são criados automaticamente quando o usuário realiza ações no sistema.
              </p>
              <button
                onClick={fetchAccessHistory}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center mx-auto"
              >
                <FiRefreshCw className="mr-2" /> Atualizar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-gray-900">
                          {getActionDescription(entry.action)}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>
                      {entry.details && (
                        <p className="text-sm text-gray-600 mt-1">
                          {entry.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserAccessHistory;
