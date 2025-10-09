/**
 * Serviço de Tradução Automática
 * Detecta strings não traduzidas e gera traduções automaticamente
 */

import { getCacheValue, setCacheValue } from '@/lib/cache';

// Configuração do serviço de tradução
interface TranslationConfig {
  enabled: boolean;
  apiKey?: string;
  provider: 'google' | 'mock';
  autoSave: boolean;
  cacheExpiry: number; // em horas
}

// Cache de traduções geradas
interface TranslationCacheEntry {
  translation: string;
  timestamp: number;
  provider: string;
  verified: boolean;
}

class AutoTranslationService {
  private config: TranslationConfig;
  private translationQueue: Map<string, Promise<string>> = new Map();

  constructor() {
    this.config = {
      enabled: true,
      provider: 'mock', // Usar mock por padrão, pode ser alterado para 'google'
      autoSave: true,
      cacheExpiry: 24 * 7 // 7 dias
    };
  }

  /**
   * Configura o serviço de tradução
   */
  configure(config: Partial<TranslationConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Verifica se o serviço está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Gera uma tradução automática para uma chave
   */
  async translateKey(key: string, sourceLocale: string, targetLocale: string, fallbackText?: string): Promise<string> {
    if (!this.isEnabled()) {
      return fallbackText || key;
    }

    // Verificar cache primeiro
    const cacheKey = `auto-translation:${sourceLocale}:${targetLocale}:${key}`;
    const cached = this.getCachedTranslation(cacheKey);
    if (cached) {
      return cached.translation;
    }

    // Evitar múltiplas traduções da mesma chave
    if (this.translationQueue.has(cacheKey)) {
      return await this.translationQueue.get(cacheKey)!;
    }

    // Criar promessa de tradução
    const translationPromise = this.performTranslation(key, sourceLocale, targetLocale, fallbackText);
    this.translationQueue.set(cacheKey, translationPromise);

    try {
      const translation = await translationPromise;
      
      // Salvar no cache
      this.setCachedTranslation(cacheKey, {
        translation,
        timestamp: Date.now(),
        provider: this.config.provider,
        verified: false
      });

      // Auto-salvar se habilitado
      if (this.config.autoSave) {
        await this.saveTranslationToFile(key, translation, targetLocale);
      }

      return translation;
    } finally {
      this.translationQueue.delete(cacheKey);
    }
  }

  /**
   * Realiza a tradução usando o provider configurado
   */
  private async performTranslation(key: string, sourceLocale: string, targetLocale: string, fallbackText?: string): Promise<string> {
    const textToTranslate = fallbackText || this.keyToText(key);

    switch (this.config.provider) {
      case 'google':
        return await this.translateWithGoogle(textToTranslate, sourceLocale, targetLocale);
      case 'mock':
        return this.translateWithMock(textToTranslate, sourceLocale, targetLocale);
      default:
        return textToTranslate;
    }
  }

  /**
   * Tradução usando Google Translate API
   */
  private async translateWithGoogle(text: string, sourceLocale: string, targetLocale: string): Promise<string> {
    if (!this.config.apiKey) {
      console.warn('🌐 Google Translate API key not configured, using mock translation');
      return this.translateWithMock(text, sourceLocale, targetLocale);
    }

    try {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: this.localeToGoogleLang(sourceLocale),
          target: this.localeToGoogleLang(targetLocale),
          format: 'text'
        })
      });

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.translations[0].translatedText;
    } catch (error) {
      console.error('🌐 Google Translate error:', error);
      return this.translateWithMock(text, sourceLocale, targetLocale);
    }
  }

  /**
   * Tradução mock para desenvolvimento/fallback
   */
  private translateWithMock(text: string, sourceLocale: string, targetLocale: string): Promise<string> {
    // Simulação de tradução baseada em regras simples
    const translations: Record<string, Record<string, string>> = {
      'pt-BR': {
        'en-US': this.mockTranslatePtToEn(text)
      },
      'en-US': {
        'pt-BR': this.mockTranslateEnToPt(text)
      }
    };

    const result = translations[sourceLocale]?.[targetLocale] || text;
    
    // Simular delay de API
    return new Promise(resolve => {
      setTimeout(() => resolve(result), 100);
    });
  }

  /**
   * Tradução mock PT -> EN
   */
  private mockTranslatePtToEn(text: string): string {
    const commonTranslations: Record<string, string> = {
      'Carregando': 'Loading',
      'Erro': 'Error',
      'Sucesso': 'Success',
      'Salvar': 'Save',
      'Cancelar': 'Cancel',
      'Excluir': 'Delete',
      'Editar': 'Edit',
      'Visualizar': 'View',
      'Pesquisar': 'Search',
      'Filtrar': 'Filter',
      'Fechar': 'Close',
      'Confirmar': 'Confirm',
      'Voltar': 'Back',
      'Próximo': 'Next',
      'Anterior': 'Previous',
      'Enviar': 'Submit',
      'Ajuda': 'Help',
      'Dashboard': 'Dashboard',
      'Administração': 'Administration',
      'Configurações': 'Settings',
      'Usuários': 'Users',
      'Relatórios': 'Reports',
      'Notificações': 'Notifications'
    };

    return commonTranslations[text] || text;
  }

  /**
   * Tradução mock EN -> PT
   */
  private mockTranslateEnToPt(text: string): string {
    const commonTranslations: Record<string, string> = {
      'Loading': 'Carregando',
      'Error': 'Erro',
      'Success': 'Sucesso',
      'Save': 'Salvar',
      'Cancel': 'Cancelar',
      'Delete': 'Excluir',
      'Edit': 'Editar',
      'View': 'Visualizar',
      'Search': 'Pesquisar',
      'Filter': 'Filtrar',
      'Close': 'Fechar',
      'Confirm': 'Confirmar',
      'Back': 'Voltar',
      'Next': 'Próximo',
      'Previous': 'Anterior',
      'Submit': 'Enviar',
      'Help': 'Ajuda',
      'Dashboard': 'Dashboard',
      'Administration': 'Administração',
      'Settings': 'Configurações',
      'Users': 'Usuários',
      'Reports': 'Relatórios',
      'Notifications': 'Notificações'
    };

    return commonTranslations[text] || text;
  }

  /**
   * Converte chave em texto legível
   */
  private keyToText(key: string): string {
    return key
      .split('.')
      .pop()!
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Converte locale para código do Google Translate
   */
  private localeToGoogleLang(locale: string): string {
    const mapping: Record<string, string> = {
      'pt-BR': 'pt',
      'en-US': 'en',
      'es-ES': 'es'
    };
    return mapping[locale] || locale.split('-')[0];
  }

  /**
   * Obtém tradução do cache
   */
  private getCachedTranslation(cacheKey: string): TranslationCacheEntry | null {
    const cached = getCacheValue<TranslationCacheEntry>(cacheKey);
    if (!cached) return null;

    // Verificar se não expirou
    const now = Date.now();
    const expiryTime = cached.timestamp + (this.config.cacheExpiry * 60 * 60 * 1000);
    
    if (now > expiryTime) {
      return null;
    }

    return cached;
  }

  /**
   * Salva tradução no cache
   */
  private setCachedTranslation(cacheKey: string, entry: TranslationCacheEntry): void {
    setCacheValue(cacheKey, entry);
  }

  /**
   * Salva tradução no arquivo de locale (apenas no servidor)
   */
  private async saveTranslationToFile(key: string, translation: string, locale: string): Promise<void> {
    // Esta função só funciona no servidor (API routes)
    if (typeof window !== 'undefined') {
      console.log('🌐 Auto-save translation (client-side):', { key, translation, locale });
      return;
    }

    try {
      // Implementar salvamento no arquivo de locale
      console.log('🌐 Auto-saving translation:', { key, translation, locale });
      // TODO: Implementar salvamento real nos arquivos de locale
    } catch (error) {
      console.error('🌐 Error saving translation to file:', error);
    }
  }

  /**
   * Limpa cache de traduções
   */
  clearCache(): void {
    // Implementar limpeza do cache
    console.log('🌐 Clearing translation cache');
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats(): { cacheSize: number; queueSize: number } {
    return {
      cacheSize: 0, // TODO: Implementar contagem real
      queueSize: this.translationQueue.size
    };
  }
}

// Instância singleton
export const autoTranslationService = new AutoTranslationService();

// Função de conveniência para uso direto
export async function autoTranslate(key: string, sourceLocale: string, targetLocale: string, fallbackText?: string): Promise<string> {
  return await autoTranslationService.translateKey(key, sourceLocale, targetLocale, fallbackText);
}

export default autoTranslationService;
