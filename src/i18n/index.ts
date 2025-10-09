import enUS from './locales/en-US';
import ptBR from './locales/pt-BR';

export type Locale = 'en-US' | 'pt-BR';

export const locales: Record<Locale, any> = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

export const defaultLocale: Locale = 'pt-BR';

export function getTranslation(locale: Locale, key: string, defaultValue?: string): string {
  // Validate inputs
  if (!key || typeof key !== 'string') {
    return defaultValue || key || '';
  }

  if (!locale || !Object.keys(locales).includes(locale)) {
    locale = defaultLocale;
  }

  // Try to find the translation in the current locale
  const keys = key.split('.');
  let translation: any = locales[locale];

  for (const k of keys) {
    if (!translation || typeof translation !== 'object' || !translation[k]) {
      translation = null;
      break;
    }
    translation = translation[k];
  }

  // If found and is a string, return it
  if (translation && typeof translation === 'string') {
    return translation;
  }

  // Try fallback to default locale if current locale is not default
  if (locale !== defaultLocale) {
    let fallbackTranslation: any = locales[defaultLocale];

    for (const k of keys) {
      if (!fallbackTranslation || typeof fallbackTranslation !== 'object' || !fallbackTranslation[k]) {
        fallbackTranslation = null;
        break;
      }
      fallbackTranslation = fallbackTranslation[k];
    }

    if (fallbackTranslation && typeof fallbackTranslation === 'string') {
      return fallbackTranslation;
    }
  }

  // Return default value or key as fallback
  return defaultValue || key;
}
