'use client';

import { useEffect, useState } from 'react';
import { FiLoader } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { Locale } from '@/i18n';

/** Inline EN/PT só no login mobile. Visual igual ao `LanguageSelector` inline; hit ≥ 44×44. */
export default function MobileLanguageSelector() {
  const { locale, setLocale, t, availableLocales } = useI18n();
  const [isChanging, setIsChanging] = useState(false);

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
      default: {
        const _never: never = localeCode;
        return _never;
      }
    }
  };

  const getLanguageCode = (localeCode: Locale) => {
    switch (localeCode) {
      case 'pt-BR':
        return 'PT';
      case 'en-US':
        return 'EN';
      default: {
        const _never: never = localeCode;
        return _never;
      }
    }
  };

  const handleSelectLanguage = (localeCode: Locale) => {
    if (localeCode !== locale) {
      setIsChanging(true);
      setLocale(localeCode);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {isChanging ? <FiLoader className="h-4 w-4 animate-spin text-blue-500" /> : null}
      {availableLocales.map((localeCode) => (
        <button
          key={localeCode}
          type="button"
          onClick={() => handleSelectLanguage(localeCode)}
          className={`touch-target inline-flex items-center justify-center ${
            isChanging ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label={getLanguageName(localeCode)}
          disabled={isChanging}
          data-abz-touch={`lang-${getLanguageCode(localeCode).toLowerCase()}`}
        >
          <span
            className={`flex items-center px-2 py-1 rounded ${
              locale === localeCode ? 'bg-gray-200 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-sm font-medium">{getLanguageCode(localeCode)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
