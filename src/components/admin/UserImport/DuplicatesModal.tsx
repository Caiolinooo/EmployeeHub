'use client';

import React from 'react';
import { FiAlertTriangle, FiX, FiCheck, FiUser } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface DuplicatesModalProps {
  duplicates: any[];
  onClose: () => void;
  onProceed: (skipDuplicates: boolean) => void;
}

export default function DuplicatesModal({ duplicates, onClose, onProceed }: DuplicatesModalProps) {
  const { t } = useI18n();
  
  // Agrupar duplicatas por tipo
  const localDuplicates = duplicates.filter(dup => dup.type === 'local');
  const serverDuplicates = duplicates.filter(dup => dup.type === 'server');
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <FiAlertTriangle className="text-yellow-500 h-6 w-6 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('admin.duplicatesFound', `${duplicates.length} duplicatas encontradas`)}
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
                {t('admin.duplicatesExplanation')}
              </p>
            </div>
            
            {/* Duplicatas locais */}
            {localDuplicates.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {t('admin.localDuplicates', `${localDuplicates.length} duplicatas locais`)}
                </h3>
                <div className="bg-gray-50 rounded-md p-4 space-y-4">
                  {localDuplicates.slice(0, 5).map((dup, index) => (
                    <div key={`local-${index}`} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {dup.field === 'email' ? 'Email duplicado:' : 'Telefone duplicado:'} 
                          <span className="ml-2 text-gray-900">{typeof dup.value === 'object' ? JSON.stringify(dup.value) : String(dup.value || '')}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center mb-2">
                            <FiUser className="text-gray-400 mr-2" />
                            <span className="font-medium">{dup.user1.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {dup.user1.email && <div>Email: {dup.user1.email}</div>}
                            {dup.user1.phoneNumber && <div>Telefone: {dup.user1.phoneNumber}</div>}
                            {dup.user1.department && <div>Departamento: {dup.user1.department}</div>}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center mb-2">
                            <FiUser className="text-gray-400 mr-2" />
                            <span className="font-medium">{dup.user2.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {dup.user2.email && <div>Email: {dup.user2.email}</div>}
                            {dup.user2.phoneNumber && <div>Telefone: {dup.user2.phoneNumber}</div>}
                            {dup.user2.department && <div>Departamento: {dup.user2.department}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {localDuplicates.length > 5 && (
                    <div className="text-sm text-gray-500 text-center">
                      {t('admin.andMoreDuplicates', `e mais ${localDuplicates.length - 5} duplicatas`)}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Duplicatas no servidor */}
            {serverDuplicates.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {t('admin.serverDuplicates', `${serverDuplicates.length} duplicatas no servidor`)}
                </h3>
                <div className="bg-gray-50 rounded-md p-4 space-y-4">
                  {serverDuplicates.slice(0, 5).map((dup, index) => (
                    <div key={`server-${index}`} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {dup.field === 'email' ? 'Email já existe:' : 'Telefone já existe:'} 
                          <span className="ml-2 text-gray-900">{typeof dup.value === 'object' ? JSON.stringify(dup.value) : String(dup.value || '')}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center mb-2">
                            <FiUser className="text-gray-400 mr-2" />
                            <span className="font-medium">{dup.existingUser.name || `${dup.existingUser.first_name} ${dup.existingUser.last_name}`}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {dup.existingUser.email && <div>Email: {dup.existingUser.email}</div>}
                            {dup.existingUser.phone_number && <div>Telefone: {dup.existingUser.phone_number}</div>}
                            {dup.existingUser.department && <div>Departamento: {dup.existingUser.department}</div>}
                            <div className="mt-1 text-xs text-blue-600">Usuário já cadastrado no sistema</div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center mb-2">
                            <FiUser className="text-gray-400 mr-2" />
                            <span className="font-medium">{dup.importUser.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {dup.importUser.email && <div>Email: {dup.importUser.email}</div>}
                            {dup.importUser.phoneNumber && <div>Telefone: {dup.importUser.phoneNumber}</div>}
                            {dup.importUser.department && <div>Departamento: {dup.importUser.department}</div>}
                            <div className="mt-1 text-xs text-orange-600">Usuário na planilha de importação</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {serverDuplicates.length > 5 && (
                    <div className="text-sm text-gray-500 text-center">
                      {t('admin.andMoreDuplicates', `e mais ${serverDuplicates.length - 5} duplicatas`)}
                    </div>
                  )}
                </div>
              </div>
            )}
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
            onClick={() => onProceed(true)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
          >
            {t('admin.skipDuplicates')}
          </button>
          <button
            onClick={() => onProceed(false)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark"
          >
            {t('admin.importAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
