'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface ImportPreviewProps {
  data: any[];
}

export default function ImportPreview({ data }: ImportPreviewProps) {
  const { t } = useI18n();

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        {t('admin.noDataToPreview')}
      </div>
    );
  }

  // Extrair cabeçalhos da primeira linha
  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {headers.map((header, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {(() => {
                    try {
                      const value = row[header];
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
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 text-xs text-gray-500">
        {t('admin.previewLimited', `Visualização limitada a ${data.length} registros`)}
      </div>
    </div>
  );
}
