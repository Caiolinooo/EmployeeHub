'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, locales, getInitialLocale, setLocalStorageLocale, getTranslation } from '@/i18n';

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

    // Get the actual initial locale on client side
    const initialLocale = getInitialLocale();
    console.log('🌐 Locale inicial detectado:', initialLocale);

    // Only set the locale if it's different from the current one AND we haven't mounted yet
    // This prevents overriding user selections
    if (initialLocale !== locale && !mounted) {
      setLocaleState(initialLocale);
    }

    // Set document language
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, []);

  // Function to set locale and save to localStorage
  const setLocale = (newLocale: Locale) => {
    console.log('🌐 Alterando idioma para:', newLocale);
    console.log('🌐 Idioma anterior:', locale);

    // Verificar se o idioma é válido
    if (!Object.keys(locales).includes(newLocale)) {
      console.error('🌐 Idioma inválido:', newLocale);
      return;
    }

    // Update state first
    setLocaleState(newLocale);

    // Save to localStorage
    setLocalStorageLocale(newLocale);

    // Atualizar o atributo lang do documento
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }

    // Definir um cookie para persistir o idioma entre sessões
    if (typeof document !== 'undefined') {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      console.log('🌐 Cookie definido para:', newLocale);
    }

    // Forçar uma atualização da interface
    if (typeof window !== 'undefined') {
      // Disparar um evento personalizado para notificar outros componentes
      window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale: newLocale } }));
      console.log('🌐 Evento localeChanged disparado para:', newLocale);

      // Force a re-render by triggering a storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'locale',
        newValue: newLocale,
        oldValue: locale
      }));
    }
  };

  // Listen for locale changes from other tabs/windows
  useEffect(() => {
    if (!mounted) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'locale' && e.newValue) {
        const newLocale = e.newValue as Locale;
        if (Object.keys(locales).includes(newLocale) && newLocale !== locale) {
          console.log('🌐 Locale alterado em outra aba:', newLocale);
          setLocaleState(newLocale);
          if (typeof document !== 'undefined') {
            document.documentElement.lang = newLocale;
          }
        }
      }
    };

    const handleLocaleChange = (e: CustomEvent) => {
      const newLocale = e.detail.locale as Locale;
      if (Object.keys(locales).includes(newLocale) && newLocale !== locale) {
        console.log('🌐 Locale alterado via evento customizado:', newLocale);
        setLocaleState(newLocale);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localeChanged', handleLocaleChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localeChanged', handleLocaleChange as EventListener);
    };
  }, [mounted, locale]);

  // Translation function
  const t = (key: string, defaultValue?: string) => {
    return getTranslation(locale, key, defaultValue);
  };

  // Get available locales
  const availableLocales = Object.keys(locales) as Locale[];

  // Only render children when mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

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
      {children}
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
