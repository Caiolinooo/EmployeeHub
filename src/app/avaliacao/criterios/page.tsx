'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiFileText, FiArrowLeft, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';

interface Criterio {
  id: number;
  nome: string;
  descricao: string;
  categoria: string;
  peso: number;
  pontuacaoMaxima: number;
  ativo: boolean;
}

export default function CriteriosPage() {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();

  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    peso: '1.0',
    pontuacaoMaxima: '5'
  });

  // Carregar critérios
  useEffect(() => {
    async function loadCriterios() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/avaliacao-desempenho/criterios');
        if (!response.ok) {
          throw new Error('Erro ao carregar critérios');
        }
        const data = await response.json();
        setCriterios(data);
      } catch (error) {
        console.error('Erro ao carregar critérios:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    loadCriterios();
  }, []);

  // Manipular mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      const response = await fetch('/api/avaliacao-desempenho/criterios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          peso: parseFloat(formData.peso),
          pontuacaoMaxima: parseInt(formData.pontuacaoMaxima),
          ativo: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar critério');
      }

      // Recarregar critérios
      const criteriosResponse = await fetch('/api/avaliacao-desempenho/criterios');
      const criteriosData = await criteriosResponse.json();
      setCriterios(criteriosData);

      // Fechar modal e limpar formulário
      setShowModal(false);
      setFormData({
        nome: '',
        descricao: '',
        categoria: '',
        peso: '1.0',
        pontuacaoMaxima: '5'
      });
    } catch (error) {
      console.error('Erro ao criar critério:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <PageHeader
          title={t('avaliacao.criterios', 'Critérios de Avaliação')}
          description={t('avaliacao.criteriosDesc', 'Configure critérios para avaliações de desempenho')}
          icon={<FiFileText className="w-8 h-8" />}
        />

        <div className="mb-4">
          <Link
            href="/avaliacao"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <FiArrowLeft className="mr-1" />
            {t('common.voltar', 'Voltar')}
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{t('avaliacao.listaCriterios', 'Lista de Critérios')}</h2>
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            onClick={() => setShowModal(true)}
            disabled={isLoading}
          >
            <FiPlus className="mr-2 -ml-1 h-5 w-5" />
            {t('avaliacao.novoCriterio', 'Novo Critério')}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
          </div>
        ) : criterios.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <FiFileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">{t('avaliacao.semCriterios', 'Nenhum critério encontrado')}</p>
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
              onClick={() => setShowModal(true)}
            >
              <FiPlus className="mr-2 -ml-1 h-5 w-5" />
              {t('avaliacao.novoCriterio', 'Novo Critério')}
            </button>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('avaliacao.nome', 'Nome')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('avaliacao.categoria', 'Categoria')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('avaliacao.peso', 'Peso')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('avaliacao.pontuacaoMaxima', 'Pontuação Máxima')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.acoes', 'Ações')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {criterios.map((criterio) => (
                    <tr key={criterio.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {criterio.nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {criterio.descricao.length > 50
                            ? `${criterio.descricao.substring(0, 50)}...`
                            : criterio.descricao}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {criterio.categoria}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {criterio.peso.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {criterio.pontuacaoMaxima}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            className="text-yellow-600 hover:text-yellow-900"
                            title={t('common.editar', 'Editar')}
                          >
                            <FiEdit className="h-5 w-5" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            title={t('common.excluir', 'Excluir')}
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal para adicionar critério */}
        {showModal && (
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <FiFileText className="h-6 w-6 text-abz-blue" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        {t('avaliacao.novoCriterio', 'Novo Critério')}
                      </h3>
                      <div className="mt-4">
                        <form onSubmit={handleSubmit}>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('avaliacao.nome', 'Nome')} *
                              </label>
                              <input
                                type="text"
                                name="nome"
                                value={formData.nome}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('avaliacao.descricao', 'Descrição')} *
                              </label>
                              <textarea
                                name="descricao"
                                value={formData.descricao}
                                onChange={handleChange}
                                rows={3}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('avaliacao.categoria', 'Categoria')} *
                              </label>
                              <input
                                type="text"
                                name="categoria"
                                value={formData.categoria}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                required
                                placeholder="Ex: Competências Técnicas"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('avaliacao.peso', 'Peso')} *
                              </label>
                              <input
                                type="number"
                                name="peso"
                                value={formData.peso}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                required
                                min="0.1"
                                max="10"
                                step="0.1"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('avaliacao.pontuacaoMaxima', 'Pontuação Máxima')} *
                              </label>
                              <input
                                type="number"
                                name="pontuacaoMaxima"
                                value={formData.pontuacaoMaxima}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                required
                                min="1"
                                max="10"
                                step="1"
                              />
                            </div>
                          </div>

                          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                            <button
                              type="submit"
                              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-abz-blue text-base font-medium text-white hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue sm:ml-3 sm:w-auto sm:text-sm"
                              disabled={isLoading}
                            >
                              {isLoading ? t('common.saving', 'Salvando...') : t('common.save', 'Salvar')}
                            </button>
                            <button
                              type="button"
                              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                              onClick={() => setShowModal(false)}
                            >
                              {t('common.cancel', 'Cancelar')}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
