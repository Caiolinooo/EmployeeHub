'use client';

import React, { useState, useRef } from 'react';
import { ESocialCertificado } from '@/types/e-social';
import { useI18n } from '@/contexts/I18nContext';
import { FiUpload, FiStar, FiTrash2, FiCheck, FiFile } from 'react-icons/fi';

interface CertificadoManagerProps {
  certificados: ESocialCertificado[];
  loading: boolean;
  onUpload: (file: File, senha: string) => Promise<void>;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  uploadLoading?: boolean;
}

const statusLabel: Record<string, string> = {
  valido: 'Válido',
  expirado: 'Expirado',
  revogado: 'Revogado',
};

const statusColor: Record<string, string> = {
  valido: 'bg-emerald-100 text-emerald-800',
  expirado: 'bg-red-100 text-red-800',
  revogado: 'bg-rose-100 text-rose-800',
};

export default function CertificadoManager({ certificados, loading, onUpload, onSetActive, onDelete, uploadLoading }: CertificadoManagerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pfx' && ext !== 'p12') {
        alert(t('eSocial.certificados.onlyPfx'));
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !senha) return;
    await onUpload(selectedFile, senha);
    setSelectedFile(null);
    setSenha('');
    setShowUpload(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
        >
          <FiUpload size={16} />
          {t('eSocial.certificados.upload')}
        </button>
      </div>

      {showUpload && (
        <div className="bg-gray-50 border rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-gray-800">{t('eSocial.certificados.uploadNew')}</h3>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pfx,.p12"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-abz-blue file:text-white hover:file:bg-abz-blue-dark"
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-gray-500">{selectedFile.name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('eSocial.certificados.password')}
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUpload(false); setSelectedFile(null); setSenha(''); }}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !senha || uploadLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-abz-blue rounded-md hover:bg-abz-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadLoading ? '...' : <><FiUpload size={14} /> {t('eSocial.certificados.upload')}</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : certificados.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {t('eSocial.certificados.noCertificates')}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="table-responsive">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('eSocial.certificados.name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('eSocial.certificados.issuer')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('eSocial.certificados.validUntil')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('eSocial.certificados.status')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('eSocial.certificados.active')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {certificados.map((cert) => (
                <tr key={cert.id} className={`hover:bg-gray-50 ${cert.ativo ? 'bg-emerald-50/50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FiFile className="text-gray-400" size={16} />
                      <span className="text-sm font-medium text-gray-800">{cert.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {cert.emissor || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {cert.valido_ate ? new Date(cert.valido_ate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[cert.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabel[cert.status] || cert.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {cert.ativo && <FiCheck className="inline text-emerald-600" size={18} />}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!cert.ativo && (
                        <button
                          onClick={() => onSetActive(cert.id)}
                          className="tap-target inline-flex items-center justify-center text-gray-400 hover:text-amber-600 transition-colors"
                          title={t('eSocial.certificados.setActive')}
                        >
                          <FiStar size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(cert.id)}
                        className="tap-target inline-flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors"
                        title={t('eSocial.certificados.delete')}
                      >
                        <FiTrash2 size={16} />
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
    </div>
  );
}
