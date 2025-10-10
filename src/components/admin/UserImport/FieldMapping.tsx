'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiSave, FiRefreshCw, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

interface FieldMappingProps {
  data: any[];
  onApplyMapping: (mappedData: any[]) => void;
  onCancel: () => void;
}

// Campos obrigatórios e opcionais para importação
const REQUIRED_FIELDS = ['name'];
const OPTIONAL_FIELDS = ['email', 'phoneNumber', 'department', 'position', 'admissionDate', 'registration', 'document', 'notes'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Nomes alternativos para campos
const FIELD_ALTERNATIVES = {
  name: ['nome', 'fullName', 'nome completo', 'full name', 'nome_completo', 'full_name', 'displayName', 'display_name'],
  email: ['e-mail', 'mail', 'email_address', 'emailAddress', 'e_mail', 'correio'],
  phoneNumber: ['telefone', 'phone', 'celular', 'mobile', 'phone_number', 'phoneNumber', 'telefone_contato', 'mobilePhone'],
  department: ['departamento', 'setor', 'area', {t('components.area')}, 'dept', 'department', 'sector', 'business_unit'],
  position: ['cargo', {t('components.funcao')}, 'funcao', 'job_title', 'jobTitle', 'role', 'position', 'title'],
  admissionDate: ['data_admissao', 'dataAdmissao', 'admission_date', 'admissionDate', 'hire_date', 'hireDate', 'dt_admissao'],
  registration: ['matricula', {t('components.matricula')}, 'registration', 'employee_id', 'employeeId', 'id', 'code', 'codigo'],
  document: ['cpf', 'cnpj', 'documento', 'document', 'ssn', 'tax_id', 'taxId', 'document_number'],
  notes: ['observacoes', {t('components.observacoes')}, 'obs', 'comments', 'description', 'desc', 'notes', 'note']
};

export default function FieldMapping({ data, onApplyMapping, onCancel }: FieldMappingProps) {
  const { t } = useI18n();
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [availableSourceFields, setAvailableSourceFields] = useState<string[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [savedMappings, setSavedMappings] = useState<Record<string, Record<string, string>>>({});
  const [mappingName, setMappingName] = useState<string>('');
  const [showSaveMapping, setShowSaveMapping] = useState<boolean>(false);

  // Detectar campos disponíveis no arquivo
  useEffect(() => {
    if (data && data.length > 0) {
      // Obter todos os campos únicos do primeiro registro
      const firstRecord = data[0];
      const fields = Object.keys(firstRecord);
      setAvailableSourceFields(fields);

      // Tentar mapear automaticamente
      const initialMapping: Record<string, string> = {};

      // Para cada campo de destino
      ALL_FIELDS.forEach(targetField => {
        // Verificar correspondência exata
        if (fields.includes(targetField)) {
          initialMapping[targetField] = targetField;
          return;
        }

        // Verificar alternativas
        const alternatives = FIELD_ALTERNATIVES[targetField as keyof typeof FIELD_ALTERNATIVES] || [];
        for (const alt of alternatives) {
          const matchingField = fields.find(f =>
            f.toLowerCase() === alt.toLowerCase() ||
            f.toLowerCase().includes(alt.toLowerCase())
          );
          if (matchingField) {
            initialMapping[targetField] = matchingField;
            return;
          }
        }
      });

      setFieldMapping(initialMapping);
      validateMapping(initialMapping);
    }
  }, [data]);

  // Validar mapeamento
  const validateMapping = (mapping: Record<string, string>) => {
    const errors: string[] = [];

    // Verificar campos obrigatórios
    REQUIRED_FIELDS.forEach(field => {
      if (!mapping[field]) {
        errors.push(`O campo "${field}{t('components.eObrigatorioENaoFoiMapeado')});
      }
    });

    // Verificar se pelo menos um campo de contato está mapeado
    if (!mapping['email'] && !mapping['phoneNumber']) {
      errors.push('Pelo menos um campo de contato (email ou telefone) deve ser mapeado.');
    }

    setMappingErrors(errors);
    return errors.length === 0;
  };

  // Atualizar mapeamento
  const updateMapping = (targetField: string, sourceField: string) => {
    const newMapping = { ...fieldMapping, [targetField]: sourceField };
    setFieldMapping(newMapping);
    validateMapping(newMapping);
  };

  // Aplicar mapeamento
  const applyMapping = () => {
    if (!validateMapping(fieldMapping)) {
      return;
    }

    // Mapear dados
    const mappedData = data.map(item => {
      const mappedItem: Record<string, any> = {};

      // Aplicar mapeamento
      Object.entries(fieldMapping).forEach(([targetField, sourceField]) => {
        if (sourceField) {
          mappedItem[targetField] = item[sourceField];
        }
      });

      return mappedItem;
    });

    onApplyMapping(mappedData);
  };

  // Salvar mapeamento
  const saveMapping = () => {
    if (!mappingName.trim()) {
      return;
    }

    const newSavedMappings = {
      ...savedMappings,
      [mappingName]: { ...fieldMapping }
    };

    setSavedMappings(newSavedMappings);

    // Salvar no localStorage
    try {
      localStorage.setItem('fieldMappings', JSON.stringify(newSavedMappings));
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
    }

    setMappingName('');
    setShowSaveMapping(false);
  };

  // Carregar mapeamento
  const loadMapping = (name: string) => {
    const mapping = savedMappings[name];
    if (mapping) {
      setFieldMapping(mapping);
      validateMapping(mapping);
    }
  };

  // Carregar mapeamentos salvos do localStorage
  useEffect(() => {
    try {
      const savedMappingsStr = localStorage.getItem('fieldMappings');
      if (savedMappingsStr) {
        const parsedMappings = JSON.parse(savedMappingsStr);
        setSavedMappings(parsedMappings);
      }
    } catch (error) {
      console.error('Erro ao carregar mapeamentos salvos:', error);
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Mapeamento de Campos</h2>
        <div className="flex space-x-2">
          {Object.keys(savedMappings).length > 0 && (
            <div className="relative">
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
                onChange={(e) => loadMapping(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Carregar mapeamento</option>
                {Object.keys(savedMappings).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSaveMapping(!showSaveMapping)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiSave className="inline mr-1" />
            Salvar Mapeamento
          </button>
        </div>
      </div>

      {showSaveMapping && (
        <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="Nome do mapeamento"
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
            />
            <button
              type="button"
              onClick={saveMapping}
              disabled={!mappingName.trim()}
              className="px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <FiCheck className="inline mr-1" />
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowSaveMapping(false)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FiX className="inline mr-1" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mappingErrors.length > 0 && (
        <div className="mb-4 p-4 border border-red-200 rounded-md bg-red-50">
          <div className="flex items-start">
            <FiAlertCircle className="mt-0.5 mr-2 text-red-500" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Erros no mapeamento:</h3>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {mappingErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campo de Destino
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campo no Arquivo
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Exemplo
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ALL_FIELDS.map(field => (
              <tr key={field} className={REQUIRED_FIELDS.includes(field) ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {field}
                  {REQUIRED_FIELDS.includes(field) && <span className="text-red-500 ml-1">*</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={fieldMapping[field] || ''}
                    onChange={(e) => updateMapping(field, e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
                  >
                    <option value="">Não mapear</option>
                    {availableSourceFields.map(sourceField => (
                      <option key={sourceField} value={sourceField}>
                        {sourceField}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(() => {
                    try {
                      if (!data[0] || !fieldMapping[field]) {
                        return '-';
                      }

                      const value = data[0][fieldMapping[field]];

                      if (value === undefined || value === null) {
                        return '-';
                      }

                      if (typeof value === 'object') {
                        return JSON.stringify(value);
                      }

                      return String(value);
                    } catch (e) {
                      return '-';
                    }
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            // Resetar mapeamento e detectar novamente
            const firstRecord = data[0];
            const fields = Object.keys(firstRecord);
            setAvailableSourceFields(fields);
            setFieldMapping({});
            setTimeout(() => {
              // Tentar mapear automaticamente
              const initialMapping: Record<string, string> = {};

              // Para cada campo de destino
              ALL_FIELDS.forEach(targetField => {
                // Verificar correspondência exata
                if (fields.includes(targetField)) {
                  initialMapping[targetField] = targetField;
                  return;
                }

                // Verificar alternativas
                const alternatives = FIELD_ALTERNATIVES[targetField as keyof typeof FIELD_ALTERNATIVES] || [];
                for (const alt of alternatives) {
                  const matchingField = fields.find(f =>
                    f.toLowerCase() === alt.toLowerCase() ||
                    f.toLowerCase().includes(alt.toLowerCase())
                  );
                  if (matchingField) {
                    initialMapping[targetField] = matchingField;
                    return;
                  }
                }
              });

              setFieldMapping(initialMapping);
              validateMapping(initialMapping);
            }, 100);
          }}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <FiRefreshCw className="inline mr-1" />
          Detectar Novamente
        </button>
        <button
          type="button"
          onClick={applyMapping}
          disabled={mappingErrors.length > 0}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <FiCheck className="inline mr-1" />
          Aplicar Mapeamento
        </button>
      </div>
    </div>
  );
}
