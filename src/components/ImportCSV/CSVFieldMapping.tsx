'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface CSVFieldMappingProps {
  headers: string[];
  fieldDefinitions: {
    required: string[];
    optional: string[];
    alternatives: Record<string, string[]>;
  };
  currentMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  onCancel: () => void;
  onApply: () => void;
  sampleData: Record<string, any>;
}

export default function CSVFieldMapping({
  headers,
  fieldDefinitions,
  currentMapping,
  onMappingChange,
  onCancel,
  onApply,
  sampleData
}: CSVFieldMappingProps) {
  const { t } = useI18n();
  const [mapping, setMapping] = useState<Record<string, string>>(currentMapping);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedMappings, setSavedMappings] = useState<Record<string, Record<string, string>>>({});
  const [mappingName, setMappingName] = useState<string>('');
  const [showSaveMapping, setShowSaveMapping] = useState<boolean>(false);

  const { required, optional } = fieldDefinitions;
  const allFields = [...required, ...optional];

  // Validar mapeamento
  useEffect(() => {
    validateMapping(mapping);
  }, [mapping, required]);

  const validateMapping = (mapping: Record<string, string>) => {
    const errors: string[] = [];

    // Verificar campos obrigatórios
    required.forEach(field => {
      if (!mapping[field]) {
        errors.push(`O campo "${field}{t('components.eObrigatorioENaoFoiMapeado')});
      }
    });

    setErrors(errors);
    return errors.length === 0;
  };

  // Atualizar mapeamento
  const updateMapping = (targetField: string, sourceField: string) => {
    const newMapping = { ...mapping, [targetField]: sourceField };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  // Aplicar mapeamento
  const applyMapping = () => {
    if (validateMapping(mapping)) {
      // Salvar o mapeamento atual como último usado
      try {
        localStorage.setItem('lastFieldMapping_csv', JSON.stringify(mapping));
      } catch (error) {
        console.error(t('components.erroAoSalvarUltimoMapeamento'), error);
      }

      onApply();
    }
  };

  // Salvar mapeamento
  const saveMapping = () => {
    if (!mappingName.trim()) {
      return;
    }

    const newSavedMappings = {
      ...savedMappings,
      [mappingName]: { ...mapping }
    };

    setSavedMappings(newSavedMappings);

    // Salvar no localStorage
    try {
      localStorage.setItem('csvFieldMappings', JSON.stringify(newSavedMappings));
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
    }

    setMappingName('');
    setShowSaveMapping(false);
  };

  // Carregar mapeamento
  const loadMapping = (name: string) => {
    const savedMapping = savedMappings[name];
    if (savedMapping) {
      setMapping(savedMapping);
      onMappingChange(savedMapping);
      validateMapping(savedMapping);
    }
  };

  // Carregar mapeamentos salvos do localStorage
  useEffect(() => {
    try {
      const savedMappingsStr = localStorage.getItem('csvFieldMappings');
      if (savedMappingsStr) {
        const parsedMappings = JSON.parse(savedMappingsStr);
        setSavedMappings(parsedMappings);
      }
    } catch (error) {
      console.error('Erro ao carregar mapeamentos salvos:', error);
    }
  }, []);

  // Detectar mapeamento automaticamente
  const detectMapping = () => {
    const newMapping: Record<string, string> = {};
    const { alternatives } = fieldDefinitions;

    allFields.forEach(targetField => {
      // Verificar correspondência exata
      if (headers.includes(targetField)) {
        newMapping[targetField] = targetField;
        return;
      }

      // Verificar alternativas
      const alts = alternatives[targetField] || [];
      for (const alt of alts) {
        const matchingHeader = headers.find(h =>
          h.toLowerCase() === alt.toLowerCase() ||
          h.toLowerCase().includes(alt.toLowerCase())
        );
        if (matchingHeader) {
          newMapping[targetField] = matchingHeader;
          return;
        }
      }
    });

    setMapping(newMapping);
    onMappingChange(newMapping);
    validateMapping(newMapping);
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
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

      {errors.length > 0 && (
        <div className="mb-4 p-4 border border-red-200 rounded-md bg-red-50">
          <div className="flex items-start">
            <FiAlertCircle className="mt-0.5 mr-2 text-red-500" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Erros no mapeamento:</h3>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
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
            {allFields.map(field => (
              <tr key={field} className={required.includes(field) ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {field}
                  {required.includes(field) && <span className="text-red-500 ml-1">*</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => updateMapping(field, e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
                  >
                    <option value="">Não mapear</option>
                    {headers.map(header => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {mapping[field] && sampleData ? (
                    sampleData[mapping[field]] || '-'
                  ) : (
                    '-'
                  )}
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
          onClick={detectMapping}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <FiRefreshCw className="inline mr-1" />
          Detectar Automaticamente
        </button>
        <button
          type="button"
          onClick={applyMapping}
          disabled={errors.length > 0}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <FiCheck className="inline mr-1" />
          Aplicar Mapeamento
        </button>
      </div>
    </div>
  );
}
