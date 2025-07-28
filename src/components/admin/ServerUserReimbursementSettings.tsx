'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiPlus, FiTrash2, FiMail, FiAlertCircle, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface ServerUserReimbursementSettingsProps {
  userId?: string;
  email?: string;
  initialSettings?: {
    enabled: boolean;
    recipients: string[];
  };
  onSave?: (settings: {
    enabled: boolean;
    recipients: string[];
  }) => void;
  onClose?: () => void;
}

const ServerUserReimbursementSettings: React.FC<ServerUserReimbursementSettingsProps> = ({
  userId,
  email,
  initialSettings,
  onSave,
  onClose
}) => {
  const { user, isAdmin } = useSupabaseAuth();
  const [enabled, setEnabled] = useState(initialSettings?.enabled || false);
  const [recipients, setRecipients] = useState<string[]>(initialSettings?.recipients || []);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  // Verificar se o usuário tem permissão para editar
  useEffect(() => {
    // Apenas administradores podem editar as configurações
    setReadOnly(!isAdmin);

    if (!isAdmin) {
      console.log('Usuário não é administrador. Modo somente leitura ativado.');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (initialSettings) {
      setEnabled(initialSettings.enabled);
      setRecipients(initialSettings.recipients || []);
    } else if (userId || email) {
      fetchSettings();
    }
  }, [initialSettings, userId, email]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Tentar usar a API principal
      try {
        console.log('Tentando carregar configurações da API principal...');

        // Construir URL com parâmetros
        let url = '/api/users/reimbursement-settings-server?';
        if (userId) url += `userId=${encodeURIComponent(userId)}`;
        else if (email) url += `email=${encodeURIComponent(email)}`;

        console.log(`Buscando configurações para ${userId ? 'userId: ' + userId : 'email: ' + email}`);

        // Adicionar timestamp para evitar cache
        url += `&_t=${Date.now()}`;

        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        const data = await response.json();

        if (response.ok) {
          console.log('Configurações de email de reembolso do usuário carregadas:', data);

          if (data.reimbursement_email_settings) {
            setEnabled(data.reimbursement_email_settings.enabled || false);
            setRecipients(data.reimbursement_email_settings.recipients || []);
            setIsLoading(false);
            return;
          }
        } else {
          console.error('Erro ao carregar configurações da API principal:', data.error);

          // Se o erro for relacionado à coluna não existente, tentar adicionar a coluna
          if (data.error && data.error.includes('column') && data.error.includes('reimbursement_email_settings') && data.error.includes('does not exist')) {
            console.log('Coluna reimbursement_email_settings não existe, tentando adicionar...');

            // Tentar adicionar a coluna usando a API de setup
            try {
              const setupResponse = await fetch('/api/setup-user-reimbursement-column', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              if (setupResponse.ok) {
                console.log('Coluna adicionada com sucesso, tentando carregar configurações novamente...');

                // Tentar carregar configurações novamente
                const retryResponse = await fetch(url);

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  console.log('Configurações carregadas com sucesso após adicionar coluna:', retryData);

                  if (retryData.reimbursement_email_settings) {
                    setEnabled(retryData.reimbursement_email_settings.enabled || false);
                    setRecipients(retryData.reimbursement_email_settings.recipients || []);
                    setIsLoading(false);
                    return;
                  }
                } else {
                  console.error('Erro ao carregar configurações após adicionar coluna:', await retryResponse.text());
                }
              } else {
                console.error('Erro ao adicionar coluna:', await setupResponse.text());
              }
            } catch (setupError) {
              console.error('Erro ao chamar API para adicionar coluna:', setupError);
            }
          }
        }
      } catch (mainApiError) {
        console.error('Erro ao acessar API principal:', mainApiError);
      }

      // Tentar usar a API de fallback
      try {
        console.log('Tentando carregar configurações da API de fallback...');

        // Construir URL com parâmetros
        let fallbackUrl = '/api/users/reimbursement-settings-local?';
        if (userId) fallbackUrl += `userId=${encodeURIComponent(userId)}`;
        else if (email) fallbackUrl += `email=${encodeURIComponent(email)}`;

        const fallbackResponse = await fetch(fallbackUrl);

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('Configurações carregadas da API de fallback:', fallbackData);

          if (fallbackData.reimbursement_email_settings) {
            setEnabled(fallbackData.reimbursement_email_settings.enabled || false);
            setRecipients(fallbackData.reimbursement_email_settings.recipients || []);
            setIsLoading(false);
            return;
          }
        } else {
          console.error('Erro ao carregar configurações da API de fallback:', await fallbackResponse.text());
        }
      } catch (fallbackError) {
        console.error('Erro ao acessar API de fallback:', fallbackError);
      }

      // Se chegamos aqui, usar valores padrão
      console.log('Usando valores padrão para as configurações');
      setEnabled(false);
      setRecipients([]);
      setError('Não foi possível carregar as configurações. Usando valores padrão.');
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      setError('Erro ao carregar configurações. Por favor, tente novamente.');

      // Usar valores padrão em caso de erro
      setEnabled(false);
      setRecipients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const handleAddRecipient = () => {
    if (!newRecipient.trim()) {
      setError('O email não pode estar vazio');
      return;
    }

    if (!validateEmail(newRecipient)) {
      setError('Email inválido');
      return;
    }

    if (recipients.includes(newRecipient)) {
      setError('Este email já está na lista');
      return;
    }

    setRecipients([...recipients, newRecipient]);
    setNewRecipient('');
    setError(null);
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = [...recipients];
    newRecipients.splice(index, 1);
    setRecipients(newRecipients);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Verificar se o usuário tem permissão para salvar
    if (readOnly) {
      setError('Você não tem permissão para editar as configurações de email de reembolso.');
      toast.error('Acesso negado. Apenas administradores podem editar estas configurações.');
      setIsSaving(false);
      return;
    }

    try {
      const settings = {
        enabled,
        recipients
      };

      // Se onSave for fornecido, use-o
      if (onSave) {
        onSave(settings);
        setSuccess('Configurações de email de reembolso salvas com sucesso');
        toast.success('Configurações de email de reembolso salvas com sucesso');
        if (onClose) onClose();
        return;
      }

      // Tentar salvar via API principal
      try {
        console.log('Tentando salvar configurações na API principal...');

        const response = await fetch('/api/users/reimbursement-settings-server', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            email: email || user?.email,
            enabled,
            recipients
          }),
        });

        // Tentar ler o corpo da resposta
        let responseData;
        try {
          responseData = await response.json();
        } catch (parseError) {
          console.error('Erro ao analisar resposta:', parseError);
          responseData = { error: 'Erro ao analisar resposta do servidor' };
        }

        if (response.ok) {
          console.log('Configurações salvas com sucesso na API principal:', responseData);
          setSuccess('Configurações de email de reembolso salvas com sucesso');
          toast.success('Configurações de email de reembolso salvas com sucesso');

          if (onClose) onClose();
          setIsSaving(false);
          return;
        } else {
          console.error('Erro ao salvar configurações na API principal:', responseData.error);

          // Se o erro for relacionado à coluna não existente, tentar adicionar a coluna
          if (responseData.error && responseData.error.includes('column') && responseData.error.includes('reimbursement_email_settings') && responseData.error.includes('does not exist')) {
            console.log('Coluna reimbursement_email_settings não existe, tentando adicionar...');

            // Tentar adicionar a coluna usando a API de setup
            try {
              const setupResponse = await fetch('/api/setup-user-reimbursement-column', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              if (setupResponse.ok) {
                console.log('Coluna adicionada com sucesso, tentando salvar configurações novamente...');

                // Tentar salvar configurações novamente
                const retryResponse = await fetch('/api/users/reimbursement-settings-server', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId,
                    email: email || user?.email,
                    enabled,
                    recipients
                  }),
                });

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  console.log('Configurações salvas com sucesso após adicionar coluna:', retryData);

                  setSuccess('Configurações de email de reembolso salvas com sucesso');
                  toast.success('Configurações de email de reembolso salvas com sucesso');

                  if (onClose) onClose();
                  setIsSaving(false);
                  return;
                } else {
                  console.error('Erro ao salvar configurações após adicionar coluna:', await retryResponse.text());
                }
              } else {
                console.error('Erro ao adicionar coluna:', await setupResponse.text());
              }
            } catch (setupError) {
              console.error('Erro ao chamar API para adicionar coluna:', setupError);
            }
          }
        }
      } catch (mainApiError) {
        console.error('Erro ao acessar API principal:', mainApiError);
      }

      // Tentar salvar via API de fallback
      try {
        console.log('Tentando salvar configurações na API de fallback...');

        const fallbackResponse = await fetch('/api/users/reimbursement-settings-local', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            email: email || user?.email,
            enabled,
            recipients
          }),
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('Configurações salvas com sucesso na API de fallback:', fallbackData);

          setSuccess('Configurações de email de reembolso salvas com sucesso (modo offline)');
          toast.success('Configurações de email de reembolso salvas com sucesso (modo offline)');

          if (onClose) onClose();
          setIsSaving(false);
          return;
        } else {
          console.error('Erro ao salvar configurações na API de fallback:', await fallbackResponse.text());
        }
      } catch (fallbackError) {
        console.error('Erro ao acessar API de fallback:', fallbackError);
      }

      // Se chegamos aqui, todas as tentativas falharam
      throw new Error('Todas as tentativas de salvar configurações falharam');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
      setError('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-abz-blue"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-abz-blue flex items-center">
          <FiMail className="mr-2" /> Configurações de Email de Reembolso
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center">
          <FiAlertCircle className="mr-2" /> {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center">
          <FiCheck className="mr-2" /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {readOnly && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <FiAlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Apenas administradores podem editar as configurações de email de reembolso.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="enableUserEmailSettings"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={readOnly}
              className={`h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            <label htmlFor="enableUserEmailSettings" className="ml-2 block text-sm text-gray-900">
              Ativar configuração especial de email para este usuário
            </label>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Quando ativada, as solicitações de reembolso deste usuário serão enviadas para os emails adicionais abaixo.
          </p>
        </div>

        {enabled && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-2">Destinatários Adicionais</h3>

            <div className="space-y-2 mb-4">
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                  <span className="text-sm">{recipient}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              ))}

              {recipients.length === 0 && (
                <p className="text-sm text-gray-500 italic">Nenhum destinatário adicional configurado</p>
              )}
            </div>

            {!readOnly && (
              <div className="flex items-center">
                <input
                  type="email"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="Adicionar novo email"
                  disabled={readOnly}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                <button
                  type="button"
                  onClick={handleAddRecipient}
                  disabled={readOnly || !newRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newRecipient)}
                  className="px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-50"
                >
                  <FiPlus />
                </button>
              </div>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || readOnly}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-50"
            >
              {isSaving ? (
                <>Salvando...</>
              ) : (
                <>
                  <FiSave className="mr-2" /> Salvar Configurações
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ServerUserReimbursementSettings;
