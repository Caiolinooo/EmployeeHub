/**
 * Script para corrigir erro de sintaxe nos toasts
 * Substitui toast.method({t('...')}) por toast.method(t('...'))
 */

const fs = require('fs');
const path = require('path');

const directories = ['src'];
const extensions = ['.tsx', '.ts', '.jsx', '.js'];

let filesFixed = 0;
let totalReplacements = 0;

function shouldProcess(filePath) {
  const ext = path.extname(filePath);
  return extensions.includes(ext);
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacements = 0;

    // Padrão 1: toast.method({t('...')})
    const pattern1 = /toast\.(success|error|warning|info)\(\{t\(([^)]+)\)\}\)/g;
    content = content.replace(pattern1, (match, method, args) => {
      replacements++;
      return `toast.${method}(t(${args}))`;
    });

    // Padrão 2: console.error({t('...')}, ...)
    const pattern2 = /console\.(log|error|warn|info)\(\{t\(([^)]+)\)\}(,?[^;]*)\)/g;
    content = content.replace(pattern2, (match, method, args, rest) => {
      replacements++;
      return `console.${method}(t(${args})${rest})`;
    });

    // Padrão 3: setError({t('...')})
    const pattern3 = /setError\(\{t\(([^)]+)\)\}\)/g;
    content = content.replace(pattern3, (match, args) => {
      replacements++;
      return `setError(t(${args}))`;
    });

    // Padrão 4: || {t('...')}
    const pattern4 = /\|\|\s*\{t\(([^)]+)\)\}/g;
    content = content.replace(pattern4, (match, args) => {
      replacements++;
      return `|| t(${args})`;
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath} - ${replacements} correções`);
      filesFixed++;
      totalReplacements += replacements;
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

function scanDirectory(dir) {
  try {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);

      // Ignorar node_modules, .next, etc
      if (item === 'node_modules' || item === '.next' || item === 'dist' || item === 'build') {
        return;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && shouldProcess(fullPath)) {
        fixFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`Erro ao escanear ${dir}:`, error.message);
  }
}

console.log('🔧 Corrigindo erros de sintaxe nos toasts...\n');

directories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Correção concluída!`);
console.log(`📁 Arquivos corrigidos: ${filesFixed}`);
console.log(`🔄 Total de substituições: ${totalReplacements}`);
console.log('='.repeat(60));

