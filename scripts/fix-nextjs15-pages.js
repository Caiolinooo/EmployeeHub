const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo params em páginas para Next.js 15...\n');

// Função para buscar arquivos page.tsx recursivamente
function findPageFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findPageFiles(filePath));
      }
    } else if (file === 'page.tsx' || file === 'page.ts') {
      results.push(filePath);
    }
  });
  
  return results;
}

// Função para corrigir um arquivo
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Verificar se é client component
  const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
  
  if (!isClientComponent) {
    // Server component - usar await
    // Padrão: { params }: { params: { xxx: string } }
    const pattern = /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
    if (pattern.test(content)) {
      content = content.replace(
        /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
        '{ params }: { params: Promise<{$1}> }'
      );
      
      // Substituir const xxx = params.xxx; por const { xxx } = await params;
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
      
      paramNames.forEach(paramName => {
        const oldPattern = new RegExp(`const\\s+${paramName}\\s*=\\s*params\\.${paramName};`, 'g');
        if (oldPattern.test(content)) {
          content = content.replace(oldPattern, `const { ${paramName} } = await params;`);
        }
      });
      
      modified = true;
    }
  } else {
    // Client component - usar React.use()
    // Verificar se já importa 'use' do React
    const hasUseImport = /import\s+.*\buse\b.*from\s+['"]react['"]/.test(content);
    
    // Padrão: { params }: { params: { xxx: string } }
    const pattern = /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
    if (pattern.test(content)) {
      content = content.replace(
        /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
        '{ params }: { params: Promise<{$1}> }'
      );
      
      // Adicionar import de 'use' se não existir
      if (!hasUseImport) {
        // Encontrar a linha de import do React
        const reactImportMatch = /import\s+React(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];/.exec(content);
        if (reactImportMatch) {
          const existingImports = reactImportMatch[1] || '';
          const newImports = existingImports ? `${existingImports}, use` : ' use';
          content = content.replace(
            /import\s+React(?:,\s*\{[^}]+\})?\s+from\s+['"]react['"];/,
            `import React, {${newImports}} from 'react';`
          );
        } else {
          // Adicionar import completo se não existir
          content = content.replace(
            /^(['"]use client['"];?\s*\n)/m,
            "$1\nimport { use } from 'react';\n"
          );
        }
      }
      
      // Substituir const xxx = params.xxx; por const { xxx } = use(params);
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
      
      paramNames.forEach(paramName => {
        const oldPattern = new RegExp(`const\\s+${paramName}\\s*=\\s*params\\.${paramName};`, 'g');
        if (oldPattern.test(content)) {
          content = content.replace(oldPattern, `const { ${paramName} } = use(params);`);
        }
      });
      
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigido: ${filePath}`);
    return true;
  }
  
  return false;
}

// Executar
const appDir = path.join(__dirname, '..', 'src', 'app');
const pageFiles = findPageFiles(appDir);

console.log(`📁 Encontrados ${pageFiles.length} arquivos page.tsx/ts\n`);

let fixedCount = 0;
pageFiles.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✨ Concluído! ${fixedCount} arquivos corrigidos.`);

