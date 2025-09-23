const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando limpeza das notificações duplicadas...\n');

// Função para buscar recursivamente por arquivos
function findFiles(dir, extension = '.tsx') {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Pular node_modules e .next
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findFiles(filePath, extension));
      }
    } else if (file.endsWith(extension) || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  
  return results;
}

// Buscar todos os arquivos TypeScript/React
const srcDir = path.join(process.cwd(), 'src');
const files = findFiles(srcDir);

let totalFiles = 0;
let filesWithNotificationHUD = 0;
let filesWithNotificationBell = 0;
let duplicateInstances = [];

console.log('📁 Analisando arquivos...\n');

files.forEach(filePath => {
  totalFiles++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Contar ocorrências de NotificationHUD
  const hudMatches = content.match(/NotificationHUD/g);
  const bellMatches = content.match(/NotificationBell/g);
  
  if (hudMatches) {
    filesWithNotificationHUD++;
    const importCount = (content.match(/import.*NotificationHUD/g) || []).length;
    const usageCount = (content.match(/<NotificationHUD/g) || []).length;
    
    console.log(`📄 ${relativePath}:`);
    console.log(`   📦 Imports: ${importCount}`);
    console.log(`   🔧 Usos: ${usageCount}`);
    
    // Verificar se há múltiplos usos no mesmo arquivo
    if (usageCount > 1) {
      duplicateInstances.push({
        file: relativePath,
        count: usageCount
      });
      console.log(`   ⚠️  MÚLTIPLOS USOS DETECTADOS: ${usageCount}`);
    }
    console.log('');
  }
  
  if (bellMatches) {
    filesWithNotificationBell++;
    console.log(`🔔 ${relativePath}: Ainda contém referências ao NotificationBell`);
  }
});

console.log('📊 Resumo da Análise:\n');
console.log(`📁 Total de arquivos analisados: ${totalFiles}`);
console.log(`🔔 Arquivos com NotificationHUD: ${filesWithNotificationHUD}`);
console.log(`📱 Arquivos com NotificationBell: ${filesWithNotificationBell}`);
console.log(`⚠️  Arquivos com múltiplas instâncias: ${duplicateInstances.length}`);

if (duplicateInstances.length > 0) {
  console.log('\n❌ DUPLICAÇÕES ENCONTRADAS:');
  duplicateInstances.forEach(instance => {
    console.log(`   ${instance.file}: ${instance.count} instâncias`);
  });
} else {
  console.log('\n✅ Nenhuma duplicação encontrada!');
}

if (filesWithNotificationBell > 0) {
  console.log('\n⚠️  Ainda há referências ao NotificationBell (componente removido)');
} else {
  console.log('\n✅ Nenhuma referência ao NotificationBell encontrada!');
}

// Verificar layouts principais
console.log('\n🏗️  Verificação de Layouts Principais:');

const mainLayoutPath = path.join(process.cwd(), 'src/components/Layout/MainLayout.tsx');
const adminLayoutPath = path.join(process.cwd(), 'src/app/admin/layout.tsx');

if (fs.existsSync(mainLayoutPath)) {
  const mainContent = fs.readFileSync(mainLayoutPath, 'utf8');
  const mainHudCount = (mainContent.match(/<NotificationHUD/g) || []).length;
  console.log(`📄 MainLayout: ${mainHudCount} instância(s) do NotificationHUD`);
}

if (fs.existsSync(adminLayoutPath)) {
  const adminContent = fs.readFileSync(adminLayoutPath, 'utf8');
  const adminHudCount = (adminContent.match(/<NotificationHUD/g) || []).length;
  console.log(`📄 AdminLayout: ${adminHudCount} instância(s) do NotificationHUD`);
}

console.log('\n🎯 Resultado Final:');
if (duplicateInstances.length === 0 && filesWithNotificationBell === 0) {
  console.log('🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
  console.log('✅ Não há mais duplicações de notificações');
  console.log('✅ Sistema unificado funcionando corretamente');
} else {
  console.log('❌ AINDA HÁ PROBLEMAS A RESOLVER');
  if (duplicateInstances.length > 0) {
    console.log('⚠️  Duplicações de NotificationHUD encontradas');
  }
  if (filesWithNotificationBell > 0) {
    console.log('⚠️  Referências ao NotificationBell removido encontradas');
  }
}

console.log('\n📋 Próximos passos:');
console.log('1. Testar a interface para confirmar que há apenas um ícone de sino');
console.log('2. Verificar se as notificações estão funcionando corretamente');
console.log('3. Confirmar que não há erros no console do navegador');
