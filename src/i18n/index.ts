import enUS from './locales/en-US';
import ptBR from './locales/pt-BR';
import { getCacheValue, setCacheValue } from '@/lib/cache';

export type Locale = 'en-US' | 'pt-BR';

export const locales: Record<Locale, any> = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

export const defaultLocale: Locale = 'pt-BR';

export function getTranslation(locale: Locale, key: string, defaultValue?: string): string {
  // Validate inputs
  if (!key || typeof key !== 'string') {
    console.warn('🌐 Invalid translation key:', key);
    return defaultValue || key || '';
  }

  if (!locale || !Object.keys(locales).includes(locale)) {
    console.warn('🌐 Invalid locale:', locale, 'falling back to default');
    locale = defaultLocale;
  }

  // Check cache first
  const cacheKey = `i18n:${locale}:${key}`;
  const cachedValue = getCacheValue<string>(cacheKey);

  if (cachedValue !== undefined) {
    return cachedValue;
  }

  // Special handling for card IDs with hyphens
  // If the key starts with 'cards.' and contains hyphens, try to find a version without hyphens
  let modifiedKey = key;
  if (key.startsWith('cards.') && key.includes('-')) {
    // Create a version of the key without hyphens
    modifiedKey = key.replace(/-/g, '');
  }

  // Try with the original key first
  const keys = key.split('.');
  let translation: any = locales[locale];
  let found = true;

  // Try to find the translation in the current locale
  for (const k of keys) {
    if (!translation || typeof translation !== 'object' || !translation[k]) {
      found = false;
      break;
    }
    translation = translation[k];
  }

  // If found in current locale, cache and return it
  if (found && typeof translation === 'string') {
    setCacheValue(cacheKey, translation);
    return translation;
  }

  // If not found and we have a modified key (without hyphens), try that
  if (!found && modifiedKey !== key) {
    const modifiedKeys = modifiedKey.split('.');
    translation = locales[locale];
    found = true;

    for (const k of modifiedKeys) {
      if (!translation || typeof translation !== 'object' || !translation[k]) {
        found = false;
        break;
      }
      translation = translation[k];
    }

    if (found && typeof translation === 'string') {
      setCacheValue(cacheKey, translation);
      return translation;
    }
  }

  // Try to find in default locale if not found in current locale
  if (locale !== defaultLocale) {
    // Try with original key
    translation = locales[defaultLocale];
    found = true;

    for (const k of keys) {
      if (!translation || typeof translation !== 'object' || !translation[k]) {
        found = false;
        break;
      }
      translation = translation[k];
    }

    if (found && typeof translation === 'string') {
      console.log(`🌐 Found translation for '${key}' in default locale ${defaultLocale}`);
      setCacheValue(cacheKey, translation);
      return translation;
    }

    // Try with modified key (without hyphens) in default locale
    if (modifiedKey !== key) {
      const modifiedKeys = modifiedKey.split('.');
      translation = locales[defaultLocale];
      found = true;

      for (const k of modifiedKeys) {
        if (!translation || typeof translation !== 'object' || !translation[k]) {
          found = false;
          break;
        }
        translation = translation[k];
      }

      if (found && typeof translation === 'string') {
        console.log(`🌐 Found translation for modified key '${modifiedKey}' in default locale ${defaultLocale}`);
        setCacheValue(cacheKey, translation);
        return translation;
      }
    }
  }

  // Cache and return default value or key if not found in any locale
  const result = defaultValue || key;
  console.warn(`🌐 Translation missing for key '${key}' in locale '${locale}', using fallback: '${result}'`);
  setCacheValue(cacheKey, result);
  return result;
}

export function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') {
    console.log('🌐 getBrowserLocale: Servidor, retornando padrão');
    return defaultLocale;
  }

  try {
    // Tentar obter o idioma do navegador
    const browserLocale = navigator.language ||
                         (navigator as any).userLanguage ||
                         (navigator as any).browserLanguage ||
                         (navigator as any).systemLanguage ||
                         defaultLocale;

    console.log('🌐 Idioma detectado do navegador:', browserLocale);

    // Verificar se o idioma começa com 'pt' (português)
    if (browserLocale.toLowerCase().startsWith('pt')) {
      console.log('🌐 Navegador detectado como português, retornando pt-BR');
      return 'pt-BR';
    }

    // Verificar se o idioma começa com 'en' (inglês)
    if (browserLocale.toLowerCase().startsWith('en')) {
      console.log('🌐 Navegador detectado como inglês, retornando en-US');
      return 'en-US';
    }

    // Para outros idiomas, usar inglês como padrão
    console.log('🌐 Navegador com idioma não suportado, retornando en-US');
    return 'en-US';
  } catch (error) {
    console.error('🌐 Erro ao detectar idioma do navegador:', error);
    return defaultLocale;
  }
}

export function getLocalStorageLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedLocale = localStorage.getItem('locale') as Locale;

  if (storedLocale && Object.keys(locales).includes(storedLocale)) {
    return storedLocale;
  }

  return null;
}

export function setLocalStorageLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('locale', locale);
}

export function getInitialLocale(): Locale {
  console.log('🌐 Obtendo idioma inicial...');

  // Only run on client side to avoid hydration issues
  if (typeof window === 'undefined') {
    console.log('🌐 Servidor: retornando idioma padrão pt-BR');
    return defaultLocale;
  }

  // First check localStorage - this should have priority over browser detection
  const localStorageLocale = getLocalStorageLocale();
  if (localStorageLocale) {
    console.log('🌐 Idioma encontrado no localStorage:', localStorageLocale);
    return localStorageLocale;
  }

  // Check for cookie (for server-side rendering)
  if (typeof document !== 'undefined') {
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('NEXT_LOCALE='))
      ?.split('=')[1] as Locale;

    if (cookieLocale && Object.keys(locales).includes(cookieLocale)) {
      console.log('🌐 Idioma encontrado no cookie:', cookieLocale);
      // Also save to localStorage for consistency
      setLocalStorageLocale(cookieLocale);
      return cookieLocale;
    }
  }

  // Only use browser locale if no user preference is set
  const browserLocale = getBrowserLocale();
  console.log('🌐 Usando idioma do navegador:', browserLocale);

  // Save the detected locale to localStorage for future use
  setLocalStorageLocale(browserLocale);

  return browserLocale;
}
