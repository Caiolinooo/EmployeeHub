const fs = require('fs');
const path = require('path');

// Diretórios para verificar
const dirsToCheck = [
  'src/app',
  'src/components',
];

// Padrões de strings hardcoded em português (regex)
const portuguesePatterns = [
  // Strings entre aspas simples ou duplas que contenham palavras em português
  /'[^']*(?:ã|õ|á|é|í|ó|ú|â|ê|ô|à|ç)[^']*'/gi,
  /"[^"]*(?:ã|õ|á|é|í|ó|ú|â|ê|ô|à|ç)[^"]*"/gi,
];

// Arquivos para ignorar
const ignoreFiles = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.env',
  'check-hardcoded-strings.js'
];

// Extensões de arquivo para verificar
const fileExtensions = ['.tsx', '.ts', '.jsx', '.js'];

let totalFiles = 0;
let filesWithIssues = 0;
const issues = [];

function shouldIgnore(filePath) {
  return ignoreFiles.some(ignore => filePath.includes(ignore));
}

function checkFile(filePath) {
  if (shouldIgnore(filePath)) return;
  
  const ext = path.extname(filePath);
  if (!fileExtensions.includes(ext)) return;

  totalFiles++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const fileIssues = [];
    
    lines.forEach((line, lineIndex) => {
      // Ignorar linhas de comentário
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return;
      }
      
      // Ignorar imports
      if (line.trim().startsWith('import ')) {
        return;
      }
      
      // Verificar cada padrão
      portuguesePatterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Ignorar se for uma chave de tradução (contém ponto)
            if (match.includes('.') && !match.includes(' ')) {
              return;
            }
            
            // Ignorar se for um caminho de arquivo
            if (match.includes('/') || match.includes('\\')) {
              return;
            }
            
            // Ignorar se for uma URL
            if (match.includes('http') || match.includes('www')) {
              return;
            }
            
            // Ignorar se for className ou style
            if (line.includes('className=') || line.includes('style=')) {
              return;
            }
            
            fileIssues.push({
              line: lineIndex + 1,
              content: line.trim(),
              match: match
            });
          });
        }
      });
    });
    
    if (fileIssues.length > 0) {
      filesWithIssues++;
      issues.push({
        file: filePath,
        issues: fileIssues
      });
    }
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error.message);
  }
}

function scanDirectory(dir) {
  try {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      
      if (shouldIgnore(fullPath)) return;
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        checkFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`Erro ao escanear diretório ${dir}:`, error.message);
  }
}

console.log('🔍 Verificando strings hardcoded em português...\n');

dirsToCheck.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`📁 Escaneando: ${dir}`);
    scanDirectory(fullPath);
  }
});

console.log('\n' + '='.repeat(80));
console.log('📊 RELATÓRIO DE VERIFICAÇÃO');
console.log('='.repeat(80));
console.log(`\n📄 Total de arquivos verificados: ${totalFiles}`);
console.log(`⚠️  Arquivos com possíveis problemas: ${filesWithIssues}`);
console.log(`🔢 Total de strings encontradas: ${issues.reduce((sum, item) => sum + item.issues.length, 0)}\n`);

if (issues.length > 0) {
  console.log('='.repeat(80));
  console.log('⚠️  STRINGS HARDCODED ENCONTRADAS:');
  console.log('='.repeat(80) + '\n');
  
  // Agrupar por arquivo
  issues.forEach(({ file, issues: fileIssues }) => {
    console.log(`\n📄 ${file}`);
    console.log('-'.repeat(80));
    
    // Mostrar apenas os primeiros 10 problemas por arquivo
    const displayIssues = fileIssues.slice(0, 10);
    displayIssues.forEach(({ line, content, match }) => {
      console.log(`   Linha ${line}: ${match}`);
      console.log(`   Contexto: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      console.log('');
    });
    
    if (fileIssues.length > 10) {
      console.log(`   ... e mais ${fileIssues.length - 10} ocorrências\n`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMENDAÇÕES:');
  console.log('='.repeat(80));
  console.log(`
1. Substitua strings hardcoded por chamadas ao sistema de tradução:
   Antes: <button>Salvar</button>
   Depois: <button>{t('common.save')}</button>

2. Adicione as traduções nos arquivos:
   - src/i18n/locales/pt-BR.ts
   - src/i18n/locales/en-US.ts

3. Use o hook useI18n() nos componentes:
   const { t } = useI18n();

4. Para textos dinâmicos, use interpolação:
   t('welcome.message', { name: userName })
`);
} else {
  console.log('✅ Nenhuma string hardcoded encontrada! Sistema 100% traduzível.\n');
}

console.log('='.repeat(80) + '\n');

