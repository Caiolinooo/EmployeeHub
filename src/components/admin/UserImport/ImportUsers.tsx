'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiFile, FiX, FiCheck, FiAlertCircle, FiLoader, FiEdit } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import ImportPreview from './ImportPreview';
import ImportProgress from './ImportProgress';
import DuplicatesModal from './DuplicatesModal';
import ImportOptions from './ImportOptions';
import FieldMapping from './FieldMapping';
import ValidationWarnings from './ValidationWarnings';
import { logImport, updateImportStatus, logImportError } from '@/lib/monitoring/importMonitoring';

// Tipos de arquivos suportados
const SUPPORTED_FORMATS = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/plain': ['.txt'], // Para arquivos WK e Dominio (geralmente são TXT)
  'application/json': ['.json'],
  'application/xml': ['.xml'],
  'text/xml': ['.xml'],
};

// Tipos de importação suportados
const IMPORT_TYPES = [
  { id: 'office365', label: 'Office 365 (XLSX)', formats: ['.xlsx'] },
  { id: 'excel', label: 'Excel (XLSX/XLS)', formats: ['.xlsx', '.xls'] },
  { id: 'csv', label: 'CSV', formats: ['.csv'] },
  { id: 'json', label: 'JSON', formats: ['.json'] },
  { id: 'xml', label: 'XML', formats: ['.xml'] },
  { id: 'totvs', label: 'TOTVS (Protheus/RM)', formats: ['.xlsx', '.csv', '.txt'] },
  { id: 'wk', label: 'WK', formats: ['.txt'] },
  { id: 'dominio', label: 'Dominio', formats: ['.txt'] },
  { id: 'custom', label: 'Personalizado', formats: ['.xlsx', '.xls', '.csv', '.txt', '.json', '.xml'] },
];

export default function ImportUsers() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<string>('excel');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [importStarted, setImportStarted] = useState<boolean>(false);
  const [showFieldMapping, setShowFieldMapping] = useState<boolean>(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState<boolean>(false);
  const [showValidationWarnings, setShowValidationWarnings] = useState<boolean>(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  const [importLogId, setImportLogId] = useState<string | null>(null);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);
  const [importOptions, setImportOptions] = useState({
    sendEmailInvites: false,
    sendSMSInvites: false,
    defaultRole: 'USER',
    skipDuplicates: true,
  });
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    success: number;
    error: number;
    skipped: number;
  }>({
    current: 0,
    total: 0,
    success: 0,
    error: 0,
    skipped: 0,
  });

  // Configuração do dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    try {
      const selectedFile = acceptedFiles[0];

      // Verificar se o arquivo é válido
      if (!selectedFile || typeof selectedFile !== 'object') {
        throw new Error({t('components.arquivoInvalido')});
      }

      // Verificar se o arquivo tem as propriedades necessárias
      if (!selectedFile.name || typeof selectedFile.size !== 'number') {
        throw new Error({t('components.arquivoComFormatoInvalido')});
      }

      setFile(selectedFile);
      setError(null);
      setIsLoading(true);

      try {
        // Processar o arquivo para preview
        const data = await processFileForPreview(selectedFile, importType);
        setPreviewData(data);

        // Mostrar avisos de validação se houver
        if (validationWarnings.length > 0) {
          setShowValidationWarnings(true);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao processar o arquivo');
        setPreviewData([]);
      } finally {
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o arquivo');
      setPreviewData([]);
      setIsLoading(false);
    }
  }, [importType, validationWarnings.length]);

  // Garantir que o objeto accept seja tratado corretamente
  const acceptFormats = { ...SUPPORTED_FORMATS };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptFormats,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Processar arquivo para preview
  const processFileForPreview = async (file: File, type: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const result = event.target?.result;
          if (!result) {
            reject(new Error('Falha ao ler o arquivo'));
            return;
          }

          let data: any[] = [];

          // Processar com base no tipo de importação
          switch (type) {
            case 'office365':
              // Importar biblioteca xlsx dinamicamente
              const XLSX_Office = await import('xlsx');
              const workbook_office = XLSX_Office.read(result, { type: 'binary' });
              const sheetName_office = workbook_office.SheetNames[0];
              const worksheet_office = workbook_office.Sheets[sheetName_office];

              // Converter para JSON com cabeçalhos
              const jsonData_office = XLSX_Office.utils.sheet_to_json(worksheet_office, { raw: false });

              // Usar diretamente os dados JSON
              data = jsonData_office;
              break;

            case 'excel':
              // Importar biblioteca xlsx dinamicamente
              const XLSX = await import('xlsx');
              const workbook = XLSX.read(result, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

              // Extrair cabeçalhos e dados
              const headers = data[0];
              const rows = data.slice(1);

              // Converter para array de objetos
              data = rows.map(row => {
                const obj: any = {};
                headers.forEach((header: string, index: number) => {
                  obj[header] = row[index];
                });
                return obj;
              });
              break;

            // ... outros casos de processamento de arquivo ...

            default:
              reject(new Error(`Tipo de importação não suportado: ${type}`));
              return;
          }

          // Validar dados
          try {
            // Importar validador dinamicamente
            const { validateUserData } = await import('@/lib/validators/dataValidators');

            // Validar cada registro
            const warnings: { userId: number; field: string; message: string }[] = [];
            const validatedData = data.map((user, index) => {
              const validation = validateUserData(user);

              // Coletar avisos
              if (!validation.isValid && validation.errors) {
                Object.entries(validation.errors).forEach(([field, message]) => {
                  warnings.push({
                    userId: index,
                    field,
                    message
                  });
                });
              }

              // Retornar dados normalizados ou originais
              return validation.normalizedData || user;
            });

            // Armazenar avisos para exibição posterior
            if (warnings.length > 0) {
              setValidationWarnings(warnings);
            }

            // Retornar dados validados
            resolve(validatedData);
          } catch (error) {
            console.error('Erro ao validar dados:', error);
            // Se houver erro na validação, retornar os dados originais
            resolve(data);
          }
        } catch (error) {
          reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };

      // Ler o arquivo como binário
      reader.readAsBinaryString(file);
    });
  };

  // Iniciar importação
  const startImport = async () => {
    if (!file) {
      setError('Nenhum arquivo selecionado');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Processar o arquivo completo
      const allData = await processEntireFile(file, importType);

      // Verificar duplicatas
      const duplicatesFound = await checkDuplicates(allData);

      if (duplicatesFound.length > 0) {
        setDuplicates(duplicatesFound);
        setShowDuplicatesModal(true);
        setIsLoading(false);
        return;
      }

      // Iniciar importação se não houver duplicatas
      proceedWithImport(allData);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || t('components.erroDuranteAImportacao'));
    }
  };

  // Cancelar importação
  const cancelImport = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    setImportStarted(false);
    setProgress({
      current: 0,
      total: 0,
      success: 0,
      error: 0,
      skipped: 0,
    });
  };

  // Resetar importação
  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    setImportStarted(false);
    setProgress({
      current: 0,
      total: 0,
      success: 0,
      error: 0,
      skipped: 0,
    });
  };

  // Verificar duplicatas
  const checkDuplicates = async (data: any[]): Promise<any[]> => {
    const duplicates: any[] = [];

    // Verificar duplicatas locais (dentro do arquivo)
    const emailMap = new Map();
    const phoneMap = new Map();

    // Primeiro passo: identificar duplicatas no arquivo
    data.forEach((user, index) => {
      // Verificar email duplicado
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase().trim();
        if (emailMap.has(normalizedEmail)) {
          duplicates.push({
            type: 'local',
            field: 'email',
            value: normalizedEmail,
            user1: data[emailMap.get(normalizedEmail)],
            user2: user,
            index1: emailMap.get(normalizedEmail),
            index2: index
          });
        } else {
          emailMap.set(normalizedEmail, index);
        }
      }

      // Verificar telefone duplicado
      if (user.phoneNumber) {
        const normalizedPhone = user.phoneNumber.replace(/\D/g, '');
        if (phoneMap.has(normalizedPhone)) {
          duplicates.push({
            type: 'local',
            field: 'phoneNumber',
            value: user.phoneNumber,
            user1: data[phoneMap.get(normalizedPhone)],
            user2: user,
            index1: phoneMap.get(normalizedPhone),
            index2: index
          });
        } else {
          phoneMap.set(normalizedPhone, index);
        }
      }
    });

    // Segundo passo: verificar duplicatas no servidor
    try {
      // Obter todos os emails e telefones para verificar em lote
      const emails = Array.from(emailMap.keys()).filter(email => email);
      const phones = Array.from(phoneMap.keys()).filter(phone => phone);

      if (emails.length > 0 || phones.length > 0) {
        const response = await fetch('/api/admin/users/check-duplicates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('abzToken')}`
          },
          body: JSON.stringify({
            emails,
            phones
          })
        });

        if (response.ok) {
          const result = await response.json();

          // Processar duplicatas de email
          if (result.duplicateEmails && result.duplicateEmails.length > 0) {
            result.duplicateEmails.forEach((dupEmail: any) => {
              // Encontrar o índice do usuário com este email
              const userIndex = Array.from(emailMap.entries())
                .find(([email]) => email.toLowerCase() === dupEmail.email.toLowerCase())?.[1];

              if (userIndex !== undefined) {
                duplicates.push({
                  type: 'server',
                  field: 'email',
                  value: dupEmail.email,
                  existingUser: dupEmail,
                  importUser: data[userIndex],
                  index: userIndex
                });
              }
            });
          }

          // Processar duplicatas de telefone
          if (result.duplicatePhones && result.duplicatePhones.length > 0) {
            result.duplicatePhones.forEach((dupPhone: any) => {
              // Encontrar o índice do usuário com este telefone
              const userIndex = Array.from(phoneMap.entries())
                .find(([phone]) => {
                  const normalizedServerPhone = dupPhone.phone_number.replace(/\D/g, '');
                  return phone === normalizedServerPhone;
                })?.[1];

              if (userIndex !== undefined) {
                duplicates.push({
                  type: 'server',
                  field: 'phoneNumber',
                  value: dupPhone.phone_number,
                  existingUser: dupPhone,
                  importUser: data[userIndex],
                  index: userIndex
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar duplicatas no servidor:', error);
    }

    return duplicates;
  };

  // Processar arquivo inteiro
  const processEntireFile = async (file: File, type: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const result = event.target?.result;
          if (!result) {
            reject(new Error('Falha ao ler o arquivo'));
            return;
          }

          let data: any[] = [];

          // Processar com base no tipo de importação
          switch (type) {
            case 'office365':
              // Importar biblioteca xlsx dinamicamente
              const XLSX_Office = await import('xlsx');
              const workbook_office = XLSX_Office.read(result, { type: 'binary' });
              const sheetName_office = workbook_office.SheetNames[0];
              const worksheet_office = workbook_office.Sheets[sheetName_office];

              // Converter para JSON com cabeçalhos
              const jsonData_office = XLSX_Office.utils.sheet_to_json(worksheet_office, { raw: false });

              // Usar diretamente os dados JSON
              data = jsonData_office;
              break;

            case 'excel':
              // Importar biblioteca xlsx dinamicamente
              const XLSX = await import('xlsx');
              const workbook = XLSX.read(result, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

              // Extrair cabeçalhos e dados
              const headers = data[0];
              const rows = data.slice(1);

              // Converter para array de objetos
              data = rows.map(row => {
                const obj: any = {};
                headers.forEach((header: string, index: number) => {
                  obj[header] = row[index];
                });
                return obj;
              });
              break;

            case 'csv':
              // Processar CSV
              const text = result.toString();
              const lines = text.split('\n');
              const csvHeaders = lines[0].split(',').map(h => h.trim());

              data = lines.slice(1).filter(line => line.trim()).map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj: any = {};
                csvHeaders.forEach((header, index) => {
                  obj[header] = values[index] || '';
                });
                return obj;
              });
              break;

            default:
              reject(new Error(`Tipo de importação não suportado: ${type}`));
              return;
          }

          // Validar dados
          try {
            // Importar validador dinamicamente
            const { validateUserData } = await import('@/lib/validators/dataValidators');

            // Validar cada registro
            const validatedData = data.map((user) => {
              const validation = validateUserData(user);
              return validation.normalizedData || user;
            });

            // Retornar dados validados
            resolve(validatedData);
          } catch (error) {
            console.error('Erro ao validar dados:', error);
            // Se houver erro na validação, retornar os dados originais
            resolve(data);
          }
        } catch (error) {
          reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };

      // Ler o arquivo como binário
      reader.readAsBinaryString(file);
    });
  };

  // Prosseguir com a importação após verificação de duplicatas
  const proceedWithImport = async (data: any[]) => {
    try {
      setImportStarted(true);
      setIsLoading(true);

      // Registrar início da importação
      const startTime = Date.now();
      setImportStartTime(startTime);

      // Criar log de importação
      // Simplificar o log de importação
      const logId = null;

      setImportLogId(logId);

      // Inicializar progresso
      setProgress({
        current: 0,
        total: data.length,
        success: 0,
        error: 0,
        skipped: 0
      });

      console.log(t('components.iniciandoImportacaoDe'), data.length, {t('components.usuarios')});
      console.log('Dados de exemplo:', JSON.stringify(data[0]));

      // Enviar dados para a API
      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('abzToken')}`
        },
        body: JSON.stringify({
          users: data,
          sendInvites: importOptions.sendEmailInvites,
          sendSMS: importOptions.sendSMSInvites,
          defaultRole: importOptions.defaultRole,
          skipDuplicates: importOptions.skipDuplicates
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro na resposta da API:', errorData);
        throw new Error(errorData.error || t('components.erroAoImportarUsuarios'));
      }

      const result = await response.json();
      console.log(t('components.resultadoDaImportacao'), result);

      // Atualizar progresso final
      setProgress({
        current: data.length,
        total: data.length,
        success: result.success || 0,
        error: result.error || 0,
        skipped: result.skipped || 0
      });

      // Atualizar status da importação
      if (importLogId) {
        await updateImportStatus(importLogId, 'success');
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error(t('components.erroDuranteAImportacao'), err);

      // Registrar erro
      if (importLogId) {
        await logImportError(importLogId, err.message || 'Erro desconhecido');
      }

      setError(err.message || t('components.erroDuranteAImportacao'));
      setIsLoading(false);

      // Manter a tela de progresso para mostrar o erro
      setProgress(prev => ({
        ...prev,
        error: prev.current
      }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {!importStarted ? (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {t('admin.importUsers')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {IMPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setImportType(type.id)}
                  className={`flex items-center justify-center p-4 border rounded-md transition-colors ${
                    importType === type.id
                      ? 'border-abz-blue bg-blue-50 text-abz-blue'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                <div className="flex">
                  <FiAlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500">
              {t('admin.supportedFormats')}: {(() => {
                try {
                  const selectedType = IMPORT_TYPES.find(t => t.id === importType);
                  if (selectedType && selectedType.formats && Array.isArray(selectedType.formats)) {
                    return selectedType.formats.join(', ');
                  }
                  return '';
                } catch (e) {
                  return '';
                }
              })()}
            </p>
          </div>

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
                <p className="text-sm font-medium text-gray-900">{file.name ? String(file.name) : ''}</p>
                <p className="text-xs text-gray-500">
                  {(() => {
                    // Garantir que o tamanho do arquivo seja tratado como número
                    try {
                      const fileSize = file.size;
                      if (typeof fileSize === 'number') {
                        return (fileSize / 1024 / 1024).toFixed(2) + ' MB';
                      } else {
                        return '0.00 MB';
                      }
                    } catch (e) {
                      return '0.00 MB';
                    }
                  })()}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreviewData([]);
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  {t('common.remove')}
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center">
                <FiLoader className="h-10 w-10 text-abz-blue mb-2 animate-spin" />
                <p className="text-sm text-gray-500">{t('common.processing')}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <FiUpload className="h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-900">
                  {isDragActive
                    ? t('admin.dropFileHere')
                    : t('admin.dragAndDropOrClick')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.maxFileSize', 'Tamanho máximo: 10MB')}
                </p>
              </div>
            )}
          </div>

          {/* Preview dos dados */}
          {previewData.length > 0 && !showFieldMapping && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                {t('admin.dataPreview')}
              </h3>
              <ImportPreview data={previewData} />

              {/* Opções de importação */}
              <ImportOptions
                options={importOptions}
                onChange={setImportOptions}
              />

              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={cancelImport}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFieldMapping(true)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiEdit className="mr-1 inline" />
                  Mapear Campos
                </button>
                <button
                  type="button"
                  onClick={startImport}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <FiLoader className="animate-spin mr-2 inline" />
                      {t('common.processing')}
                    </>
                  ) : (
                    t('admin.startImport')
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mapeamento de campos */}
          {showFieldMapping && (
            <div className="mt-6">
              <FieldMapping
                data={previewData}
                onApplyMapping={(mappedData) => {
                  setMappedData(mappedData);
                  setShowFieldMapping(false);
                  // Atualizar preview com dados mapeados
                  setPreviewData(mappedData.slice(0, 10));
                }}
                onCancel={() => setShowFieldMapping(false)}
              />
            </div>
          )}

          {/* Modal de duplicatas */}
          {showDuplicatesModal && (
            <DuplicatesModal
              duplicates={duplicates}
              onClose={() => setShowDuplicatesModal(false)}
              onProceed={(skipDuplicates) => {
                setImportOptions(prev => ({
                  ...prev,
                  skipDuplicates
                }));

                // Processar o arquivo completo novamente
                processEntireFile(file!, importType)
                  .then(data => proceedWithImport(data))
                  .catch(err => setError(err.message || 'Erro ao processar arquivo'));
              }}
            />
          )}

          {/* Modal de avisos de validação */}
          {showValidationWarnings && (
            <ValidationWarnings
              warnings={validationWarnings}
              onClose={() => setShowValidationWarnings(false)}
              onProceed={() => {
                setShowValidationWarnings(false);
                // Continuar com a importação mesmo com avisos
              }}
            />
          )}
        </>
      ) : (
        <ImportProgress
          progress={progress}
          onComplete={resetImport}
          onCancel={cancelImport}
        />
      )}
    </div>
  );
}
