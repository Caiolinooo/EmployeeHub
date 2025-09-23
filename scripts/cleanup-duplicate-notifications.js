const fs = require('fs');
const path = require('path');

console.log('🧹 Limpando sistema de notificações duplicadas...\n');

// Lista de arquivos que podem conter referências ao NotificationBell
const filesToCheck = [
  'src/components/Layout/MainLayout.tsx',
  'src/app/admin/layout.tsx',
  'src/app/academy/page.tsx',
  'src/app/academy/dashboard/page.tsx',
  'src/app/academy/my-courses/page.tsx',
  'src/app/academy/certificates/page.tsx'
];

let foundReferences = 0;
let cleanedFiles = 0;

// Função para verificar e limpar referências
function checkAndCleanFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ Arquivo não encontrado: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Verificar se há referências ao NotificationBell
  const hasImport = content.includes("import NotificationBell from '@/components/Academy/NotificationBell'");
  const hasUsage = content.includes('<NotificationBell');
  
  if (hasImport || hasUsage) {
    foundReferences++;
    console.log(`🔍 Encontradas referências em: ${filePath}`);
    
    // Remover import
    if (hasImport) {
      content = content.replace(/import NotificationBell from '@\/components\/Academy\/NotificationBell';\s*\n?/g, '');
      console.log(`  ✅ Removido import do NotificationBell`);
    }
    
    // Remover uso do componente
    if (hasUsage) {
      // Remover linhas que contêm <NotificationBell
      content = content.replace(/.*<NotificationBell[^>]*\/?>.*\n?/g, '');
      console.log(`  ✅ Removido uso do componente NotificationBell`);
    }
    
    // Salvar arquivo se houve mudanças
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      cleanedFiles++;
      console.log(`  💾 Arquivo atualizado: ${filePath}\n`);
    }
  } else {
    console.log(`✅ Nenhuma referência encontrada em: ${filePath}`);
  }
}

// Verificar todos os arquivos
console.log('🔍 Verificando arquivos...\n');
filesToCheck.forEach(checkAndCleanFile);

console.log('\n📊 Resumo da limpeza:');
console.log(`🔍 Referências encontradas: ${foundReferences}`);
console.log(`🧹 Arquivos limpos: ${cleanedFiles}`);

// Verificar se o arquivo NotificationBell ainda é necessário
const notificationBellPath = path.join(process.cwd(), 'src/components/Academy/NotificationBell.tsx');
if (fs.existsSync(notificationBellPath)) {
  console.log('\n⚠️ O arquivo NotificationBell.tsx ainda existe.');
  console.log('   Se não há mais referências, considere removê-lo:');
  console.log('   rm src/components/Academy/NotificationBell.tsx');
} else {
  console.log('\n✅ Arquivo NotificationBell.tsx não encontrado (já removido).');
}

// Verificar se a API da Academy ainda é necessária
const academyApiPath = path.join(process.cwd(), 'src/app/api/academy/notifications/route.ts');
if (fs.existsSync(academyApiPath)) {
  console.log('\n⚠️ A API /api/academy/notifications ainda existe.');
  console.log('   Considere unificar com /api/notifications ou remover se não for mais necessária.');
} else {
  console.log('\n✅ API da Academy não encontrada (já removida).');
}

console.log('\n🎉 Limpeza concluída!');
console.log('\n📋 Próximos passos recomendados:');
console.log('1. Testar o sistema de notificações');
console.log('2. Verificar se não há erros no console');
console.log('3. Confirmar que apenas um ícone de notificação aparece');
console.log('4. Remover arquivos não utilizados se confirmado que não são necessários');
