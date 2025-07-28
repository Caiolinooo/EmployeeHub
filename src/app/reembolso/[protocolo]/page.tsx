'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiFileText, FiDollarSign, FiUser, FiInfo, FiDownload } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';

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

export default function ReimbursementDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const { user, isAdmin, isManager } = useSupabaseAuth();

  const [reimbursement, setReimbursement] = useState<Reimbursement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const protocolo = params?.protocolo as string;

  useEffect(() => {
    const fetchReimbursementDetails = async () => {
      if (!protocolo) {
        setError('Protocolo não fornecido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`Buscando detalhes do reembolso com protocolo: ${protocolo}`);

        const response = await fetch(`/api/reembolso/${protocolo}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Resposta de erro:', errorText);
          throw new Error(`Erro ao carregar detalhes do reembolso: ${response.status}`);
        }

        const data = await response.json();
        console.log('Detalhes do reembolso recebidos:', data);

        setReimbursement(data);
      } catch (err) {
        console.error('Erro ao carregar detalhes do reembolso:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        toast.error('Erro ao carregar detalhes do reembolso. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchReimbursementDetails();
  }, [protocolo]);

  // Função para formatar valor monetário
  const formatCurrency = (value?: number) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: reimbursement?.moeda || 'BRL'
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

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-abz-blue hover:text-abz-blue-dark"
          >
            <FiArrowLeft className="mr-2" />
            {t('common.back', 'Voltar')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">
              <p>{error}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
              >
                {t('common.back', 'Voltar')}
              </button>
            </div>
          ) : reimbursement ? (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiFileText className="mr-3 text-abz-blue" />
                Detalhes do Reembolso
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                    <FiUser className="mr-2 text-abz-blue" />
                    Informações do Solicitante
                  </h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Nome:</span> {reimbursement.nome}</p>
                    <p><span className="font-medium">Email:</span> {reimbursement.email}</p>
                    {reimbursement.telefone && (
                      <p><span className="font-medium">Telefone:</span> {reimbursement.telefone}</p>
                    )}
                    {reimbursement.cpf && (
                      <p><span className="font-medium">CPF:</span> {reimbursement.cpf}</p>
                    )}
                    {reimbursement.cargo && (
                      <p><span className="font-medium">Cargo:</span> {reimbursement.cargo}</p>
                    )}
                    {(reimbursement.centroCusto || reimbursement.centro_custo) && (
                      <p><span className="font-medium">Centro de Custo:</span> {reimbursement.centroCusto || reimbursement.centro_custo}</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                    <FiDollarSign className="mr-2 text-abz-blue" />
                    Informações do Reembolso
                  </h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Protocolo:</span> {reimbursement.protocolo}</p>
                    <p><span className="font-medium">Tipo:</span> {reimbursement.tipoReembolso || reimbursement.tipo_reembolso}</p>
                    <p><span className="font-medium">Valor:</span> {formatCurrency(reimbursement.valorTotal || reimbursement.valor_total)}</p>
                    <p><span className="font-medium">Data:</span> {formatDate(reimbursement.data || reimbursement.created_at)}</p>
                    <p><span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full
                        ${reimbursement.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                          reimbursement.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                        {reimbursement.status.charAt(0).toUpperCase() + reimbursement.status.slice(1)}
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
                    Descrição
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700">{reimbursement.descricao}</p>
                  </div>
                </div>
              )}

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
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>Reembolso não encontrado</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
