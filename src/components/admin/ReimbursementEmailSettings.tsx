'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiPlus, FiTrash2, FiMail, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

interface ReimbursementEmailSettingsProps {
  initialSettings?: {
    enableDomainRule: boolean;
    recipients: string[];
  };
  onSave: (settings: {
    enableDomainRule: boolean;
    recipients: string[];
  }) => Promise<boolean>;
}

const ReimbursementEmailSettings: React.FC<ReimbursementEmailSettingsProps> = ({
  initialSettings,
  onSave
}) => {
  const { t } = useI18n();
  const [enableDomainRule, setEnableDomainRule] = useState(initialSettings?.enableDomainRule || false);
  const [recipients, setRecipients] = useState<string[]>(initialSettings?.recipients || ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setEnableDomainRule(initialSettings.enableDomainRule);
      setRecipients(initialSettings.recipients || []);
    }
  }, [initialSettings]);

  const validateEmail = (email: string): boolean => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const handleAddRecipient = () => {
    if (!newRecipient.trim()) {
      setError({t('components.oEmailNaoPodeEstarVazio')});
      return;
    }

    if (!validateEmail(newRecipient)) {
      setError({t('components.emailInvalido')});
      return;
    }

    if (recipients.includes(newRecipient)) {
      setError({t('components.esteEmailJaEstaNaLista')});
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

    try {
      const settings = {
        enableDomainRule,
        recipients
      };

      // Tentar salvar até 3 vezes em caso de erro
      let success = false;
      let attempts = 0;
      let lastError = null;

      while (!success && attempts < 3) {
        attempts++;
        try {
          console.log({t('components.tentativaAttemptsDeSalvarConfiguracoes')});
          success = await onSave(settings);

          if (success) {
            console.log({t('components.configuracoesSalvasComSucesso')});
            break;
          } else {
            console.error(`Falha na tentativa ${attempts}`);
            // Aguardar 1 segundo antes de tentar novamente
            if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err) {
          lastError = err;
          console.error(`Erro na tentativa ${attempts}:`, err);
          // Aguardar 1 segundo antes de tentar novamente
          if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (success) {
        toast.success({t('components.configuracoesDeEmailDeReembolsoSalvasComSucesso')});
      } else {
        console.error('Todas as tentativas falharam');
        toast.error({t('components.erroAoSalvarConfiguracoes')});

        if (lastError) {
          const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
          setError({t('components.erroAoSalvarConfiguracoesErrormessageTenteNovament')});
        } else {
          setError({t('components.erroAoSalvarConfiguracoesTenteNovamente')});
        }

        // Mostrar mensagem com instruções para correção manual
        toast.error(
          {t('components.erroAoSalvarConfiguracoesVerifiqueADocumentacaoPar')},
          { duration: 6000 }
        );
      }
    } catch (error) {
      console.error({t('components.erroAoSalvarConfiguracoes')}, error);
      toast.error({t('components.erroAoSalvarConfiguracoes')});
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError({t('components.erroAoSalvarConfiguracoesErrormessageTenteNovament')});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-abz-blue mb-4 flex items-center">
        <FiMail className="mr-2" /> Configurações de Email de Reembolso
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center">
          <FiAlertCircle className="mr-2" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="enableDomainRule"
              checked={enableDomainRule}
              onChange={(e) => setEnableDomainRule(e.target.checked)}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="enableDomainRule" className="ml-2 block text-sm text-gray-900">
              Ativar regra especial para emails com domínio @groupabz.com
            </label>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Quando ativada, esta regra enviará automaticamente os formulários de reembolso para os emails adicionais abaixo quando o solicitante tiver um email com o domínio @groupabz.com.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-2">Destinatários Adicionais</h3>

          <div className="space-y-2 mb-4">
            {recipients.map((recipient, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <span className="text-sm">{recipient}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}

            {recipients.length === 0 && (
              <p className="text-sm text-gray-500 italic">Nenhum destinatário adicional configurado</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder={t('admin.addNewEmail', 'Adicionar novo email')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            />
            <button
              type="button"
              onClick={handleAddRecipient}
              className="px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              <FiPlus />
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
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
      </form>
    </div>
  );
};

export default ReimbursementEmailSettings;
