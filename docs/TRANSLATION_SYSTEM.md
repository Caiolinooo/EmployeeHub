# Sistema de Traduções / Translation System

## 📋 Visão Geral / Overview

O Painel ABZ utiliza um sistema de internacionalização (i18n) customizado que suporta múltiplos idiomas com persistência de estado e fallbacks robustos.

The ABZ Panel uses a custom internationalization (i18n) system that supports multiple languages with state persistence and robust fallbacks.

### Idiomas Suportados / Supported Languages
- 🇧🇷 **Português (Brasil)** - `pt-BR` (padrão/default)
- 🇺🇸 **English (US)** - `en-US`

## 🏗️ Arquitetura / Architecture

### Componentes Principais / Main Components

1. **I18nContext** (`src/contexts/I18nContext.tsx`)
   - Gerencia o estado global do idioma
   - Fornece funções de tradução e mudança de idioma
   - Handles global language state
   - Provides translation and language switching functions

2. **Translation Files** (`src/i18n/locales/`)
   - `pt-BR.ts` - Traduções em português
   - `en-US.ts` - Traduções em inglês
   - Portuguese translations
   - English translations

3. **Core Functions** (`src/i18n/index.ts`)
   - `getTranslation()` - Função principal de tradução
   - `getInitialLocale()` - Detecção inicial do idioma
   - `getBrowserLocale()` - Detecção do idioma do navegador
   - Main translation function
   - Initial language detection
   - Browser language detection

4. **LanguageSelector** (`src/components/LanguageSelector.tsx`)
   - Componente para seleção de idioma
   - Múltiplas variantes (dropdown, inline, modal)
   - Language selection component
   - Multiple variants (dropdown, inline, modal)

## 🚀 Como Usar / How to Use

### Usando Traduções em Componentes / Using Translations in Components

```tsx
import { useI18n } from '@/contexts/I18nContext';

function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('auth.accessAccount')}</p>
      <button onClick={() => setLocale('en-US')}>
        {t('common.english')}
      </button>
    </div>
  );
}
```

### Adicionando Novas Traduções / Adding New Translations

1. **Adicione a chave em ambos os arquivos / Add the key in both files:**

```typescript
// src/i18n/locales/pt-BR.ts
export default {
  // ... outras traduções
  mySection: {
    newKey: 'Minha nova tradução'
  }
}

// src/i18n/locales/en-US.ts
export default {
  // ... other translations
  mySection: {
    newKey: 'My new translation'
  }
}
```

2. **Use a tradução / Use the translation:**

```tsx
const text = t('mySection.newKey');
```

### Seletor de Idioma / Language Selector

```tsx
import LanguageSelector from '@/components/LanguageSelector';

// Variante dropdown
<LanguageSelector variant="dropdown" />

// Variante inline
<LanguageSelector variant="inline" />

// Variante modal
<LanguageSelector variant="modal" />
```

## 🔧 Funcionalidades Avançadas / Advanced Features

### Sistema de Cache / Cache System
- Traduções são armazenadas em cache para melhor performance
- Cache é limpo automaticamente quando necessário
- Translations are cached for better performance
- Cache is automatically cleared when needed

### Fallback Inteligente / Smart Fallback
1. Tenta encontrar a tradução no idioma atual
2. Se não encontrar, tenta no idioma padrão (pt-BR)
3. Se ainda não encontrar, retorna a chave ou valor padrão
4. Tries to find translation in current language
5. If not found, tries in default language (pt-BR)
6. If still not found, returns key or default value

### Persistência / Persistence
- **localStorage**: Armazena a preferência do usuário
- **Cookies**: Para compatibilidade com SSR
- **Document.lang**: Atualiza o atributo lang do HTML
- **localStorage**: Stores user preference
- **Cookies**: For SSR compatibility
- **Document.lang**: Updates HTML lang attribute

### Detecção Automática / Auto Detection
1. Verifica localStorage
2. Verifica cookies
3. Verifica idioma do navegador
4. Usa idioma padrão como fallback
5. Checks localStorage
6. Checks cookies
7. Checks browser language
8. Uses default language as fallback

## 🧪 Testes / Testing

### Páginas de Teste / Test Pages
- `/test-translations` - Teste básico de traduções
- `/translation-debug` - Debug detalhado do sistema
- `/test-final` - Teste final abrangente
- Basic translation test
- Detailed system debug
- Comprehensive final test

### Scripts de Verificação / Verification Scripts
```bash
# Verificar traduções ausentes
npm run check-translations

# Limpar cache de traduções
npm run clear-i18n-cache

# Teste abrangente
node scripts/test-translations-comprehensive.js
```

## 🐛 Solução de Problemas / Troubleshooting

### Problema: Idioma não muda / Language doesn't change
**Solução / Solution:**
1. Verifique se o componente está dentro do I18nProvider
2. Verifique se a chave de tradução existe em ambos os idiomas
3. Limpe o cache do navegador e localStorage
4. Check if component is inside I18nProvider
5. Check if translation key exists in both languages
6. Clear browser cache and localStorage

### Problema: Tradução não encontrada / Translation not found
**Solução / Solution:**
1. Verifique a estrutura da chave (ex: 'section.subsection.key')
2. Confirme que a chave existe em ambos os arquivos de tradução
3. Use o valor padrão: `t('key', 'Default value')`
4. Check key structure (e.g., 'section.subsection.key')
5. Confirm key exists in both translation files
6. Use default value: `t('key', 'Default value')`

### Problema: Hidratação / Hydration Issues
**Solução / Solution:**
1. O sistema já trata problemas de hidratação automaticamente
2. Se persistir, verifique se há renderização condicional baseada em `mounted`
3. System already handles hydration issues automatically
4. If persisting, check for conditional rendering based on `mounted`

## 📊 Estatísticas / Statistics

- **Total de chaves**: 695+ em cada idioma
- **Cobertura**: 100% entre pt-BR e en-US
- **Performance**: Cache inteligente reduz lookups
- **Compatibilidade**: SSR e CSR totalmente suportados
- **Total keys**: 695+ in each language
- **Coverage**: 100% between pt-BR and en-US
- **Performance**: Smart cache reduces lookups
- **Compatibility**: SSR and CSR fully supported

## 🔄 Atualizações Futuras / Future Updates

### Planejado / Planned
- [ ] Suporte para mais idiomas (ES, FR)
- [ ] Interface de administração para traduções
- [ ] Pluralização automática
- [ ] Interpolação de variáveis
- [ ] Support for more languages (ES, FR)
- [ ] Admin interface for translations
- [ ] Automatic pluralization
- [ ] Variable interpolation

## 📋 Referência Rápida / Quick Reference

### Hooks e Funções / Hooks and Functions
```tsx
const { t, locale, setLocale, availableLocales } = useI18n();

// Tradução simples / Simple translation
t('common.loading') // "Carregando..." ou "Loading..."

// Tradução com fallback / Translation with fallback
t('missing.key', 'Default text')

// Mudar idioma / Change language
setLocale('en-US')

// Idiomas disponíveis / Available languages
availableLocales // ['pt-BR', 'en-US']
```

### Estrutura de Chaves / Key Structure
```
common.loading          ✅ Correto / Correct
common.buttons.save     ✅ Correto / Correct
commonloading          ❌ Incorreto / Incorrect
common..loading        ❌ Incorreto / Incorrect
```

### Comandos Úteis / Useful Commands
```bash
# Verificar traduções
node scripts/check-missing-translations.js

# Limpar cache
node scripts/clear-i18n-cache.js

# Iniciar servidor de desenvolvimento
npm run dev
```

---

## 📞 Suporte / Support

Para problemas ou dúvidas sobre o sistema de traduções, consulte:
- Documentação técnica em `/docs/`
- Testes em `/src/app/test-*`
- Scripts em `/scripts/`

For issues or questions about the translation system, check:
- Technical documentation in `/docs/`
- Tests in `/src/app/test-*`
- Scripts in `/scripts/`
