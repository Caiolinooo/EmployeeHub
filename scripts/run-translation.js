#!/usr/bin/env node

/**
 * EXECUTOR PRINCIPAL DO SISTEMA DE TRADUÇÕES
 * 
 * Este é o script principal que coordena todo o processo de tradução automática.
 * 
 * Uso:
 *   node scripts/run-translation.js [opções]
 * 
 * Opções:
 *   --resume         Retoma do último checkpoint
 *   --module=nome    Processa apenas um módulo específico
 *   --dry-run        Simula sem fazer alterações
 *   --reset          Reseta o checkpoint e começa do zero
 * 
 * Exemplos:
 *   node scripts/run-translation.js                    # Inicia novo processamento
 *   node scripts/run-translation.js --resume           # Retoma do checkpoint
 *   node scripts/run-translation.js --module=profile   # Apenas módulo profile
 *   node scripts/run-translation.js --dry-run          # Simula sem alterar
 */

const fs = require('fs');
const path = require('path');
const { escapeSingleQuotedJsString } = require('./escape-single-quoted-js-string');
const { CONFIG, TranslationState, Logger } = require('./auto-translate');
const {
  shouldIgnore,
  hasFileExtension,
  generateTranslationKey,
  translateToEnglish,
  StringDetector,
  StringReplacer,
} = require('./translation-processor');

// ============================================================================
// ARGUMENTOS DA LINHA DE COMANDO
// ============================================================================

const args = process.argv.slice(2);
const options = {
  resume: args.includes('--resume'),
  dryRun: args.includes('--dry-run'),
  reset: args.includes('--reset'),
  module: args.find(arg => arg.startsWith('--module='))?.split('=')[1],
};

// ============================================================================
// GERENCIADOR DE TRADUÇÕES
// ============================================================================

class TranslationManager {
  constructor(state, logger, options) {
    this.state = state;
    this.logger = logger;
    this.options = options;
    this.detector = new StringDetector();
    this.replacer = new StringReplacer(logger);
    this.translationsToAdd = {
      ptBR: {},
      enUS: {},
    };
  }

  async run() {
    this.logger.info('🚀 Iniciando processamento de traduções...');
    
    if (this.options.dryRun) {
      this.logger.warning('⚠️  MODO DRY-RUN: Nenhuma alteração será feita');
    }
    
    // Coletar arquivos
    const files = this.collectFiles();
    this.state.checkpoint.progress.totalFiles = files.length;
    this.state.save();
    
    this.logger.info(`📁 Encontrados ${files.length} arquivos para processar`);
    
    // Processar arquivos
    for (const file of files) {
      await this.processFile(file);
    }
    
    // Adicionar traduções aos arquivos de idioma
    if (!this.options.dryRun) {
      await this.addTranslationsToFiles();
    }
    
    // Marcar como concluído
    this.state.checkpoint.completed = true;
    this.state.save();
    
    // Exibir resumo
    this.logger.summary(this.state);
    this.logger.success('✅ Processamento concluído!');
  }

  collectFiles() {
    const files = [];
    
    const scanDirectory = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          
          if (shouldIgnore(fullPath)) return;
          
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (stat.isFile() && hasFileExtension(fullPath)) {
            // Verificar se já foi processado
            if (this.options.resume && this.state.isFileProcessed(fullPath)) {
              return;
            }
            
            files.push(fullPath);
          }
        });
      } catch (error) {
        this.logger.error(`Erro ao escanear ${dir}: ${error.message}`);
      }
    };
    
    // Escanear diretórios configurados
    CONFIG.directories.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        scanDirectory(fullPath);
      }
    });
    
    return files;
  }

  async processFile(filePath) {
    try {
      this.logger.info(`📄 Processando: ${filePath}`);
      
      // Ler conteúdo
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Detectar strings
      const strings = this.detector.findStrings(content, filePath);
      
      if (strings.length === 0) {
        this.logger.info(`   ✓ Nenhuma string encontrada`);
        this.state.markFileProcessed(filePath, 0, 0);
        return;
      }
      
      this.logger.info(`   🔍 Encontradas ${strings.length} strings`);
      
      // Determinar módulo
      const module = this.getModuleFromPath(filePath);
      
      // Preparar substituições
      const replacements = [];
      let translatedCount = 0;
      
      strings.forEach(({ text, line, fullMatch }) => {
        // Gerar chave de tradução
        const key = generateTranslationKey(text, module);
        
        // Traduzir para inglês
        const enText = translateToEnglish(text);
        
        // Adicionar às traduções
        if (!this.translationsToAdd.ptBR[module]) {
          this.translationsToAdd.ptBR[module] = {};
          this.translationsToAdd.enUS[module] = {};
        }
        
        this.translationsToAdd.ptBR[module][key.split('.')[1]] = text;
        this.translationsToAdd.enUS[module][key.split('.')[1]] = enText;
        
        // Preparar substituição
        const replacement = `{t('${key}')}`;
        replacements.push({
          original: fullMatch,
          replacement,
        });
        
        translatedCount++;
        
        this.logger.info(`   ✓ Linha ${line}: "${text}" → t('${key}')`);
        this.state.addTranslation(key, text, enText, module);
      });
      
      // Fazer substituições
      if (!this.options.dryRun && replacements.length > 0) {
        const success = this.replacer.replaceInFile(filePath, replacements);
        if (success) {
          this.logger.success(`   ✅ Arquivo atualizado com ${translatedCount} traduções`);
        } else {
          this.logger.warning(`   ⚠️  Arquivo não foi modificado`);
        }
      }
      
      // Marcar como processado
      this.state.markFileProcessed(filePath, strings.length, translatedCount);
      
    } catch (error) {
      this.logger.error(`Erro ao processar ${filePath}: ${error.message}`);
      this.state.checkpoint.progress.errors++;
      this.state.save();
    }
  }

  getModuleFromPath(filePath) {
    // Extrair módulo do caminho
    const normalized = filePath.replace(/\\/g, '/');
    
    if (normalized.includes('/app/profile')) return 'profile';
    if (normalized.includes('/app/academy')) return 'academy';
    if (normalized.includes('/app/reembolso')) return 'reimbursement';
    if (normalized.includes('/app/calendar')) return 'calendar';
    if (normalized.includes('/app/contacts')) return 'contacts';
    if (normalized.includes('/app/admin')) return 'admin';
    if (normalized.includes('/app/dashboard')) return 'dashboard';
    if (normalized.includes('/components')) return 'components';
    
    return 'common';
  }

  async addTranslationsToFiles() {
    this.logger.info('📝 Adicionando traduções aos arquivos de idioma...');
    
    // Adicionar ao pt-BR.ts
    await this.addToTranslationFile(
      CONFIG.translationFiles.ptBR,
      this.translationsToAdd.ptBR,
      'pt-BR'
    );
    
    // Adicionar ao en-US.ts
    await this.addToTranslationFile(
      CONFIG.translationFiles.enUS,
      this.translationsToAdd.enUS,
      'en-US'
    );
    
    this.logger.success('✅ Traduções adicionadas aos arquivos de idioma');
  }

  async addToTranslationFile(filePath, translations, locale) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Para cada módulo
      Object.keys(translations).forEach(module => {
        const moduleTranslations = translations[module];
        
        // Verificar se o módulo já existe
        const modulePattern = new RegExp(`${module}:\\s*\\{`, 'g');
        
        if (modulePattern.test(content)) {
          // Módulo existe, adicionar traduções
          this.logger.info(`   Adicionando traduções ao módulo existente: ${module}`);
          
          // Encontrar o final do objeto do módulo
          const moduleStart = content.search(modulePattern);
          let braceCount = 0;
          let moduleEnd = moduleStart;
          let inModule = false;
          
          for (let i = moduleStart; i < content.length; i++) {
            if (content[i] === '{') {
              braceCount++;
              inModule = true;
            } else if (content[i] === '}') {
              braceCount--;
              if (inModule && braceCount === 0) {
                moduleEnd = i;
                break;
              }
            }
          }
          
          // Adicionar traduções antes do }
          const translationsStr = Object.entries(moduleTranslations)
            .map(([key, value]) => `    ${key}: '${escapeSingleQuotedJsString(value)}',`)
            .join('\n');
          
          content = 
            content.slice(0, moduleEnd) +
            '\n' + translationsStr + '\n  ' +
            content.slice(moduleEnd);
          
        } else {
          // Módulo não existe, criar novo
          this.logger.info(`   Criando novo módulo: ${module}`);
          
          const translationsStr = Object.entries(moduleTranslations)
            .map(([key, value]) => `    ${key}: '${escapeSingleQuotedJsString(value)}',`)
            .join('\n');
          
          const newModule = `  ${module}: {\n${translationsStr}\n  },\n`;
          
          // Adicionar antes do último }
          const lastBrace = content.lastIndexOf('}');
          content = 
            content.slice(0, lastBrace) +
            newModule +
            content.slice(lastBrace);
        }
      });
      
      // Salvar arquivo
      fs.writeFileSync(filePath, content, 'utf8');
      this.logger.success(`   ✅ Arquivo ${locale} atualizado`);
      
    } catch (error) {
      this.logger.error(`Erro ao atualizar ${filePath}: ${error.message}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║           🌍 SISTEMA AUTOMATIZADO DE TRADUÇÕES 🌍                         ║
║                                                                           ║
║                      Painel ABZ Group                                     ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);

  // Resetar checkpoint se solicitado
  if (options.reset) {
    if (fs.existsSync(CONFIG.checkpointFile)) {
      fs.unlinkSync(CONFIG.checkpointFile);
      console.log('✅ Checkpoint resetado\n');
    }
  }

  // Inicializar
  const state = new TranslationState();
  const logger = new Logger();
  const manager = new TranslationManager(state, logger, options);

  // Executar
  try {
    await manager.run();
  } catch (error) {
    logger.error(`Erro fatal: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Executar
main();

