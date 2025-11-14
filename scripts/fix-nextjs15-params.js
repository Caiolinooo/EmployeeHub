const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo params para Next.js 15...\n');

// Função para buscar arquivos recursivamente
function findRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findRouteFiles(filePath));
      }
    } else if (file === 'route.ts') {
      results.push(filePath);
    }
  });
  
  return results;
}

// Função para corrigir um arquivo
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Padrão 1: { params }: { params: { xxx: string } }
  const pattern1 = /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (pattern1.test(content)) {
    content = content.replace(
      /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      '{ params }: { params: Promise<{$1}> }'
    );
    modified = true;
  }

  // Padrão 1b: context: { params: { xxx: string } }
  const pattern1b = /context:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (pattern1b.test(content)) {
    content = content.replace(
      /context:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      'context: { params: Promise<{$1}> }'
    );
    modified = true;
  }
  
  // Padrão 2: const xxx = params.xxx; -> const { xxx } = await params;
  // Primeiro, encontrar todos os nomes de parâmetros
  const paramNames = [];
  const paramPattern = /params:\s*Promise<\{([^}]+)\}>/g;
  let match;
  
  while ((match = paramPattern.exec(content)) !== null) {
    const paramsStr = match[1];
    const names = paramsStr.split(',').map(p => {
      const parts = p.trim().split(':');
      return parts[0].trim();
    });
    paramNames.push(...names);
  }
  
  // Agora substituir const xxx = params.xxx;
  paramNames.forEach(paramName => {
    const oldPattern1 = new RegExp(`const\\s+${paramName}\\s*=\\s*params\\.${paramName};`, 'g');
    const oldPattern2 = new RegExp(`const\\s+${paramName}\\s*=\\s*await\\s+Promise\\.resolve\\(params\\.${paramName}\\);`, 'g');
    
    if (oldPattern1.test(content) || oldPattern2.test(content)) {
      // Substituir por const { paramName } = await params;
      content = content.replace(oldPattern1, `const { ${paramName} } = await params;`);
      content = content.replace(oldPattern2, `const { ${paramName} } = await params;`);
      modified = true;
    }
  });
  
  // Padrão 3: const { xxx } = params; -> const { xxx } = await params;
  const pattern3 = /const\s+\{([^}]+)\}\s*=\s*params;/g;
  if (pattern3.test(content) && !content.includes('const {') || content.includes('} = params;')) {
    content = content.replace(
      /const\s+\{([^}]+)\}\s*=\s*params;/g,
      'const {$1} = await params;'
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigido: ${filePath}`);
    return true;
  }
  
  return false;
}

// Executar
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const routeFiles = findRouteFiles(apiDir);

console.log(`📁 Encontrados ${routeFiles.length} arquivos route.ts\n`);

let fixedCount = 0;
routeFiles.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✨ Concluído! ${fixedCount} arquivos corrigidos.`);

