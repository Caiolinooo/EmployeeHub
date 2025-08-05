'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

export default function TranslationTestPage() {
  const { t, locale, setLocale } = useI18n();

  const testKeys = [
    'common.loading',
    'common.error', 
    'common.success',
    'auth.email',
    'auth.emailPlaceholder',
    'reimbursement.form.personalInfo',
    'reimbursement.form.fullName',
    'register.title',
    'viewer.loading',
    'userEditor.permissions',
    'manager.moduleTitle'
  ];

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Teste de Traduções</h1>
      
      <div className="mb-6">
        <p className="mb-2">Idioma atual: <strong>{locale}</strong></p>
        <div className="space-x-2">
          <button 
            onClick={() => setLocale('pt-BR')}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Português
          </button>
          <button 
            onClick={() => setLocale('en-US')}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testKeys.map(key => (
          <div key={key} className="p-4 border rounded">
            <div className="font-mono text-sm text-gray-600 mb-2">{key}</div>
            <div className="font-medium">
              {t(key) === key ? (
                <span className="text-red-500">❌ CHAVE NÃO ENCONTRADA</span>
              ) : (
                <span className="text-green-600">✅ {t(key)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}