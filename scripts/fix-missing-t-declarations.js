// Script para adicionar const { t } = useI18n() em componentes que faltam
// (Sempre verificar o sistema antes para ter certeza do que está fazendo para não gerar erros)

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/Academy/VideoPlayer.tsx',
  'src/components/admin/ACLInitializer.tsx',
  'src/components/admin/ACLPermissionTreeSelector.tsx',
  'src/components/admin/RolePermissionsEditor.tsx',
  'src/components/admin/RolePermissionsInitializer.tsx',
  'src/components/admin/UserAccessHistory.tsx',
  'src/components/admin/UserRoleManager.tsx',
];

function addTDeclaration(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Verificar se já tem const { t }
  if (content.includes('const { t }') || content.includes('const{t}')) {
    console.log(`✅ ${filePath} - já tem const { t }`);
    return false;
  }

  // Verificar se tem useI18n import
  if (!content.includes('useI18n')) {
    console.log(`⚠️  ${filePath} - não tem import useI18n`);
    return false;
  }

  // Procurar pelo primeiro componente/função
  const patterns = [
    /^(export\s+default\s+function\s+\w+[^{]*\{)/m,
    /^(const\s+\w+:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*\{)/m,
    /^(function\s+\w+[^{]*\{)/m,
  ];

  let modified = false;
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const insertPos = match.index + match[0].length;
      const indent = '  ';
      const declaration = `\n${indent}const { t } = useI18n();`;
      
      content = content.slice(0, insertPos) + declaration + content.slice(insertPos);
      modified = true;
      break;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ ${filePath} - const { t } adicionado`);
    return true;
  } else {
    console.log(`⚠️  ${filePath} - não foi possível encontrar onde inserir`);
    return false;
  }
}

console.log('🔧 Adicionando const { t } = useI18n() em componentes...\n');

let fixed = 0;
for (const file of filesToFix) {
  if (addTDeclaration(file)) {
    fixed++;
  }
}

console.log(`\n✨ ${fixed} arquivo(s) corrigido(s)`);

