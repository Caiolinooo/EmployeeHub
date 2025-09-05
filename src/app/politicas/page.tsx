'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiFileText, FiDownload, FiEye } from 'react-icons/fi';
import LazyDocumentViewer from '@/components/LazyLoad/LazyDocumentViewer';
import { useI18n } from '@/contexts/I18nContext';
import { measure } from '@/lib/performance';

// Lista de políticas disponíveis - serão traduzidas dinamicamente
const getPolicies = (t: (key: string, defaultValue?: string) => string) => [
  {
    id: 'hse-pt',
    title: t('policies.hse.title', 'Política de HSE'),
    description: t('policies.hse.description', 'Diretrizes de Saúde, Segurança e Meio Ambiente do ABZ Group'),
    language: t('common.portuguese', 'Português'),
    category: 'HSE',
    file: '/documentos/politicas/PL-HSE-R0 - Política de HSE_ABZ Group-PORT.pdf'
  },
  {
    id: 'qua-pt',
    title: t('policies.quality.title', 'Política da Qualidade'),
    description: t('policies.quality.description', 'Política de Qualidade e Gestão do ABZ Group'),
    language: t('common.portuguese', 'Português'),
    category: 'Qualidade',
    file: '/documentos/politicas/PL-QUA-R8 - Politica da Qualidade_ABZ Group-PORT.pdf'
  },
  {
    id: 'qua-en',
    title: t('policies.quality.titleEn', 'Quality Policy'),
    description: t('policies.quality.descriptionEn', 'ABZ Group Quality Management Policy'),
    language: t('common.english', 'English'),
    category: 'Qualidade',
    file: '/documentos/politicas/PL-QUA-a-R8 - Quality Policy_ABZ Group-ENG.pdf'
  },
];

export default function PoliticasPage() {
  const { t } = useI18n();
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);

  // Carregar documentos da categoria Políticas/HSE/Qualidade
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          const data = await res.json();
          const allowed = ['HSE','Qualidade','Políticas'];
          setDocs((data || []).filter((d: any) => allowed.includes(d.category)));
        }
      } catch (e) {
        console.warn('Falha ao carregar documentos de políticas, usando fallback.', e);
      }
    })();
  }, []);

  // Fallback para políticas hardcoded se não houver docs
  const politicas = (docs.length ? docs.map((d: any) => ({ id: d.id || d.title, title: d.title, description: d.description, language: d.language || '', category: d.category, file: d.file })) : measure('getPolicies', () => getPolicies(t), { locale: t('locale.code', 'pt-BR') }));

  // Função para abrir a visualização do documento
  const openPolicyViewer = (policyId: string) => {
    setSelectedPolicy(policyId);
  };

  // Função para fechar a visualização do documento
  const closePolicyViewer = () => {
    setSelectedPolicy(null);
  };

  // Encontra os detalhes da política selecionada
  const selectedPolicyDetails = politicas.find(p => p.id === selectedPolicy);

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">{t('policies.title')}</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-abz-text-black mb-6">{t('policies.documentsTitle', 'Documentos de Políticas')}</h2>

        {/* Filtros (opcional - pode ser expandido no futuro) */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button className="px-4 py-2 rounded-md bg-abz-blue text-white font-medium">
            {t('common.all')}
          </button>
          <button className="px-4 py-2 rounded-md bg-gray-100 text-abz-text-dark hover:bg-gray-200">
            HSE
          </button>
          <button className="px-4 py-2 rounded-md bg-gray-100 text-abz-text-dark hover:bg-gray-200">
            {t('policies.quality.category', 'Qualidade')}
          </button>
        </div>

        {/* Lista de políticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {politicas.map((politica) => (
            <div
              key={politica.id}
              className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start mb-3">
                <div className="bg-abz-light-blue p-3 rounded-full mr-3">
                  <FiFileText className="text-abz-blue w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-abz-text-black">{politica.title}</h3>
                  <p className="text-sm text-gray-500">{politica.language}</p>
                </div>
              </div>

              <p className="text-sm text-abz-text-dark mb-4">
                {politica.description}
              </p>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openPolicyViewer(politica.id)}
                  className="flex items-center px-3 py-2 bg-abz-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
                >
                  <FiEye className="mr-1" />
                  {t('policies.view')}
                </button>
                <a
                  href={politica.file}
                  download
                  className="flex items-center px-3 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200 transition-colors"
                >
                  <FiDownload className="mr-1" />
                  {t('policies.download')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visualizador de documento usando o componente lazy-loaded */}
      {selectedPolicy && selectedPolicyDetails && (
        <LazyDocumentViewer
          title={selectedPolicyDetails.title}
          filePath={selectedPolicyDetails.file}
          onClose={closePolicyViewer}
          accentColor="text-abz-blue"
        />
      )}
    </MainLayout>
  );
}