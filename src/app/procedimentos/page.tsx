'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiBriefcase, FiDownload, FiEye } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import LazyDocumentViewer from '@/components/LazyLoad/LazyDocumentViewer';

export default function ProcedimentosPage() {
  const { t } = useI18n();
  const [docs, setDocs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          const data = await res.json();
          const allowed = ['Logística','Compras','RH','Procedimentos'];
          setDocs((data || []).filter((d: any) => allowed.includes(d.category)));
        }
      } catch (e) {
        console.warn('Falha ao carregar procedimentos', e);
      }
    })();
  }, []);

  const closeViewer = () => setSelected(null);


  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">{t('menu.procedimentosGerais')}</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {docs.length === 0 ? (
          <div className="flex items-center justify-center text-center text-gray-500 py-12 px-6 border-2 border-dashed border-gray-300 rounded-lg">
            <div>
              <FiBriefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-abz-text-black mb-2">{t('procedimentos.documentsSoon','Documentos em preparação')}</h2>
              <p className="text-sm">{t('procedimentos.description')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((d) => (
              <div key={d.id || d.title} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start mb-3">
                  <div className="bg-abz-light-blue p-3 rounded-full mr-3">
                    <FiBriefcase className="text-abz-blue w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-abz-text-black">{d.title}</h3>
                    <p className="text-sm text-gray-500">{d.category}</p>
                  </div>
                </div>
                <p className="text-sm text-abz-text-dark mb-4">{d.description}</p>
                <div className="flex items-center gap-2 mt-4">
                  <button onClick={() => setSelected(d)} className="flex items-center px-3 py-2 bg-abz-blue text-white rounded-md hover:bg-opacity-90">
                    <FiEye className="mr-1" /> {t('policies.view')}
                  </button>
                  <a href={d.file} download className="flex items-center px-3 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200">
                    <FiDownload className="mr-1" /> {t('policies.download')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <LazyDocumentViewer title={selected.title} filePath={selected.file} onClose={closeViewer} />
      )}
    </MainLayout>
  );
}
