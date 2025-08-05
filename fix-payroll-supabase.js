#!/usr/bin/env node

/**
 * Script para corrigir todas as referências de 'supabase' para 'supabaseAdmin' 
 * nos arquivos de API de folha de pagamento
 */

const fs = require('fs');
const path = require('path');

// Diretório base das APIs de folha de pagamento
const payrollApiDir = path.join(__dirname, 'src', 'app', 'api', 'payroll');

// Função para corrigir um arquivo
function fixFile(filePath) {
  try {
    console.log(`Corrigindo: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Substituições necessárias
    const replacements = [
      // Importações
      {
        from: /import { supabase } from '@\/lib\/supabase';/g,
        to: "import { supabaseAdmin } from '@/lib/supabase';"
      },
      // Uso direto
      {
        from: /await supabase\./g,
        to: 'await supabaseAdmin.'
      },
      {
        from: /= supabase\./g,
        to: '= supabaseAdmin.'
      },
      {
        from: /let query = supabase/g,
        to: 'let query = supabaseAdmin'
      },
      {
        from: /const query = supabase/g,
        to: 'const query = supabaseAdmin'
      },
      {
        from: /existingQuery = supabase/g,
        to: 'existingQuery = supabaseAdmin'
      },
      {
        from: /employeeQuery = supabase/g,
        to: 'employeeQuery = supabaseAdmin'
      },
      {
        from: /employeesQuery = supabase/g,
        to: 'employeesQuery = supabaseAdmin'
      }
    ];
    
    // Aplicar todas as substituições
    replacements.forEach(replacement => {
      const newContent = content.replace(replacement.from, replacement.to);
      if (newContent !== content) {
        modified = true;
        content = newContent;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath} corrigido`);
    } else {
      console.log(`⏭️ ${filePath} já estava correto`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao corrigir ${filePath}:`, error.message);
  }
}

// Função para percorrer diretórios recursivamente
function walkDir(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.log(`Diretório não encontrado: ${dir}`);
    return files;
  }
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

// Executar correções
console.log('🔧 Iniciando correção das APIs de folha de pagamento...');

const files = walkDir(payrollApiDir);
console.log(`📁 Encontrados ${files.length} arquivos TypeScript`);

files.forEach(fixFile);

console.log('✅ Correção concluída!');
