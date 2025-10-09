const fs = require('fs');
const path = require('path');

console.log('🌐 Corrigindo todas as traduções do projeto...\n');

// Função para buscar arquivos recursivamente
function findFiles(dir, extensions = ['.tsx', '.ts', '.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Pular diretórios específicos
      if (['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        return;
      }
      results = results.concat(findFiles(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  });
  
  return results;
}

// Função para encontrar textos hardcoded que precisam ser traduzidos
function findHardcodedTexts(content, filePath) {
  const issues = [];
  
  // Padrões de textos hardcoded comuns
  const patterns = [
    // Textos em português hardcoded
    /'[^']*[áàâãéêíóôõúç][^']*'/gi,
    /"[^"]*[áàâãéêíóôõúç][^"]*"/gi,
    
    // Textos específicos que devem ser traduzidos
    /['"](?:Carregando|Loading|Erro|Error|Sucesso|Success|Salvar|Save|Cancelar|Cancel|Editar|Edit|Excluir|Delete|Confirmar|Confirm)['"](?!\s*[,)])/gi,
    
    // Placeholders comuns
    /placeholder\s*=\s*['"][^'"]*['"](?!\s*{)/gi,
    
    // Textos de botões e labels
    /(?:aria-label|title|alt)\s*=\s*['"][^'"]*[a-zA-ZáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ][^'"]*['"](?!\s*{)/gi
  ];
  
  patterns.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filtrar falsos positivos
        if (!match.includes('t(') && 
            !match.includes('${') && 
            !match.includes('import') &&
            !match.includes('from') &&
            !match.includes('className') &&
            !match.includes('http') &&
            !match.includes('@') &&
            !match.includes('.') && 
            match.length > 5) {
          issues.push({
            type: `Pattern ${index + 1}`,
            text: match,
            suggestion: `Considere usar t('key', ${match})`
          });
        }
      });
    }
  });
  
  return issues;
}

// Função para verificar se o arquivo usa traduções
function usesTranslations(content) {
  return content.includes('useI18n') || content.includes('import.*I18n') || content.includes('t(');
}

// Função para sugerir correções
function suggestFixes(content, filePath) {
  const suggestions = [];
  
  // Verificar se precisa importar useI18n
  if (!content.includes('useI18n') && content.includes('t(')) {
    suggestions.push({
      type: 'Import Missing',
      suggestion: "Adicionar: import { useI18n } from '@/contexts/I18nContext';"
    });
  }
  
  // Verificar se precisa declarar t
  if (content.includes('useI18n') && !content.includes('const { t }')) {
    suggestions.push({
      type: 'Hook Usage',
      suggestion: "Adicionar: const { t } = useI18n();"
    });
  }
  
  return suggestions;
}

// Executar verificação
const srcDir = path.join(process.cwd(), 'src');
const files = findFiles(srcDir);

let totalFiles = 0;
let filesWithIssues = 0;
let totalIssues = 0;

console.log(`📁 Analisando ${files.length} arquivos...\n`);

const report = {
  filesWithHardcodedText: [],
  filesNeedingTranslationImport: [],
  commonIssues: {},
  summary: {}
};

files.forEach(filePath => {
  totalFiles++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Pular arquivos de configuração e testes
  if (relativePath.includes('test') || 
      relativePath.includes('spec') || 
      relativePath.includes('config') ||
      relativePath.includes('.d.ts') ||
      relativePath.includes('node_modules')) {
    return;
  }
  
  const hardcodedIssues = findHardcodedTexts(content, filePath);
  const suggestions = suggestFixes(content, filePath);
  const hasTranslations = usesTranslations(content);
  
  if (hardcodedIssues.length > 0 || suggestions.length > 0) {
    filesWithIssues++;
    totalIssues += hardcodedIssues.length;
    
    console.log(`\n📄 ${relativePath}`);
    console.log(`   Usa traduções: ${hasTranslations ? '✅' : '❌'}`);
    
    if (hardcodedIssues.length > 0) {
      console.log(`   🔍 Textos hardcoded encontrados: ${hardcodedIssues.length}`);
      hardcodedIssues.slice(0, 3).forEach(issue => {
        console.log(`      - ${issue.text}`);
      });
      if (hardcodedIssues.length > 3) {
        console.log(`      ... e mais ${hardcodedIssues.length - 3} textos`);
      }
      
      report.filesWithHardcodedText.push({
        file: relativePath,
        issues: hardcodedIssues
      });
    }
    
    if (suggestions.length > 0) {
      console.log(`   💡 Sugestões:`);
      suggestions.forEach(suggestion => {
        console.log(`      - ${suggestion.suggestion}`);
      });
      
      if (!hasTranslations) {
        report.filesNeedingTranslationImport.push(relativePath);
      }
    }
  }
});

// Gerar relatório final
console.log('\n' + '='.repeat(60));
console.log('📊 RELATÓRIO FINAL DE TRADUÇÕES');
console.log('='.repeat(60));

console.log(`\n📈 Estatísticas:`);
console.log(`   - Arquivos analisados: ${totalFiles}`);
console.log(`   - Arquivos com problemas: ${filesWithIssues}`);
console.log(`   - Total de textos hardcoded: ${totalIssues}`);
console.log(`   - Arquivos precisando de import: ${report.filesNeedingTranslationImport.length}`);

console.log(`\n🔧 Próximos passos recomendados:`);
console.log(`   1. Adicionar imports de useI18n nos arquivos que precisam`);
console.log(`   2. Substituir textos hardcoded por chamadas t()`);
console.log(`   3. Adicionar chaves de tradução nos arquivos pt-BR.ts e en-US.ts`);
console.log(`   4. Testar as traduções em ambos os idiomas`);

console.log(`\n📝 Arquivos que mais precisam de atenção:`);
report.filesWithHardcodedText
  .sort((a, b) => b.issues.length - a.issues.length)
  .slice(0, 10)
  .forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.file} (${item.issues.length} problemas)`);
  });

// Salvar relatório detalhado
const reportPath = path.join(process.cwd(), 'translation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n💾 Relatório detalhado salvo em: ${reportPath}`);

console.log('\n✅ Verificação de traduções concluída!');

if (filesWithIssues > 0) {
  console.log('\n⚠️  Foram encontrados problemas que precisam ser corrigidos.');
  process.exit(1);
} else {
  console.log('\n🎉 Todas as traduções estão em ordem!');
  process.exit(0);
}
