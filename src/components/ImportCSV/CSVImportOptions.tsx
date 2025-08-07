'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface CSVImportOptionsProps {
  options: {
    skipFirstRow: boolean;
    trimValues: boolean;
    skipEmptyRows: boolean;
    validateData: boolean;
  };
  onChange: (options: {
    hasHeader: boolean;
    trimValues: boolean;
    skipEmptyRows: boolean;
    validateData: boolean;
  }) => void;
  separators: { id: string; label: string }[];
  currentSeparator: string;
  onSeparatorChange: (separator: string) => void;
}

export default function CSVImportOptions({
  options,
  onChange,
  separators,
  currentSeparator,
  onSeparatorChange
}: CSVImportOptionsProps) {
  const { t } = useI18n();

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    onChange({ ...options, [name]: checked });
  };

  return (
    <div className="mt-3 bg-gray-50 p-4 rounded-md">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        {t('importacao.options', 'Opções de Importação')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('importacao.separator', 'Separador')}
          </label>
          <select
            value={currentSeparator}
            onChange={(e) => onSeparatorChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
          >
            {separators.map((separator) => (
              <option key={separator.id} value={separator.id}>
                {separator.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center">
            <input
              id="skipFirstRow"
              name="skipFirstRow"
              type="checkbox"
              checked={options.skipFirstRow}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="skipFirstRow" className="ml-2 block text-sm text-gray-700">
              {t('importacao.skipFirstRow', 'Pular primeira linha (cabeçalho)')}
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="trimValues"
              name="trimValues"
              type="checkbox"
              checked={options.trimValues}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="trimValues" className="ml-2 block text-sm text-gray-700">
              {t('importacao.trimValues', 'Remover espaços em branco')}
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="skipEmptyRows"
              name="skipEmptyRows"
              type="checkbox"
              checked={options.skipEmptyRows}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="skipEmptyRows" className="ml-2 block text-sm text-gray-700">
              {t('importacao.skipEmptyRows', 'Ignorar linhas vazias')}
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="validateData"
              name="validateData"
              type="checkbox"
              checked={options.validateData}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="validateData" className="ml-2 block text-sm text-gray-700">
              {t('importacao.validateData', 'Validar dados')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
