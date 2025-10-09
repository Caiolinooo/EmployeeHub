'use client';

import React, { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiUsers, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';

export default function NovoFuncionarioPage() {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cargo: '',
    departamento: '',
    dataAdmissao: '',
    status: 'ativo'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulação de envio
    setTimeout(() => {
      console.log('Form submitted:', formData);
      setIsSubmitting(false);
      // Redirecionar para a página de funcionários após o envio
      window.location.href = '/avaliacao/funcionarios';
    }, 1500);
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <Link href="/avaliacao/funcionarios" className="text-abz-blue hover:underline flex items-center">
          <FiArrowLeft className="mr-2" />
          {t('common.back')}
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-abz-blue text-white p-6">
          <div className="flex items-center">
            <FiUsers className="w-8 h-8 mr-3" />
            <h1 className="text-2xl font-bold">{t('avaliacao.funcionarios.addFuncionario')}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.funcionarios.nome')} *
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
                {t('avaliacao.funcionarios.email')} *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.funcionarios.cargo')} *
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
                {t('avaliacao.funcionarios.departamento')} *
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.funcionarios.dataAdmissao')}
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
                {t('avaliacao.funcionarios.status')} *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="ativo">{t('avaliacao.funcionarios.ativo')}</option>
                <option value="inativo">{t('avaliacao.funcionarios.inativo')}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/avaliacao/funcionarios"
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

