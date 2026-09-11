import enUS from './locales/en-US';
import ptBR from './locales/pt-BR';
import { interpolateTranslationParams } from './interpolate';

export { interpolateTranslationParams } from './interpolate';

export type Locale = 'en-US' | 'pt-BR';

export const locales: Record<Locale, any> = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

export const defaultLocale: Locale = 'pt-BR';

export function getTranslation(locale: Locale, key: string, defaultValue?: string, params?: Record<string, string | number>): string {
  // Validate inputs
  if (!key || typeof key !== 'string') {
    return defaultValue || key || '';
  }

  // Normalize locale (case-insensitive check)
  let normalizedLocale = Object.keys(locales).find(l => l.toLowerCase() === (locale || '').toLowerCase());

  // If not found, try matching by prefix (e.g. 'en' -> 'en-US')
  if (!normalizedLocale && locale) {
    const prefix = String(locale).split('-')[0].toLowerCase();
    normalizedLocale = Object.keys(locales).find(l => l.toLowerCase().startsWith(prefix));
  }

  if (normalizedLocale) {
    locale = normalizedLocale as Locale;
  } else {
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
  let result = '';
  if (translation && typeof translation === 'string') {
    result = translation;
  } else if (locale !== defaultLocale) {
    // Try fallback to default locale if current locale is not default
    let fallbackTranslation: any = locales[defaultLocale];

    for (const k of keys) {
      if (!fallbackTranslation || typeof fallbackTranslation !== 'object' || !fallbackTranslation[k]) {
        fallbackTranslation = null;
        break;
      }
      fallbackTranslation = fallbackTranslation[k];
    }

    if (fallbackTranslation && typeof fallbackTranslation === 'string') {
      result = fallbackTranslation;
    }
  }

  return interpolateTranslationParams(result || defaultValue || key, params);
}
