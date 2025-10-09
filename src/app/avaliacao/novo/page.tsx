'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { FiBarChart2, FiPlus, FiTrash, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';

export default function NovaAvaliacaoPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionar para a página correta
    router.push('/avaliacao/nova');
  }, [router]);
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const [formData, setFormData] = useState({
    funcionarioId: '',
    avaliadorId: '',
    periodo: 'trimestral',
    dataAvaliacao: new Date().toISOString().split('T')[0],
    dataProximaAvaliacao: '',
    comentarios: '',
  });
  const [criterios, setCriterios] = useState<Array<{
    id: string;
    nome: string;
    peso: number;
    nota: number;
    notaMaxima: number;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddCriterio = () => {
    const newId = `temp-${Date.now()}`;
    setCriterios([
      ...criterios,
      { id: newId, nome: '', peso: 1, nota: 0, notaMaxima: 5 }
    ]);
  };

  const handleCriterioChange = (id: string, field: string, value: any) => {
    setCriterios(
      criterios.map((criterio) =>
        criterio.id === id ? { ...criterio, [field]: value } : criterio
      )
    );
  };

  const handleRemoveCriterio = (id: string) => {
    setCriterios(criterios.filter((criterio) => criterio.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulação de envio
    setTimeout(() => {
      console.log('Form submitted:', { ...formData, criterios });
      setIsSubmitting(false);
      // Redirecionar para a página de avaliações após o envio
      window.location.href = '/avaliacao';
    }, 1500);
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <Link href="/avaliacao" className="text-abz-blue hover:underline flex items-center">
          <FiArrowLeft className="mr-2" />
          {t('common.back')}
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-abz-blue text-white p-6">
          <div className="flex items-center">
            <FiBarChart2 className="w-8 h-8 mr-3" />
            <h1 className="text-2xl font-bold">{t('avaliacao.createAvaliacao')}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.funcionario')} *
              </label>
              <select
                name="funcionarioId"
                value={formData.funcionarioId}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">{t('common.selectOption')}</option>
                <option value="1">João Silva</option>
                <option value="2">Maria Souza</option>
                <option value="3">Pedro Santos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.avaliador')} *
              </label>
              <select
                name="avaliadorId"
                value={formData.avaliadorId}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">{t('common.selectOption')}</option>
                <option value="4">Carlos Oliveira</option>
                <option value="5">Ana Pereira</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.periodo')} *
              </label>
              <select
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="mensal">{t('avaliacao.periodoOptions.mensal')}</option>
                <option value="trimestral">{t('avaliacao.periodoOptions.trimestral')}</option>
                <option value="semestral">{t('avaliacao.periodoOptions.semestral')}</option>
                <option value="anual">{t('avaliacao.periodoOptions.anual')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.dataAvaliacao')} *
              </label>
              <input
                type="date"
                name="dataAvaliacao"
                value={formData.dataAvaliacao}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.dataProximaAvaliacao')}
              </label>
              <input
                type="date"
                name="dataProximaAvaliacao"
                value={formData.dataProximaAvaliacao}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t('avaliacao.criterios')}</h2>
              <button
                type="button"
                onClick={handleAddCriterio}
                className="bg-abz-blue hover:bg-abz-blue-dark text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <FiPlus className="mr-1" />
                {t('avaliacao.criterio.addCriterio')}
              </button>
            </div>

            {criterios.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.nome')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.peso')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.nota')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {criterios.map((criterio) => (
                      <tr key={criterio.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={criterio.nome}
                            onChange={(e) =>
                              handleCriterioChange(criterio.id, 'nome', e.target.value)
                            }
                            className="border border-gray-300 rounded-md px-3 py-1 w-full"
                            placeholder={t('avaliacao.criterio.nome')}
                            required
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={criterio.peso}
                            onChange={(e) =>
                              handleCriterioChange(criterio.id, 'peso', parseInt(e.target.value))
                            }
                            className="border border-gray-300 rounded-md px-3 py-1"
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0"
                              max={criterio.notaMaxima}
                              value={criterio.nota}
                              onChange={(e) =>
                                handleCriterioChange(
                                  criterio.id,
                                  'nota',
                                  parseInt(e.target.value)
                                )
                              }
                              className="border border-gray-300 rounded-md px-3 py-1 w-16"
                            />
                            <span className="mx-2">/</span>
                            <select
                              value={criterio.notaMaxima}
                              onChange={(e) =>
                                handleCriterioChange(
                                  criterio.id,
                                  'notaMaxima',
                                  parseInt(e.target.value)
                                )
                              }
                              className="border border-gray-300 rounded-md px-3 py-1"
                            >
                              <option value="5">5</option>
                              <option value="10">10</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterio(criterio.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-500">{t('avaliacao.criterio.noCriterios')}</p>
                <button
                  type="button"
                  onClick={handleAddCriterio}
                  className="mt-4 bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded"
                >
                  {t('avaliacao.criterio.addCriterio')}
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('avaliacao.comentarios')}
            </label>
            <textarea
              name="comentarios"
              value={formData.comentarios}
              onChange={handleChange}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder={t('avaliacao.comentarios')}
            ></textarea>
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/avaliacao"
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
            >
              {t('common.cancel')}
            </Link>
            <button
              type="submit"
              className={`bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

