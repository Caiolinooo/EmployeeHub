'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { ESocialCertificado } from '@/types/e-social';
import CertificadoManager from '@/components/e-social/CertificadoManager';
import ESocialNavigation from '@/components/e-social/ESocialNavigation';
import { toast } from 'react-hot-toast';
import { FiRefreshCw } from 'react-icons/fi';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

export default function ESocialCertificadosPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [certificados, setCertificados] = useState<ESocialCertificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadCertificados = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken('/api/e-social/certificados');
      if (res.ok) {
        const data = await res.json();
        setCertificados(data.certificados || []);
      } else {
        toast.error(t('eSocial.errors.certError'));
      }
    } catch {
      toast.error(t('eSocial.errors.certError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadCertificados();
  }, [user]);

  const handleUpload = async (file: File, senha: string) => {
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senha', senha);

      const res = await fetchWithToken('/api/e-social/certificados', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        toast.success(t('eSocial.certificados.upload') + ' concluído');
        loadCertificados();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('eSocial.errors.certError'));
      }
    } catch {
      toast.error(t('eSocial.errors.certError'));
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const res = await fetchWithToken(`/api/e-social/certificados/${id}/ativar`, { method: 'PUT' });
      if (res.ok) {
        toast.success('Certificado ativado');
        loadCertificados();
      } else {
        toast.error('Erro ao ativar certificado');
      }
    } catch {
      toast.error('Erro ao ativar certificado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('eSocial.certificados.delete') + '?')) return;
    try {
      const res = await fetchWithToken(`/api/e-social/certificados?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Certificado removido');
        loadCertificados();
      } else {
        toast.error('Erro ao remover certificado');
      }
    } catch {
      toast.error('Erro ao remover certificado');
    }
  };

  if (authLoading || !user) return null;

  return (
    <GtPageShell>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-5xl mx-auto gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.certificadosTitle', 'Certificados Digitais')}</h1>
            <p className="text-sm text-gray-500">{t('eSocial.certificados.title', 'Certificados A1 ou A3 para assinatura digital de eventos')}</p>
          </div>
          <button
            onClick={loadCertificados}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border rounded-md hover:bg-gray-50"
          >
            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="shrink-0">
          <ESocialNavigation />
        </div>

        {/* Manager Component */}
        <div className={GT_PAGE_SCROLLPORT_CLASS}>
          <CertificadoManager
            certificados={certificados}
            loading={loading}
            onUpload={handleUpload}
            onSetActive={handleSetActive}
            onDelete={handleDelete}
            uploadLoading={uploadLoading}
          />
        </div>
      </div>
    </GtPageShell>
  );
}
