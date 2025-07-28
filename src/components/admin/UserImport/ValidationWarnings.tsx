'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiAlertTriangle, FiX, FiCheck } from 'react-icons/fi';

interface ValidationWarningsProps {
  warnings: { userId: number; field: string; message: string }[];
  onClose: () => void;
  onProceed: () => void;
}

export default function ValidationWarnings({ warnings, onClose, onProceed }: ValidationWarningsProps) {
  const { t } = useI18n();
  
  // Agrupar avisos por campo
  const warningsByField: Record<string, { count: number; messages: string[] }> = {};
  
  warnings.forEach(warning => {
    if (!warningsByField[warning.field]) {
      warningsByField[warning.field] = { count: 0, messages: [] };
    }
    
    warningsByField[warning.field].count++;
    
    // Adicionar mensagem se ainda não existir
    if (!warningsByField[warning.field].messages.includes(warning.message)) {
      warningsByField[warning.field].messages.push(warning.message);
    }
  });
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <FiAlertTriangle className="text-yellow-500 h-6 w-6 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('admin.validationWarnings', `${warnings.length} avisos de validação`)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-grow">
          <div className="space-y-6">
            {/* Explicação */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-700">
                {t('admin.validationWarningsExplanation')}
              </p>
            </div>
            
            {/* Avisos por campo */}
            <div className="space-y-4">
              {Object.entries(warningsByField).map(([field, { count, messages }]) => (
                <div key={field} className="bg-gray-50 rounded-md p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-2">
                    {field}: {count} {count === 1 ? 'problema' : 'problemas'}
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {messages.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            {/* Recomendações */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-md font-medium text-blue-900 mb-2">
                Recomendações
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
                <li>Verifique se os dados estão no formato correto</li>
                <li>Certifique-se de que todos os campos obrigatórios estão preenchidos</li>
                <li>Corrija os problemas no arquivo original e tente novamente</li>
                <li>Use o mapeamento de campos para corrigir problemas de formato</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onProceed}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
          >
            {t('admin.proceedAnyway')}
          </button>
        </div>
      </div>
    </div>
  );
}
