'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiBookOpen, FiDownload, FiEye } from 'react-icons/fi';
import LazyDocumentViewer from '@/components/LazyLoad/LazyDocumentViewer';
import { useI18n } from '@/contexts/I18nContext';
import { measure } from '@/lib/performance';

const MANUAL_PDF_URL = '/documentos/manuais/Manual de logística.pdf';

// Simplified data structure for consistency - will be populated with translations
const getManualDoc = (t: (key: string) => string) => ({
    id: 'manual-logistica',
    title: t('manual.title'),
    description: t('manual.description'),
    file: MANUAL_PDF_URL
});

export default function ManualPage() {
  const [showViewer, setShowViewer] = useState(false);
  const [docs, setDocs] = useState<Array<{id:string; title:string; description:string; file:string;}>>([]);
  const { t } = useI18n();

  // Get translated manual document with performance measurement
  const manualDoc = measure('getManualDoc', () => getManualDoc(t), { locale: t('locale.code', 'pt-BR') });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/documents?category=' + encodeURIComponent('Manual'));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            setDocs(data.map((d: any) => ({ id: d.id || d.title, title: d.title, description: d.description, file: d.file })));
          }
        }
      } catch (e) {
        console.warn('Falha ao carregar documentos do Manual, usando fallback.', e);
      }
    })();
  }, []);

  const openViewer = () => setShowViewer(true);
  const closeViewer = () => setShowViewer(false);

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">{t('manual.title')}</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
         <h2 className="text-2xl font-semibold text-abz-text-black mb-6">{t('manual.mainDocument', 'Documento Principal')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(docs.length ? docs : [manualDoc]).map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start mb-3">
                <div className="bg-abz-light-blue p-3 rounded-full mr-3">
                  <FiBookOpen className="text-abz-blue w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-abz-text-black">{doc.title}</h3>
                </div>
              </div>
              <p className="text-sm text-abz-text-dark mb-4">{('description' in doc && (doc as any).description) || manualDoc.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => { setShowViewer(true); }} className="inline-flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors text-sm font-medium shadow-sm">
                  <FiEye className="mr-1.5" />{t('manual.view')}
                </button>
                <a href={(doc as any).file} download className="inline-flex items-center px-4 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200 transition-colors text-sm font-medium shadow-sm">
                  <FiDownload className="mr-1.5" />{t('manual.download')}
                </a>
              </div>
              {showViewer && (
                <LazyDocumentViewer title={doc.title} filePath={(doc as any).file} onClose={() => setShowViewer(false)} accentColor="text-abz-blue" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Visualizador de documento usando o componente lazy-loaded */}
      {showViewer && (
        <LazyDocumentViewer
          title={manualDoc.title}
          filePath={manualDoc.file}
          onClose={closeViewer}
          accentColor="text-abz-blue"
        />
      )}
    </MainLayout>
  );
}