const fs = require('fs');
const path = require('path');

/**
 * Script para detectar chaves duplicadas em arquivos i18n
 */

function findDuplicates(filePath) {
  console.log(`\n🔍 Analisando: ${filePath}\n`);

  const content = fs.readFileSync(filePath, 'utf8');

  // Regex para encontrar chaves de objeto: 'key': value ou "key": value
  const keyRegex = /['"]([^'"]+)['"]\s*:/g;

  const keys = [];
  const duplicates = {};
  const lineNumbers = {};

  // Dividir em linhas para rastrear números de linha
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const matches = [...line.matchAll(keyRegex)];
    matches.forEach(match => {
      const key = match[1];
      const lineNum = index + 1;

      if (keys.includes(key)) {
        if (!duplicates[key]) {
          duplicates[key] = [lineNumbers[key]];
        }
        duplicates[key].push(lineNum);
      } else {
        keys.push(key);
        lineNumbers[key] = lineNum;
      }
    });
  });

  const duplicateCount = Object.keys(duplicates).length;

  if (duplicateCount === 0) {
    console.log('✅ Nenhuma duplicata encontrada!\n');
    return { file: filePath, duplicates: {}, count: 0 };
  }

  console.log(`❌ Encontradas ${duplicateCount} chaves duplicadas:\n`);

  Object.entries(duplicates).forEach(([key, lines]) => {
    console.log(`  "${key}": linhas ${lines.join(', ')}`);
  });

  console.log('');

  return { file: filePath, duplicates, count: duplicateCount };
}

// Analisar ambos os arquivos
const localesDir = path.join(__dirname, '../src/i18n/locales');
const files = [
  path.join(localesDir, 'pt-BR.ts'),
  path.join(localesDir, 'en-US.ts')
];

console.log('═══════════════════════════════════════════════════');
console.log('  DETECTOR DE DUPLICATAS EM ARQUIVOS I18N');
console.log('═══════════════════════════════════════════════════');

const results = files.map(file => {
  if (fs.existsSync(file)) {
    return findDuplicates(file);
  } else {
    console.log(`\n⚠️  Arquivo não encontrado: ${file}\n`);
    return { file, duplicates: {}, count: 0 };
  }
});

// Resumo
console.log('═══════════════════════════════════════════════════');
console.log('  RESUMO');
console.log('═══════════════════════════════════════════════════\n');

const totalDuplicates = results.reduce((sum, r) => sum + r.count, 0);

results.forEach(result => {
  const fileName = path.basename(result.file);
  const status = result.count === 0 ? '✅' : '❌';
  console.log(`${status} ${fileName}: ${result.count} duplicata(s)`);
});

console.log(`\nTotal: ${totalDuplicates} chaves duplicadas\n`);

if (totalDuplicates > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
