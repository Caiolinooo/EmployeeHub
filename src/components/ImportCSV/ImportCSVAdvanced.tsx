
'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiUpload, FiFile, FiX, FiCheck, FiAlertCircle, FiLoader, FiEdit, FiSettings } from 'react-icons/fi';
import CSVPreview from './CSVPreview';
import CSVFieldMapping from './CSVFieldMapping';
import CSVImportOptions from './CSVImportOptions';

// Tipos de separadores suportados
const SEPARATORS = [
  { id: ',', label: 'Vírgula (,)' },
  { id: ';', label: 'Ponto e vírgula (;)' },
  { id: '\t', label: 'Tab (\\t)' },
  { id: '|', label: 'Pipe (|)' },
];

interface ImportCSVAdvancedProps {
  onImportComplete?: (data: Record<string, string | number>[]) => void;
  apiEndpoint: string;
  importType: string;
  fieldDefinitions: {
    required: string[];
    optional: string[];
    alternatives: Record<string, string[]>;
  };
}

export default function ImportCSVAdvanced({
  onImportComplete,
  apiEndpoint,
  importType,
  fieldDefinitions
}: ImportCSVAdvancedProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState<string>(',');
  const [previewData, setPreviewData] = useState<Record<string, string | number>[]>([]);
  const [rawData, setRawData] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  // const [mappedData, setMappedData] = useState<Record<string, string | number>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState<boolean>(false);
  const [showImportOptions, setShowImportOptions] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [importOptions, setImportOptions] = useState({
    skipFirstRow: true,
    trimValues: true,
    skipEmptyRows: true,
    validateData: true,
  });
  const [importStats, setImportStats] = useState<{
    processed: number;
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  // Processar arquivo quando for selecionado
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);

      try {
        setIsLoading(true);

        // Ler o conteúdo do arquivo
        const text = await readFileAsText(selectedFile);
        setRawData(text);

        // Processar o CSV com o separador atual
        processCSV(text, separator);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Ler arquivo como texto
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Falha ao ler o arquivo'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
      reader.readAsText(file);
    });
  };

  // Processar CSV quando o separador mudar
  useEffect(() => {
    if (rawData) {
      processCSV(rawData, separator);
    }
  }, [separator, rawData]);

  // Processar CSV com o separador especificado
  const processCSV = (text: string, sep: string) => {
    try {
      console.log('Processando CSV com separador:', sep);

      // Dividir por linhas
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) {
        throw new Error('Arquivo vazio');
      }

      // Obter cabeçalhos
      const headerLine = lines[0];
      const headerValues = headerLine.split(sep).map(h => h.trim());
      console.log('Cabeçalhos detectados:', headerValues);
      setHeaders(headerValues);

      // Verificar se é formato Office 365
      const isOffice365Format = headerValues.some(h =>
        h === 'Nome para exibição' ||
        h === 'Nome UPN' ||
        (h === 'Nome' && headerValues.includes('Sobrenome'))
      );

      console.log('Formato Office 365 detectado?', isOffice365Format);

      // Processar dados
      const data: any[] = [];
      for (let i = importOptions.skipFirstRow ? 1 : 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (importOptions.skipEmptyRows && !line) continue;

        // Dividir a linha em valores, respeitando aspas para campos com vírgulas
        let values: string[] = [];
        let inQuotes = false;
        let currentValue = '';

        // Se for Office 365, usar processamento especial para lidar com campos que contêm o separador
        if (isOffice365Format) {
          // Processamento mais robusto para CSV com aspas
          let j = 0;
          while (j < line.length) {
            const char = line[j];

            if (char === '"' && (j === 0 || line[j-1] === sep)) {
              // Início de um campo com aspas
              inQuotes = true;
              j++;
              continue;
            } else if (char === '"' && inQuotes && (j === line.length - 1 || line[j+1] === sep)) {
              // Fim de um campo com aspas
              inQuotes = false;
              j++;
              continue;
            } else if (char === sep && !inQuotes) {
              // Separador fora de aspas
              values.push(currentValue);
              currentValue = '';
              j++;
              continue;
            } else {
              // Qualquer outro caractere
              currentValue += char;
              j++;
            }
          }

          // Adicionar o último valor
          values.push(currentValue);
        } else {
          // Processamento simples para CSV sem aspas
          values = line.split(sep).map(v => importOptions.trimValues ? v.trim() : v);
        }

        const row: Record<string, string> = {};

        headerValues.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        data.push(row);
      }

      console.log('Dados processados:', data.length, 'linhas');
      if (data.length > 0) {
        console.log('Exemplo da primeira linha:', JSON.stringify(data[0]));
      }

      setPreviewData(data);

      // Selecionar todas as linhas por padrão
      setSelectedRows(Array.from({ length: data.length }, (_, i) => i));

      // Tentar mapear automaticamente
      autoMapFields(headerValues);

      // Carregar último mapeamento usado
      loadLastUsedMapping();
    } catch (err) {
      console.error('Erro ao processar CSV:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar CSV');
      setPreviewData([]);
      setHeaders([]);
      setSelectedRows([]);
    }
  };

  // Mapear campos automaticamente
  const autoMapFields = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const { required, optional, alternatives } = fieldDefinitions;
    const allFields = [...required, ...optional];

    console.log('Mapeando campos automaticamente. Headers:', headers);
    console.log('Campos necessários:', required);
    console.log('Campos opcionais:', optional);

    // Verificar se estamos lidando com formato Office 365
    const isOffice365Format = headers.some(h =>
      h === 'Nome para exibição' ||
      h === 'Nome UPN' ||
      (h === 'Nome' && headers.includes('Sobrenome'))
    );

    console.log('Formato Office 365 detectado?', isOffice365Format);

    if (isOffice365Format) {
      // Mapeamento específico para Office 365
      mapping['firstName'] = 'Nome';
      mapping['lastName'] = 'Sobrenome';
      mapping['email'] = 'Nome UPN';
      mapping['phoneNumber'] = headers.includes('Telefone Celular') ? 'Telefone Celular' : 'Número de telefone';
      mapping['position'] = 'Título';
      mapping['department'] = 'Departamento';

      console.log('Mapeamento para Office 365:', mapping);
      setFieldMapping(mapping);
      return;
    }

    // Mapeamento padrão para outros formatos
    allFields.forEach(field => {
      // Verificar correspondência exata
      if (headers.includes(field)) {
        mapping[field] = field;
        return;
      }

      // Verificar alternativas
      const alts = alternatives[field] || [];
      for (const alt of alts) {
        const matchingHeader = headers.find(h =>
          h.toLowerCase() === alt.toLowerCase() ||
          h.toLowerCase().includes(alt.toLowerCase())
        );
        if (matchingHeader) {
          mapping[field] = matchingHeader;
          return;
        }
      }
    });

    console.log('Mapeamento automático:', mapping);
    setFieldMapping(mapping);
  };

  // Carregar último mapeamento usado
  const loadLastUsedMapping = () => {
    try {
      const lastMappingStr = localStorage.getItem(`lastFieldMapping_${importType}`);
      if (lastMappingStr) {
        const lastMapping = JSON.parse(lastMappingStr);

        // Verificar se o mapeamento é compatível com os cabeçalhos atuais
        const isCompatible = Object.values(lastMapping).every(
          sourceField => headers.includes(sourceField as string)
        );

        if (isCompatible) {
          setFieldMapping(lastMapping);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar último mapeamento:', error);
    }
  };

  // Salvar último mapeamento usado
  const saveLastUsedMapping = (mapping: Record<string, string>) => {
    try {
      localStorage.setItem(`lastFieldMapping_${importType}`, JSON.stringify(mapping));
    } catch (error) {
      console.error('Erro ao salvar último mapeamento:', error);
    }
  };

  // Iniciar importação
  const startImport = async () => {
    if (!file || previewData.length === 0) {
      setError('Nenhum dado para importar');
      return;
    }

    if (selectedRows.length === 0) {
      setError('Nenhuma linha selecionada para importação');
      return;
    }

    console.log('Iniciando importação com tipo:', importType, 'e endpoint:', apiEndpoint);

    setIsLoading(true);
    setError(null);

    try {
      // Salvar o mapeamento atual para uso futuro
      saveLastUsedMapping(fieldMapping);

      // Filtrar apenas as linhas selecionadas
      const selectedData = selectedRows.map(index => previewData[index]);

      // Aplicar mapeamento aos dados selecionados
      const dataToImport = selectedData.map(row => {
        const mappedRow: Record<string, any> = {};

        Object.entries(fieldMapping).forEach(([targetField, sourceField]) => {
          if (sourceField) {
            mappedRow[targetField] = row[sourceField];
          }
        });

        return mappedRow;
      });

      // Preparar o corpo da requisição com base no endpoint
      let requestBody: any;

      // Adaptar o formato dos dados de acordo com o endpoint
      if (apiEndpoint.includes('/api/admin/users/import')) {
        // Processar dados para o formato esperado pela API de usuários
        const processedUsers = dataToImport.map(user => {
          console.log('Processando usuário:', JSON.stringify(user));

          // Verificar se estamos lidando com formato Office 365
          const isOffice365Format = Object.keys(user).some(key =>
            key === 'Nome para exibição' ||
            key === 'Nome UPN' ||
            key === 'Nome' && 'Sobrenome' in user
          );

          console.log('É formato Office 365?', isOffice365Format);

          if (isOffice365Format) {
            // Mapear campos do Office 365 para o formato esperado
            const mappedUser = {
              firstName: user.Nome || '',
              lastName: user.Sobrenome || '',
              email: user['Nome UPN'] || '',
              phoneNumber: user['Telefone Celular'] || user['Número de telefone'] || '',
              position: user.Título || '',
              department: user.Departamento || '',
              role: 'USER' // Papel padrão
            };

            console.log('Usuário mapeado:', JSON.stringify(mappedUser));
            return mappedUser;
          }

          // Já está no formato correto
          return user;
        });

        // Formato para a API de usuários
        requestBody = {
          users: processedUsers,
          sendInvites: true, // Sempre enviar convites por email
          sendSMS: false,
          defaultRole: 'USER',
          skipDuplicates: true
        };
      } else if (apiEndpoint.includes('/api/avaliacao-desempenho/importar')) {
        // Formato para a API de avaliação
        requestBody = {
          funcionarios: dataToImport,
          type: importType
        };
      } else {
        // Formato padrão para outros endpoints
        requestBody = {
          funcionarios: dataToImport,
          type: importType
        };
      }

      console.log('Enviando dados para API:', apiEndpoint, JSON.stringify(requestBody));

      // Enviar para a API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('abzToken')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || `Erro ${response.status}: ${response.statusText}`;
        const errorDetails = errorData.details ? `\n${errorData.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const result = await response.json();
      console.log('Resposta da API:', result);

      // Processar o resultado com base no endpoint
      if (apiEndpoint.includes('/api/users/import')) {
        // Formato de resposta da API de usuários
        setImportStats({
          processed: result.total || dataToImport.length,
          imported: result.success || 0,
          skipped: result.skipped || 0,
          errors: result.error || 0
        });

        if (onImportComplete) {
          onImportComplete(dataToImport);
        }
      } else if (result.success) {
        // Formato de resposta da API de avaliação
        setImportStats({
          processed: result.resultado?.total || dataToImport.length,
          imported: result.resultado?.imported || dataToImport.length,
          skipped: result.resultado?.skipped || 0,
          errors: result.resultado?.errors || 0
        });

        if (onImportComplete) {
          onImportComplete(dataToImport);
        }
      } else {
        throw new Error(result.error || 'Erro ao importar dados');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao importar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Resetar importação
  const resetImport = () => {
    setFile(null);
    setRawData('');
    setPreviewData([]);
    setHeaders([]);
    // setMappedData([]); // mappedData foi removido
    setFieldMapping({});
    setSelectedRows([]);
    setError(null);
    setImportStats(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {t('importacao.title', 'Importação de Dados')}
      </h2>

      {/* Opções de importação */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowImportOptions(!showImportOptions)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <FiSettings className="mr-1" />
          {showImportOptions ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas'}
        </button>

        {showImportOptions && (
          <CSVImportOptions
            options={importOptions}
            onChange={setImportOptions}
            separators={SEPARATORS}
            currentSeparator={separator}
            onSeparatorChange={setSeparator}
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <div className="flex">
            <FiAlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-1" />
            <div>
              {error.split('\n').map((line, index) => (
                <div key={index} className={index > 0 ? "mt-2 text-sm" : ""}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload de arquivo */}
      {!file ? (
        <div className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors hover:border-abz-blue hover:bg-blue-50">
          <label className="cursor-pointer w-full h-full block">
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            <FiUpload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">
              {t('importacao.instructionsText', 'Arraste e solte um arquivo CSV ou clique para selecionar')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('importacao.fileFormat', 'Formatos suportados: CSV, XLS, XLSX')}
            </p>
          </label>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex items-center">
              <FiFile className="text-abz-blue mr-2" />
              <span>{file.name}</span>
            </div>
            <button
              className="text-red-500"
              onClick={resetImport}
            >
              <FiX />
            </button>
          </div>
        </div>
      )}

      {/* Preview dos dados */}
      {previewData.length > 0 && !showFieldMapping && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium text-gray-900">
              {t('importacao.preview', 'Pré-visualização dos Dados')}
            </h3>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowFieldMapping(true)}
                className="px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiEdit className="mr-1 inline" />
                Mapear Campos
              </button>

              <button
                type="button"
                onClick={startImport}
                className={`px-3 py-1 rounded-md shadow-sm text-sm font-medium ${
                  selectedRows.length > 0
                    ? 'bg-abz-blue text-white hover:bg-abz-blue-dark'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={selectedRows.length === 0 || isLoading}
              >
                {isLoading ? (
                  <>
                    <FiLoader className="animate-spin mr-1 inline" />
                    Importando...
                  </>
                ) : (
                  <>
                    <FiCheck className="mr-1 inline" />
                    Importar Selecionados
                  </>
                )}
              </button>
            </div>
          </div>

          <CSVPreview
            data={previewData}
            selectedRows={selectedRows}
            onSelectedRowsChange={setSelectedRows}
          />

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {t('importacao.rowsFound', 'Linhas encontradas')}: {previewData.length}
            </div>
            <div className="text-sm text-blue-600 font-medium">
              {selectedRows.length} linhas selecionadas para importação
            </div>
          </div>
        </div>
      )}

      {/* Mapeamento de campos */}
      {showFieldMapping && (
        <CSVFieldMapping
          headers={headers}
          fieldDefinitions={fieldDefinitions}
          currentMapping={fieldMapping}
          onMappingChange={setFieldMapping}
          onCancel={() => setShowFieldMapping(false)}
          onApply={() => setShowFieldMapping(false)}
          sampleData={previewData.slice(0, 1)[0] || {}}
        />
      )}

      {/* Estatísticas de importação */}
      {importStats && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-green-800 mb-2">
            {t('importacao.success', 'Importação concluída com sucesso')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">{t('importacao.rowsProcessed', 'Linhas processadas')}</p>
              <p className="text-xl font-semibold">{importStats.processed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('importacao.rowsImported', 'Linhas importadas')}</p>
              <p className="text-xl font-semibold text-green-600">{importStats.imported}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('importacao.rowsSkipped', 'Linhas ignoradas')}</p>
              <p className="text-xl font-semibold text-yellow-600">{importStats.skipped}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('importacao.rowsWithErrors', 'Linhas com erros')}</p>
              <p className="text-xl font-semibold text-red-600">{importStats.errors}</p>
            </div>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      {file && previewData.length > 0 && !importStats && (
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={resetImport}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('common.cancel', 'Cancelar')}
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
                {t('importacao.processing', 'Processando...')}
              </>
            ) : (
              t('importacao.upload', 'Importar Dados')
            )}
          </button>
        </div>
      )}
    </div>
  );
}
