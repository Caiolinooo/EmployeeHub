'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiUsers, FiPlus, FiSearch, FiEdit2, FiTrash2, FiArrowLeft } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';

export default function FuncionariosPage() {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    departamento: '',
    email: '',
    telefone: '',
    dataAdmissao: ''
  });

  // Carregar funcionários
  useEffect(() => {
    async function loadFuncionarios() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/avaliacao-desempenho/funcionarios');
        if (!response.ok) {
          throw new Error('Erro ao carregar funcionários');
        }
        const data = await response.json();
        setFuncionarios(data);
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    loadFuncionarios();
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

      const response = await fetch('/api/avaliacao-desempenho/funcionarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          ativo: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar funcionário');
      }

      // Recarregar funcionários
      const funcionariosResponse = await fetch('/api/avaliacao-desempenho/funcionarios');
      const funcionariosData = await funcionariosResponse.json();
      setFuncionarios(funcionariosData);

      // Fechar modal e limpar formulário
      setShowModal(false);
      setFormData({
        nome: '',
        cargo: '',
        departamento: '',
        email: '',
        telefone: '',
        dataAdmissao: ''
      });
    } catch (error) {
      console.error('Erro ao criar funcionário:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('avaliacao.funcionarios.title', 'Funcionários')}
        description={t('avaliacao.funcionarios.description', 'Gerencie cadastro de funcionários')}
        icon={<FiUsers className="w-8 h-8" />}
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

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full"
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
            onClick={() => setShowModal(true)}
            disabled={isLoading}
          >
            <FiPlus className="mr-2" />
            {t('avaliacao.funcionarios.addFuncionario', 'Adicionar Funcionário')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
          </div>
        ) : funcionarios.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionarios.nome')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionarios.email')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionarios.cargo')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionarios.departamento')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionarios.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funcionarios.map((funcionario, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">{funcionario.nome}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{funcionario.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{funcionario.cargo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{funcionario.departamento}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          funcionario.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {funcionario.ativo
                          ? t('avaliacao.funcionarios.ativo')
                          : t('avaliacao.funcionarios.inativo')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                        <FiEdit2 />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <FiUsers className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">{t('avaliacao.funcionarios.noFuncionarios')}</p>
          </div>
        )}
      </div>

      {/* Modal para adicionar funcionário */}
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
                    <FiUsers className="h-6 w-6 text-abz-blue" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {t('avaliacao.funcionarios.addFuncionario', 'Adicionar Funcionário')}
                    </h3>
                    <div className="mt-4">
                      <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.nome', 'Funcionário')} *
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
                              {t('avaliacao.funcionarios.cargo', 'Cargo')} *
                            </label>
                            <input
                              type="text"
                              name="cargo"
                              value={formData.cargo}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.departamento', 'Departamento')} *
                            </label>
                            <input
                              type="text"
                              name="departamento"
                              value={formData.departamento}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.email', 'E-mail')}
                            </label>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.telefone', 'Telefone')}
                            </label>
                            <input
                              type="text"
                              name="telefone"
                              value={formData.telefone}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.dataAdmissao', 'Data de Admissão')}
                            </label>
                            <input
                              type="date"
                              name="dataAdmissao"
                              value={formData.dataAdmissao}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('avaliacao.funcionarios.status', 'Status')} *
                            </label>
                            <select
                              name="status"
                              value="ativo"
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              disabled
                            >
                              <option value="ativo">{t('avaliacao.funcionarios.ativo', 'Ativo')}</option>
                              <option value="inativo">{t('avaliacao.funcionarios.inativo', 'Inativo')}</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-abz-blue text-base font-medium text-white hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue sm:ml-3 sm:w-auto sm:text-sm"
                            disabled={isLoading}
                          >
                            {isLoading ? t('common.salvando', 'Salvando...') : t('common.salvar', 'Salvar')}
                          </button>
                          <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                            onClick={() => setShowModal(false)}
                          >
                            {t('common.cancelar', 'Cancelar')}
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
    </MainLayout>
  );
}

