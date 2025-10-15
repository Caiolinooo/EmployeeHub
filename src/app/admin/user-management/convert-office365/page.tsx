'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Declaração de tipo para window
declare global {
  interface Window {
    convertOffice365File?: (file: File) => Promise<any>;
  }
}
import { useI18n } from '@/contexts/I18nContext';
import { FiUpload, FiDownload, FiFile, FiCheck, FiAlertCircle, FiLoader, FiInfo } from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';
import Script from 'next/script';

export default function ConvertOffice365Page() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedFile, setConvertedFile] = useState<{
    url: string;
    filename: string;
    totalRecords: number;
    validRecords: number;
  } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);

  // Configuração do dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setError(null);
    setConvertedFile(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Converter arquivo
  const convertFile = async () => {
    if (!file) {
      setError('Selecione um arquivo para converter');
      return;
    }

    if (!scriptLoaded || !window.convertOffice365File) {
      setError(t('admin.oScriptDeConversaoNaoFoiCarregadoRecarregueAPagina'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.convertOffice365File(file);
      setConvertedFile(result);
    } catch (err: any) {
      console.error('Erro ao converter arquivo:', err);
      setError(err.message || 'Erro ao converter o arquivo. Verifique o formato.');
    } finally {
      setIsLoading(false);
    }
  };

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (convertedFile?.url) {
        URL.revokeObjectURL(convertedFile.url);
      }
    };
  }, [convertedFile]);

  return (
    <div className="space-y-6">
      {/* Carregar script de conversão */}
      <Script
        src="/scripts/convert-office365.js"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError(t('admin.erroAoCarregarOScriptDeConversao'))}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Converter Planilha do Office 365</h1>
          <p className="mt-1 text-sm text-gray-500">
            Converta planilhas exportadas do Office 365 para o formato de importação do sistema
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <FiInfo className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Instruções para Conversão
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Exporte a lista de usuários do Office 365 Admin Center ou do Azure AD</li>
                <li>Selecione o arquivo exportado (.xlsx) para converter</li>
                <li>O sistema tentará mapear automaticamente os campos comuns (nome, email, telefone, etc.)</li>
                <li>Após a conversão, você poderá baixar o arquivo no formato esperado pelo sistema</li>
                <li>Use o arquivo convertido na página de importação de usuários</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Converter Arquivo</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center">
            <FiAlertCircle className="mr-2" />
            {error}
          </div>
        )}

        {/* Dropzone para upload */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-abz-blue bg-blue-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-abz-blue hover:bg-blue-50'
          }`}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="flex flex-col items-center">
              <FiFile className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(typeof file.size === 'number' ? (file.size / 1024 / 1024).toFixed(2) : '0.00')} MB
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setConvertedFile(null);
                }}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                Remover
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center">
              <FiLoader className="h-10 w-10 text-abz-blue mb-2 animate-spin" />
              <p className="text-sm text-gray-500">Processando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <FiUpload className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-900">
                {isDragActive
                  ? 'Solte o arquivo aqui'
                  : 'Arraste e solte um arquivo ou clique para selecionar'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tamanho máximo: 10MB (.xlsx, .xls)
              </p>
            </div>
          )}
        </div>

        {/* Botão de conversão */}
        {file && !convertedFile && !isLoading && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={convertFile}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark"
            >
              Converter Arquivo
            </button>
          </div>
        )}

        {/* Resultado da conversão */}
        {convertedFile && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center mb-4">
              <FiCheck className="h-5 w-5 text-green-500 mr-2" />
              <h3 className="text-lg font-medium text-green-800">Conversão Concluída</h3>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700">
                <strong>Registros processados:</strong> {convertedFile.totalRecords}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Registros válidos:</strong> {convertedFile.validRecords}
              </p>
              {convertedFile.totalRecords !== convertedFile.validRecords && (
                <p className="text-sm text-yellow-600 mt-1">
                  <FiAlertCircle className="inline mr-1" />
                  {convertedFile.totalRecords - convertedFile.validRecords} registros foram ignorados por não terem nome ou contato.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <a
                href={convertedFile.url}
                download={convertedFile.filename}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 flex items-center"
              >
                <FiDownload className="mr-2" />
                Baixar Arquivo Convertido
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
