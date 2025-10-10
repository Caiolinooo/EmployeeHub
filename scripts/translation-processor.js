/**
 * PROCESSADOR DE TRADUÇÕES
 * 
 * Processa arquivos e substitui strings hardcoded por traduções
 */

const fs = require('fs');
const path = require('path');
const { CONFIG, COMMON_TRANSLATIONS } = require('./auto-translate');

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function shouldIgnore(filePath) {
  return CONFIG.ignore.some(ignore => filePath.includes(ignore));
}

function hasFileExtension(filePath) {
  const ext = path.extname(filePath);
  return CONFIG.fileExtensions.includes(ext);
}

function generateTranslationKey(text, module) {
  // Remover acentos e caracteres especiais
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  
  // Criar chave camelCase
  const words = normalized.split(' ');
  const camelCase = words
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
  
  // Limitar tamanho
  const key = camelCase.substring(0, 50);
  
  return `${module}.${key}`;
}

function translateToEnglish(ptText) {
  // Traduções comuns
  const commonTranslations = {
    // Ações
    'Salvar': 'Save',
    'Cancelar': 'Cancel',
    'Editar': 'Edit',
    'Excluir': 'Delete',
    'Adicionar': 'Add',
    'Remover': 'Remove',
    'Buscar': 'Search',
    'Filtrar': 'Filter',
    'Visualizar': 'View',
    'Download': 'Download',
    'Upload': 'Upload',
    'Enviar': 'Send',
    'Voltar': 'Back',
    'Próximo': 'Next',
    'Anterior': 'Previous',
    'Confirmar': 'Confirm',
    'Fechar': 'Close',
    'Abrir': 'Open',
    'Atualizar': 'Update',
    'Criar': 'Create',
    'Novo': 'New',
    'Limpar': 'Clear',
    'Aplicar': 'Apply',
    'Resetar': 'Reset',
    
    // Status
    'Sucesso': 'Success',
    'Erro': 'Error',
    'Atenção': 'Warning',
    'Carregando': 'Loading',
    'Processando': 'Processing',
    'Aguardando': 'Waiting',
    'Concluído': 'Completed',
    'Pendente': 'Pending',
    'Aprovado': 'Approved',
    'Rejeitado': 'Rejected',
    'Cancelado': 'Cancelled',
    'Ativo': 'Active',
    'Inativo': 'Inactive',
    
    // Campos
    'Nome': 'Name',
    'Sobrenome': 'Last Name',
    'Email': 'Email',
    'Telefone': 'Phone',
    'Senha': 'Password',
    'Descrição': 'Description',
    'Título': 'Title',
    'Data': 'Date',
    'Hora': 'Time',
    'Categoria': 'Category',
    'Status': 'Status',
    'Tipo': 'Type',
    'Valor': 'Value',
    'Total': 'Total',
    'Endereço': 'Address',
    'Cidade': 'City',
    'Estado': 'State',
    'País': 'Country',
    'CEP': 'ZIP Code',
    'CPF': 'Tax ID',
    'Cargo': 'Position',
    'Departamento': 'Department',
    
    // Informações
    'Informações': 'Information',
    'Informações Pessoais': 'Personal Information',
    'Informações de Contato': 'Contact Information',
    'Configurações': 'Settings',
    'Perfil': 'Profile',
    'Meu Perfil': 'My Profile',
    'Foto de perfil': 'Profile photo',
    
    // Mensagens
    'Sucesso!': 'Success!',
    'Erro ao': 'Error',
    'Carregando...': 'Loading...',
    'Nenhum': 'None',
    'Nenhuma': 'None',
    'Todos': 'All',
    'Todas': 'All',
    'Sim': 'Yes',
    'Não': 'No',
    'Opcional': 'Optional',
    'Obrigatório': 'Required',
    'Selecione': 'Select',
    
    // Outros
    'de': 'of',
    'para': 'to',
    'em': 'in',
    'por': 'by',
    'com': 'with',
    'sem': 'without',
    'ou': 'or',
    'e': 'and',
  };
  
  // Verificar tradução direta
  if (commonTranslations[ptText]) {
    return commonTranslations[ptText];
  }
  
  // Tentar traduzir palavras individuais
  const words = ptText.split(' ');
  const translated = words.map(word => {
    const lower = word.toLowerCase();
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return commonTranslations[capitalized] || commonTranslations[lower] || word;
  });
  
  return translated.join(' ');
}

// ============================================================================
// DETECTOR DE STRINGS
// ============================================================================

class StringDetector {
  constructor() {
    this.portuguesePattern = /['"`]([^'"`]*(?:ã|õ|á|é|í|ó|ú|â|ê|ô|à|ç)[^'"`]*?)['"`]/gi;
  }

  findStrings(content, filePath) {
    const lines = content.split('\n');
    const found = [];
    
    lines.forEach((line, lineIndex) => {
      // Ignorar comentários
      if (line.trim().startsWith('//') || 
          line.trim().startsWith('/*') || 
          line.trim().startsWith('*')) {
        return;
      }
      
      // Ignorar imports
      if (line.trim().startsWith('import ')) {
        return;
      }
      
      // Ignorar se já usa t()
      if (line.includes('t(')) {
        return;
      }
      
      // Buscar strings com acentuação
      const matches = [...line.matchAll(this.portuguesePattern)];
      
      matches.forEach(match => {
        const text = match[1];
        
        // Ignorar se for chave de tradução (contém ponto)
        if (text.includes('.') && !text.includes(' ')) {
          return;
        }
        
        // Ignorar se for caminho de arquivo
        if (text.includes('/') || text.includes('\\')) {
          return;
        }
        
        // Ignorar se for URL
        if (text.includes('http') || text.includes('www')) {
          return;
        }
        
        // Ignorar className ou style
        if (line.includes('className=') || line.includes('style=')) {
          return;
        }
        
        // Ignorar strings muito curtas (< 3 caracteres)
        if (text.length < 3) {
          return;
        }
        
        found.push({
          text,
          line: lineIndex + 1,
          lineContent: line.trim(),
          fullMatch: match[0],
        });
      });
    });
    
    return found;
  }
}

// ============================================================================
// SUBSTITUIDOR DE STRINGS
// ============================================================================

class StringReplacer {
  constructor(logger) {
    this.logger = logger;
  }

  replaceInFile(filePath, replacements) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Verificar se já importa useI18n
      const hasI18nImport = content.includes("from '@/contexts/I18nContext'");
      
      // Adicionar import se necessário
      if (!hasI18nImport && replacements.length > 0) {
        // Encontrar a última linha de import
        const lines = content.split('\n');
        let lastImportIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ')) {
            lastImportIndex = i;
          }
        }
        
        if (lastImportIndex >= 0) {
          lines.splice(
            lastImportIndex + 1,
            0,
            "import { useI18n } from '@/contexts/I18nContext';"
          );
          content = lines.join('\n');
          modified = true;
        }
      }
      
      // Verificar se já declara const { t }
      const hasT18nDeclaration = content.includes('const { t }') && content.includes('useI18n()');
      
      // Adicionar declaração se necessário
      if (!hasT18nDeclaration && replacements.length > 0) {
        // Procurar pelo início do componente/função
        const componentMatch = content.match(/(export\s+(?:default\s+)?function\s+\w+[^{]*\{)/);
        
        if (componentMatch) {
          const insertPosition = componentMatch.index + componentMatch[0].length;
          content = 
            content.slice(0, insertPosition) +
            '\n  const { t } = useI18n();\n' +
            content.slice(insertPosition);
          modified = true;
        }
      }
      
      // Fazer substituições
      replacements.forEach(({ original, replacement }) => {
        if (content.includes(original)) {
          content = content.replace(new RegExp(this.escapeRegex(original), 'g'), replacement);
          modified = true;
        }
      });
      
      // Salvar arquivo se modificado
      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Erro ao substituir strings em ${filePath}: ${error.message}`);
      return false;
    }
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  shouldIgnore,
  hasFileExtension,
  generateTranslationKey,
  translateToEnglish,
  StringDetector,
  StringReplacer,
};

