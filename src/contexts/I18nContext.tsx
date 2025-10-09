'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, locales, getTranslation } from '@/i18n';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, defaultValue?: string) => string;
  locales: Record<Locale, any>;
  availableLocales: Locale[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  // Initialize with default locale to avoid hydration mismatch
  const [locale, setLocaleState] = useState<Locale>('pt-BR');
  const [mounted, setMounted] = useState(false);

  // Set mounted state and initialize locale on client side
  useEffect(() => {
    setMounted(true);

    // Get locale from localStorage on client side
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale;
      if (savedLocale && Object.keys(locales).includes(savedLocale)) {
        console.log('🌐 Locale carregado do localStorage:', savedLocale);
        setLocaleState(savedLocale);
      }
    }
  }, []);

  // Update document language when locale changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Function to set locale and save to localStorage
  const setLocale = (newLocale: Locale) => {
    console.log('🌐 Alterando idioma para:', newLocale);

    // Verificar se o idioma é válido
    if (!Object.keys(locales).includes(newLocale)) {
      console.error('🌐 Idioma inválido:', newLocale);
      return;
    }

    // Update state
    setLocaleState(newLocale);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }

    console.log('🌐 Idioma alterado com sucesso para:', newLocale);
  };

  // Translation function
  const t = (key: string, defaultValue?: string) => {
    return getTranslation(locale, key, defaultValue);
  };

  // Get available locales
  const availableLocales = Object.keys(locales) as Locale[];

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        locales,
        availableLocales,
      }}
    >
      {mounted ? children : null}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// HOC to wrap components with I18nProvider
export function withI18n<P extends object>(Component: React.ComponentType<P>) {
  return function WithI18n(props: P) {
    return (
      <I18nProvider>
        <Component {...props} />
      </I18nProvider>
    );
  };
}
