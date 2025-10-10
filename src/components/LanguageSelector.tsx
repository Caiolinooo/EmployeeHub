'use client';

import React, { useState, useEffect } from 'react';
import { FiGlobe, FiCheck, FiLoader } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { Locale } from '@/i18n';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'modal' | 'inline';
  className?: string;
}

export default function LanguageSelector({
  const { t } = useI18n();
 variant = 'dropdown', className = '' }: LanguageSelectorProps) {
  const { locale, setLocale, t, availableLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Reset changing state when locale actually changes
  useEffect(() => {
    if (isChanging) {
      const timer = setTimeout(() => {
        setIsChanging(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [locale, isChanging]);

  const getLanguageName = (localeCode: Locale) => {
    switch (localeCode) {
      case 'pt-BR':
        return t('common.portuguese');
      case 'en-US':
        return t('common.english');
      default:
        return localeCode;
    }
  };

  const getLanguageFlag = (localeCode: Locale) => {
    switch (localeCode) {
      case 'pt-BR':
        return '🇧🇷';
      case 'en-US':
        return '🇺🇸';
      default:
        return '🌐';
    }
  };

  const handleSelectLanguage = async (localeCode: Locale) => {
    console.log('🌐 LanguageSelector: Selecionando idioma:', localeCode);
    console.log('🌐 LanguageSelector: Idioma atual:', locale);

    // Only change if different
    if (localeCode !== locale) {
      setIsChanging(true);
      setLocale(localeCode);
      console.log('🌐 LanguageSelector: Idioma alterado para:', localeCode);

      // Small delay to show the change is happening
      setTimeout(() => {
        setIsChanging(false);
      }, 500);
    } else {
      console.log(t('components.languageselectorIdiomaJaEOAtualNaoAlterando'));
    }

    setIsOpen(false);
  };

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 focus:outline-none"
          aria-label={t('common.chooseLanguage')}
          disabled={isChanging}
        >
          {isChanging ? (
            <FiLoader className="h-5 w-5 animate-spin" />
          ) : (
            <FiGlobe className="h-5 w-5" />
          )}
          <span className="inline-block">{getLanguageFlag(locale)}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
            <div className="py-1" role="menu" aria-orientation="vertical">
              {availableLocales.map((localeCode) => (
                <button
                  key={localeCode}
                  onClick={() => handleSelectLanguage(localeCode)}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    locale === localeCode ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  } hover:bg-gray-100 flex items-center justify-between`}
                  role="menuitem"
                >
                  <span className="flex items-center">
                    <span className="mr-2">{getLanguageFlag(localeCode)}</span>
                    {getLanguageName(localeCode)}
                  </span>
                  {locale === localeCode && <FiCheck className="h-4 w-4 text-green-500" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Modal variant
  if (variant === 'modal') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center space-x-1 text-gray-700 hover:text-gray-900 focus:outline-none ${className}`}
          aria-label={t('common.chooseLanguage')}
        >
          <FiGlobe className="h-5 w-5" />
          <span className="inline-block">{getLanguageFlag(locale)}</span>
        </button>

        {isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">{t('common.chooseLanguage')}</h2>
              <div className="space-y-2">
                {availableLocales.map((localeCode) => (
                  <button
                    key={localeCode}
                    onClick={() => handleSelectLanguage(localeCode)}
                    className={`w-full text-left px-4 py-3 rounded-md ${
                      locale === localeCode ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-700 hover:bg-gray-100'
                    } flex items-center justify-between`}
                  >
                    <span className="flex items-center">
                      <span className="text-2xl mr-3">{getLanguageFlag(localeCode)}</span>
                      <span className="font-medium">{getLanguageName(localeCode)}</span>
                    </span>
                    {locale === localeCode && <FiCheck className="h-5 w-5 text-blue-500" />}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline variant
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {isChanging && (
        <FiLoader className="h-4 w-4 animate-spin text-blue-500" />
      )}
      {availableLocales.map((localeCode) => (
        <button
          key={localeCode}
          onClick={() => handleSelectLanguage(localeCode)}
          className={`flex items-center px-2 py-1 rounded transition-colors ${
            locale === localeCode ? 'bg-gray-200 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
          } ${isChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={getLanguageName(localeCode)}
          disabled={isChanging}
        >
          <span className="mr-1">{getLanguageFlag(localeCode)}</span>
          <span className="text-sm">{localeCode.split('-')[0].toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
