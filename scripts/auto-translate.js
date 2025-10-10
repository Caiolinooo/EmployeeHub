/**
 * SISTEMA AUTOMATIZADO DE TRADUÇÕES
 * 
 * Este script automatiza a correção de strings hardcoded no sistema,
 * substituindo-as por chamadas ao sistema de tradução.
 * 
 * Funcionalidades:
 * - Detecta strings hardcoded em português
 * - Gera chaves de tradução automaticamente
 * - Substitui strings nos arquivos
 * - Adiciona traduções em pt-BR.ts e en-US.ts
 * - Sistema de checkpoint para retomar trabalho
 * - Logs detalhados de progresso
 * 
 * Uso:
 *   node scripts/auto-translate.js [--resume] [--module=nome]
 * 
 * Opções:
 *   --resume         Retoma do último checkpoint
 *   --module=nome    Processa apenas um módulo específico
 *   --dry-run        Simula sem fazer alterações
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  // Diretórios para processar
  directories: [
    'src/app/profile',
    'src/app/academy',
    'src/app/reembolso',
    'src/app/calendar',
    'src/app/contacts',
    'src/app/admin',
    'src/app/dashboard',
    'src/components',
  ],
  
  // Arquivos de tradução
  translationFiles: {
    ptBR: 'src/i18n/locales/pt-BR.ts',
    enUS: 'src/i18n/locales/en-US.ts',
  },
  
  // Arquivo de checkpoint
  checkpointFile: 'scripts/.translation-checkpoint.json',
  
  // Arquivo de log
  logFile: 'scripts/translation-progress.log',
  
  // Extensões de arquivo para processar
  fileExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  
  // Arquivos/diretórios para ignorar
  ignore: [
    'node_modules',
    '.next',
    'dist',
    'build',
    '.git',
    'test',
    'spec',
    '.test.',
    '.spec.',
  ],
};

// ============================================================================
// MAPEAMENTO DE TRADUÇÕES COMUNS
// ============================================================================

const COMMON_TRANSLATIONS = {
  // Ações
  'Salvar': { key: 'common.save', en: 'Save' },
  'Cancelar': { key: 'common.cancel', en: 'Cancel' },
  'Editar': { key: 'common.edit', en: 'Edit' },
  'Excluir': { key: 'common.delete', en: 'Delete' },
  'Adicionar': { key: 'common.add', en: 'Add' },
  'Remover': { key: 'common.remove', en: 'Remove' },
  'Buscar': { key: 'common.search', en: 'Search' },
  'Filtrar': { key: 'common.filter', en: 'Filter' },
  'Visualizar': { key: 'common.view', en: 'View' },
  'Download': { key: 'common.download', en: 'Download' },
  'Upload': { key: 'common.upload', en: 'Upload' },
  'Enviar': { key: 'common.send', en: 'Send' },
  'Voltar': { key: 'common.back', en: 'Back' },
  'Próximo': { key: 'common.next', en: 'Next' },
  'Anterior': { key: 'common.previous', en: 'Previous' },
  'Confirmar': { key: 'common.confirm', en: 'Confirm' },
  'Fechar': { key: 'common.close', en: 'Close' },
  'Abrir': { key: 'common.open', en: 'Open' },
  'Atualizar': { key: 'common.update', en: 'Update' },
  'Criar': { key: 'common.create', en: 'Create' },
  'Novo': { key: 'common.new', en: 'New' },
  'Limpar': { key: 'common.clear', en: 'Clear' },
  'Aplicar': { key: 'common.apply', en: 'Apply' },
  'Resetar': { key: 'common.reset', en: 'Reset' },
  
  // Status
  'Sucesso': { key: 'common.success', en: 'Success' },
  'Erro': { key: 'common.error', en: 'Error' },
  'Atenção': { key: 'common.warning', en: 'Warning' },
  'Carregando': { key: 'common.loading', en: 'Loading' },
  'Processando': { key: 'common.processing', en: 'Processing' },
  'Aguardando': { key: 'common.waiting', en: 'Waiting' },
  'Concluído': { key: 'common.completed', en: 'Completed' },
  'Pendente': { key: 'common.pending', en: 'Pending' },
  'Aprovado': { key: 'common.approved', en: 'Approved' },
  'Rejeitado': { key: 'common.rejected', en: 'Rejected' },
  'Cancelado': { key: 'common.cancelled', en: 'Cancelled' },
  'Ativo': { key: 'common.active', en: 'Active' },
  'Inativo': { key: 'common.inactive', en: 'Inactive' },
  
  // Campos
  'Nome': { key: 'common.name', en: 'Name' },
  'Email': { key: 'common.email', en: 'Email' },
  'Telefone': { key: 'common.phone', en: 'Phone' },
  'Senha': { key: 'common.password', en: 'Password' },
  'Descrição': { key: 'common.description', en: 'Description' },
  'Título': { key: 'common.title', en: 'Title' },
  'Data': { key: 'common.date', en: 'Date' },
  'Hora': { key: 'common.time', en: 'Time' },
  'Categoria': { key: 'common.category', en: 'Category' },
  'Status': { key: 'common.status', en: 'Status' },
  'Tipo': { key: 'common.type', en: 'Type' },
  'Valor': { key: 'common.value', en: 'Value' },
  'Total': { key: 'common.total', en: 'Total' },
  
  // Outros
  'Sim': { key: 'common.yes', en: 'Yes' },
  'Não': { key: 'common.no', en: 'No' },
  'Todos': { key: 'common.all', en: 'All' },
  'Nenhum': { key: 'common.none', en: 'None' },
  'Selecione': { key: 'common.select', en: 'Select' },
  'Opcional': { key: 'common.optional', en: 'Optional' },
  'Obrigatório': { key: 'common.required', en: 'Required' },
};

// ============================================================================
// ESTADO E CHECKPOINT
// ============================================================================

class TranslationState {
  constructor() {
    this.checkpoint = this.loadCheckpoint();
  }

  loadCheckpoint() {
    if (fs.existsSync(CONFIG.checkpointFile)) {
      try {
        const data = fs.readFileSync(CONFIG.checkpointFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        console.error('⚠️  Erro ao carregar checkpoint:', error.message);
        return this.createNewCheckpoint();
      }
    }
    return this.createNewCheckpoint();
  }

  createNewCheckpoint() {
    return {
      version: '1.0.0',
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      progress: {
        totalFiles: 0,
        processedFiles: 0,
        totalStrings: 0,
        translatedStrings: 0,
        errors: 0,
      },
      processedFiles: [],
      pendingFiles: [],
      translations: {
        added: [],
        skipped: [],
      },
      currentModule: null,
      completed: false,
    };
  }

  save() {
    this.checkpoint.lastUpdated = new Date().toISOString();
    fs.writeFileSync(
      CONFIG.checkpointFile,
      JSON.stringify(this.checkpoint, null, 2),
      'utf8'
    );
  }

  markFileProcessed(filePath, stringsFound, stringsTranslated) {
    this.checkpoint.processedFiles.push({
      path: filePath,
      processedAt: new Date().toISOString(),
      stringsFound,
      stringsTranslated,
    });
    this.checkpoint.progress.processedFiles++;
    this.checkpoint.progress.totalStrings += stringsFound;
    this.checkpoint.progress.translatedStrings += stringsTranslated;
    this.save();
  }

  addTranslation(key, ptText, enText, module) {
    this.checkpoint.translations.added.push({
      key,
      ptText,
      enText,
      module,
      addedAt: new Date().toISOString(),
    });
    this.save();
  }

  isFileProcessed(filePath) {
    return this.checkpoint.processedFiles.some(f => f.path === filePath);
  }

  getProgress() {
    const { progress } = this.checkpoint;
    const percentage = progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : 0;
    
    return {
      ...progress,
      percentage,
    };
  }
}

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  constructor() {
    this.logFile = CONFIG.logFile;
    this.startTime = Date.now();
    
    // Criar arquivo de log
    const header = `
${'='.repeat(80)}
SISTEMA AUTOMATIZADO DE TRADUÇÕES
Iniciado em: ${new Date().toISOString()}
${'='.repeat(80)}

`;
    fs.writeFileSync(this.logFile, header, 'utf8');
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    // Escrever no arquivo
    fs.appendFileSync(this.logFile, logMessage, 'utf8');
    
    // Exibir no console com cores
    const colors = {
      INFO: '\x1b[36m',    // Cyan
      SUCCESS: '\x1b[32m', // Green
      WARNING: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m',   // Red
      RESET: '\x1b[0m',
    };
    
    const color = colors[level] || colors.INFO;
    console.log(`${color}${logMessage.trim()}${colors.RESET}`);
  }

  info(message) {
    this.log(message, 'INFO');
  }

  success(message) {
    this.log(message, 'SUCCESS');
  }

  warning(message) {
    this.log(message, 'WARNING');
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  summary(state) {
    const progress = state.getProgress();
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    
    const summary = `
${'='.repeat(80)}
RESUMO DO PROCESSAMENTO
${'='.repeat(80)}

📊 Estatísticas:
   - Arquivos processados: ${progress.processedFiles}/${progress.totalFiles} (${progress.percentage}%)
   - Strings encontradas: ${progress.totalStrings}
   - Strings traduzidas: ${progress.translatedStrings}
   - Erros: ${progress.errors}
   - Tempo decorrido: ${elapsed}s

✅ Status: ${state.checkpoint.completed ? 'CONCLUÍDO' : 'EM PROGRESSO'}

${'='.repeat(80)}
`;
    
    this.log(summary, 'INFO');
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  CONFIG,
  COMMON_TRANSLATIONS,
  TranslationState,
  Logger,
};

