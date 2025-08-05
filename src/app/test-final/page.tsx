'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function FinalTestPage() {
  const { t, locale, setLocale, availableLocales } = useI18n();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Test cases to verify translations
  const testCases = [
    { key: 'common.loading', expectedPt: 'Carregando...', expectedEn: 'Loading...' },
    { key: 'common.error', expectedPt: 'Ocorreu um erro', expectedEn: 'An error occurred' },
    { key: 'common.success', expectedPt: 'Operação realizada com sucesso', expectedEn: 'Operation completed successfully' },
    { key: 'common.chooseLanguage', expectedPt: 'Escolha seu idioma', expectedEn: 'Choose your language' },
    { key: 'common.portuguese', expectedPt: 'Português', expectedEn: 'Portuguese' },
    { key: 'common.english', expectedPt: 'Inglês', expectedEn: 'English' },
    { key: 'auth.email', expectedPt: 'Email', expectedEn: 'Email' },
    { key: 'auth.password', expectedPt: 'Senha', expectedEn: 'Password' },
    { key: 'auth.login', expectedPt: 'Entrar', expectedEn: 'Login' },
    { key: 'auth.accessAccount', expectedPt: 'Acesse sua conta', expectedEn: 'Access your account' },
  ];

  useEffect(() => {
    // Run tests after component mounts
    const runTests = () => {
      const results = testCases.map(testCase => {
        const translation = t(testCase.key);
        const expected = locale === 'pt-BR' ? testCase.expectedPt : testCase.expectedEn;
        const isCorrect = translation === expected;
        
        return {
          key: testCase.key,
          translation,
          expected,
          isCorrect,
          locale
        };
      });
      
      setTestResults(results);
      setIsLoading(false);
    };

    // Small delay to ensure translations are loaded
    setTimeout(runTests, 100);
  }, [locale, t]);

  const handleLanguageSwitch = async (newLocale: any) => {
    setIsLoading(true);
    setLocale(newLocale);
    
    // Wait a bit for the locale to change
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };

  const passedTests = testResults.filter(r => r.isCorrect).length;
  const totalTests = testResults.length;
  const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {t('common.chooseLanguage')} - {t('common.loading')}
          </h1>
          <p className="text-lg text-gray-600">
            Sistema de Traduções - Translation System
          </p>
        </div>

        {/* Language Selector */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            {t('common.chooseLanguage')}
          </h2>
          <div className="flex flex-wrap gap-4 items-center">
            <LanguageSelector variant="inline" />
            <div className="ml-4">
              <span className="text-sm text-gray-600">
                {t('common.language')}: <strong>{locale}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Resultados dos Testes / Test Results
            </h2>
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              successRate === '100.0' 
                ? 'bg-green-100 text-green-800' 
                : successRate >= '80.0'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {successRate}% ({passedTests}/{totalTests})
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={`${result.key}-${result.locale}-${index}`}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.isCorrect 
                      ? 'bg-green-50 border-green-400' 
                      : 'bg-red-50 border-red-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <code className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {result.key}
                      </code>
                    </div>
                    <div className="flex-2 mx-4">
                      <div className="text-sm">
                        <div><strong>Atual:</strong> "{result.translation}"</div>
                        <div><strong>Esperado:</strong> "{result.expected}"</div>
                      </div>
                    </div>
                    <div className="flex-none">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        result.isCorrect 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.isCorrect ? '✅ PASS' : '❌ FAIL'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Translation Demo */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Demo em Tempo Real / Real-time Demo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">Traduções Comuns</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Carregando:</strong> {t('common.loading')}</p>
                <p><strong>Erro:</strong> {t('common.error')}</p>
                <p><strong>Sucesso:</strong> {t('common.success')}</p>
                <p><strong>Salvar:</strong> {t('common.save')}</p>
                <p><strong>Cancelar:</strong> {t('common.cancel')}</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">Autenticação</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> {t('auth.email')}</p>
                <p><strong>Senha:</strong> {t('auth.password')}</p>
                <p><strong>Login:</strong> {t('auth.login')}</p>
                <p><strong>Acesso:</strong> {t('auth.accessAccount')}</p>
                <p><strong>Registrar:</strong> {t('auth.register')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p>
            Sistema de Traduções Funcional ✅ | Functional Translation System ✅
          </p>
        </div>
      </div>
    </div>
  );
}
