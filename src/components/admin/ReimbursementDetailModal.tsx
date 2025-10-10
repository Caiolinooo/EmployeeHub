'use client';

import React, { useState } from 'react';
import { FiX, FiCheck, FiDownload, FiFileText, FiDollarSign, FiUser, FiCalendar, FiClock, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

interface Reimbursement {
  id: string;
  protocolo: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  cargo?: string;
  centroCusto?: string;
  centro_custo?: string;
  data: string;
  valorTotal?: number;
  valor_total?: number;
  moeda?: string;
  tipoReembolso?: string;
  tipo_reembolso?: string;
  descricao?: string;
  metodoPagamento?: string;
  metodo_pagamento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pixTipo?: string;
  pix_tipo?: string;
  pixChave?: string;
  pix_chave?: string;
  comprovantes?: Array<{
    nome: string;
    url: string;
    tipo: string;
    tamanho: number;
  }>;
  observacoes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  historico?: Array<{
    data: string;
    status: string;
    observacao: string;
  }>;
}

interface ReimbursementDetailModalProps {
  reimbursement: Reimbursement;
  onClose: () => void;
  onStatusChange?: () => void;
  readOnly?: boolean;
  onApprove?: (protocolo: string) => void;
  isOpen?: boolean;
}

const ReimbursementDetailModal: React.FC<ReimbursementDetailModalProps> = ({
  isOpen = true,
  onClose,
  reimbursement,
  onApprove,
  readOnly = false,
  onStatusChange
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  if (!isOpen) return null;

  // Função para formatar valor monetário
  const formatCurrency = (value?: number) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: reimbursement.moeda || 'BRL'
    }).format(value);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para baixar comprovante
  const handleDownloadAttachment = async (url: string, fileName: string) => {
    try {
      console.log(`Iniciando download de anexo: ${url}, nome: ${fileName}`);

      // Importar a função de download de anexos
      const { downloadAttachment, triggerDownload } = await import('@/lib/fileUtils');

      // Baixar o anexo
      const blob = await downloadAttachment(url, fileName);

      // Verificar se o download foi bem-sucedido
      if (!blob) {
        throw new Error('Não foi possível baixar o arquivo após várias tentativas');
      }

      // Iniciar o download no navegador
      triggerDownload(blob, fileName);

      console.log('Arquivo baixado com sucesso');
      toast.success('Arquivo baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao baixar comprovante:', err);
      toast.error('Erro ao baixar comprovante. Tente novamente.');
    }
  };

  // Função para rejeitar com motivo
  const handleRejectWithReason = async () => {
    // Validar se o motivo foi informado
    if (!rejectReason.trim()) {
      console.log('Tentativa de rejeição sem motivo');
      toast.error('Por favor, informe o motivo da rejeição.');
      return;
    }

    console.log(`Iniciando rejeição do reembolso ${reimbursement.protocolo}`);
    console.log(`Motivo da rejeição: ${rejectReason}`);

    setLoading(true);

    try {
      // Verificar se temos o protocolo
      if (!reimbursement.protocolo) {
        throw new Error('Protocolo de reembolso não encontrado');
      }

      console.log(`Rejeitando reembolso ${reimbursement.protocolo} com motivo: ${rejectReason}`);

      // Fazer a rejeição diretamente via API (não chamar onReject do pai para evitar duplicação)
      const response = await fetch(`/api/reembolso/${reimbursement.protocolo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejeitado',
          observacao: rejectReason
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resposta de erro:', errorText);
        throw new Error(`Erro ao rejeitar solicitação: ${response.status}`);
      }

      console.log('Reembolso rejeitado com sucesso via API');

      // Chamar onStatusChange se fornecido
      if (typeof onStatusChange === 'function') {
        try {
          await Promise.resolve(onStatusChange());
          console.log('Função onStatusChange executada com sucesso');
        } catch (statusError) {
          console.error('Erro na função onStatusChange:', statusError);
          // Não propagar este erro, pois a rejeição já foi realizada
        }
      }

      // Limpar o formulário e fechar o modal
      setShowRejectForm(false);
      setRejectReason('');

      // Mostrar mensagem de sucesso
      toast.success('Reembolso rejeitado com sucesso!');

      // Fechar o modal
      if (typeof onClose === 'function') {
        onClose();
      }
    } catch (error) {
      console.error('Erro ao rejeitar reembolso:', error);
      toast.error('Erro ao rejeitar reembolso. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <FiFileText className="mr-2" />
            {t('reimbursement.modal.title', 'Detalhes do Reembolso')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-grow">
          {/* Informações principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <FiUser className="mr-2 text-abz-blue" />
                {t('reimbursement.modal.applicantInfo', 'Informações do Solicitante')}
              </h3>
              <div className="space-y-2">
                <p><span className="font-medium">{t('reimbursement.modal.name', 'Nome')}:</span> {reimbursement.nome}</p>
                <p><span className="font-medium">{t('reimbursement.modal.email', 'Email')}:</span> {reimbursement.email}</p>
                {reimbursement.telefone && (
                  <p><span className="font-medium">{t('reimbursement.modal.phone', 'Telefone')}:</span> {reimbursement.telefone}</p>
                )}
                {reimbursement.cpf && (
                  <p><span className="font-medium">{t('reimbursement.modal.cpf', 'CPF')}:</span> {reimbursement.cpf}</p>
                )}
                {reimbursement.cargo && (
                  <p><span className="font-medium">{t('reimbursement.modal.position', 'Cargo')}:</span> {reimbursement.cargo}</p>
                )}
                {(reimbursement.centroCusto || reimbursement.centro_custo) && (
                  <p><span className="font-medium">{t('reimbursement.modal.costCenter', 'Centro de Custo')}:</span> {reimbursement.centroCusto || reimbursement.centro_custo}</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                <FiDollarSign className="mr-2 text-abz-blue" />
                {t('reimbursement.modal.reimbursementInfo', 'Informações do Reembolso')}
              </h3>
              <div className="space-y-2">
                <p><span className="font-medium">{t('reimbursement.modal.protocol', 'Protocolo')}:</span> {reimbursement.protocolo}</p>
                <p><span className="font-medium">{t('reimbursement.modal.type', 'Tipo')}:</span> {reimbursement.tipoReembolso || reimbursement.tipo_reembolso}</p>
                <p><span className="font-medium">{t('reimbursement.modal.value', 'Valor')}:</span> {formatCurrency(reimbursement.valorTotal || reimbursement.valor_total)}</p>
                <p><span className="font-medium">{t('reimbursement.modal.date', 'Data')}:</span> {formatDate(reimbursement.data || reimbursement.created_at)}</p>
                <p><span className="font-medium">{t('reimbursement.modal.status', 'Status')}:</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full
                    ${reimbursement.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                      reimbursement.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'}`}>
                    {reimbursement.status}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Descrição */}
          {reimbursement.descricao && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center">
                <FiInfo className="mr-2 text-abz-blue" />
                {t('reimbursement.modal.description', 'Descrição')}
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">{reimbursement.descricao}</p>
              </div>
            </div>
          )}

          {/* Método de Pagamento */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center">
              <FiDollarSign className="mr-2 text-abz-blue" />
              {t('reimbursement.modal.paymentMethod', 'Método de Pagamento')}
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p><span className="font-medium">{t('reimbursement.modal.method', 'Método')}:</span> {reimbursement.metodoPagamento || reimbursement.metodo_pagamento || t('reimbursement.modal.notInformed', 'Não informado')}</p>

              {(reimbursement.metodoPagamento === 'deposito' || reimbursement.metodo_pagamento === 'deposito') && (
                <div className="mt-2 ml-4">
                  <p><span className="font-medium">Banco:</span> {reimbursement.banco || 'Não informado'}</p>
                  <p><span className="font-medium">Agência:</span> {reimbursement.agencia || 'Não informado'}</p>
                  <p><span className="font-medium">Conta:</span> {reimbursement.conta || 'Não informado'}</p>
                </div>
              )}

              {(reimbursement.metodoPagamento === 'pix' || reimbursement.metodo_pagamento === 'pix') && (
                <div className="mt-2 ml-4">
                  <p><span className="font-medium">Tipo de Chave:</span> {reimbursement.pixTipo || reimbursement.pix_tipo || 'Não informado'}</p>
                  <p><span className="font-medium">Chave:</span> {reimbursement.pixChave || reimbursement.pix_chave || 'Não informado'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Comprovantes */}
          {reimbursement.comprovantes && reimbursement.comprovantes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center">
                <FiFileText className="mr-2 text-abz-blue" />
                Comprovantes
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <ul className="divide-y divide-gray-200">
                  {reimbursement.comprovantes.map((comprovante, index) => (
                    <li key={index} className="py-2 flex justify-between items-center">
                      <span className="text-gray-700">{comprovante.nome}</span>
                      <button
                        onClick={() => handleDownloadAttachment(comprovante.url, comprovante.nome)}
                        className="text-abz-blue hover:text-abz-blue-dark flex items-center"
                      >
                        <FiDownload className="mr-1" />
                        Baixar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Histórico */}
          {reimbursement.historico && reimbursement.historico.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center">
                <FiClock className="mr-2 text-abz-blue" />
                Histórico
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <ul className="divide-y divide-gray-200">
                  {reimbursement.historico.map((item, index) => (
                    <li key={index} className="py-2">
                      <div className="flex items-start">
                        <div className={`mt-1 w-3 h-3 rounded-full mr-3
                          ${item.status === 'aprovado' ? 'bg-green-500' :
                            item.status === 'rejeitado' ? 'bg-red-500' :
                            'bg-yellow-500'}`}></div>
                        <div>
                          <p className="text-sm text-gray-600">{formatDate(item.data)}</p>
                          <p className="font-medium text-gray-800">{item.status}</p>
                          <p className="text-gray-700">{item.observacao}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Formulário de rejeição */}
          {showRejectForm && (
            <div className="mb-6 bg-red-50 p-4 rounded-lg border-2 border-red-300 shadow-md">
              <h3 className="text-lg font-medium text-red-800 mb-2 flex items-center">
                <FiAlertTriangle className="mr-2 text-red-600" />
                Motivo da Rejeição
              </h3>
              <p className="text-red-700 mb-3 text-sm">
                Por favor, informe o motivo da rejeição. Esta informação será enviada ao solicitante.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo da rejeição..."
                className="w-full p-3 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                rows={4}
                autoFocus
              ></textarea>
              <div className="mt-2 text-sm text-red-600">
                {!rejectReason.trim() && 'O motivo da rejeição é obrigatório'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
          {!readOnly && reimbursement.status === 'pendente' ? (
            showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                  disabled={loading}
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleRejectWithReason}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                  ) : (
                    <FiX className="mr-2" />
                  )}
                  {t('reimbursement.confirmRejection', 'Confirmar Rejeição')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    console.log('Abrindo formulário de rejeição');
                    setShowRejectForm(true);
                    // Pequeno atraso para garantir que o DOM seja atualizado
                    setTimeout(() => {
                      // Tentar focar no textarea
                      const textarea = document.querySelector(`textarea[placeholder="${t('reimbursement.rejectionReasonPlaceholder', 'Informe o motivo da rejeição...')}"]`);
                      if (textarea) {
                        (textarea as HTMLTextAreaElement).focus();
                      }
                    }, 100);
                  }}
                  className="px-4 py-2 border-2 border-red-500 text-red-700 rounded-md hover:bg-red-50 flex items-center font-medium"
                >
                  <FiX className="mr-2" />
                  Rejeitar
                </button>
                <button
                  onClick={() => {
                    if (onApprove) {
                      console.log(`Aprovando reembolso ${reimbursement.protocolo}`);
                      onApprove(reimbursement.protocolo);
                      if (onStatusChange) {
                        onStatusChange();
                      }
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <FiCheck className="mr-2" />
                  Aprovar
                </button>
              </>
            )
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReimbursementDetailModal;
