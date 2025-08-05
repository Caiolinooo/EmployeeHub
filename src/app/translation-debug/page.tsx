'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';

export default function TranslationDebugPage() {
  const { t, locale, setLocale, availableLocales } = useI18n();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // Collect debug information
    const info = {
      currentLocale: locale,
      availableLocales,
      localStorage: typeof window !== 'undefined' ? localStorage.getItem('locale') : 'N/A',
      cookie: typeof document !== 'undefined' ? 
        document.cookie.split('; ').find(row => row.startsWith('NEXT_LOCALE='))?.split('=')[1] : 'N/A',
      documentLang: typeof document !== 'undefined' ? document.documentElement.lang : 'N/A',
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : 'N/A'
    };
    setDebugInfo(info);
  }, [locale, availableLocales]);

  const testKeys = [
    'common.loading',
    'common.error',
    'common.success',
    'common.chooseLanguage',
    'common.portuguese',
    'common.english',
    'auth.email',
    'auth.accessAccount',
    'register.title',
    'reimbursement.form.personalInfo'
  ];

  const handleLanguageChange = (newLocale: any) => {
    console.log('🔄 Changing language to:', newLocale);
    setLocale(newLocale);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Translation Debug Page</h1>
        
        {/* Debug Information */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Current Locale:</strong> {debugInfo.currentLocale}</div>
            <div><strong>Available Locales:</strong> {debugInfo.availableLocales?.join(', ')}</div>
            <div><strong>LocalStorage:</strong> {debugInfo.localStorage}</div>
            <div><strong>Cookie:</strong> {debugInfo.cookie}</div>
            <div><strong>Document Lang:</strong> {debugInfo.documentLang}</div>
            <div><strong>Browser Language:</strong> {debugInfo.browserLanguage}</div>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Language Switcher</h2>
          <div className="flex gap-4">
            {availableLocales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLanguageChange(loc)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  locale === loc 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {loc === 'pt-BR' ? '🇧🇷 Português' : '🇺🇸 English'}
              </button>
            ))}
          </div>
        </div>

        {/* Translation Tests */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Translation Tests</h2>
          <div className="space-y-3">
            {testKeys.map((key) => {
              const translation = t(key);
              const isWorking = translation !== key && translation.length > 0;
              
              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <code className="text-sm text-gray-600">{key}</code>
                  </div>
                  <div className="flex-2 mx-4">
                    <span className={isWorking ? 'text-green-700' : 'text-red-700'}>
                      {translation}
                    </span>
                  </div>
                  <div className="flex-none">
                    <span className={`px-2 py-1 rounded text-xs ${
                      isWorking ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {isWorking ? '✅ OK' : '❌ FAIL'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Translation Test */}
        <div className="bg-white p-6 rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold mb-4">Real-time Test</h2>
          <div className="space-y-2">
            <p><strong>Current Language:</strong> {t('common.chooseLanguage')}</p>
            <p><strong>Loading Text:</strong> {t('common.loading')}</p>
            <p><strong>Error Text:</strong> {t('common.error')}</p>
            <p><strong>Success Text:</strong> {t('common.success')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
