/**
 * Script para limpar o cache de traduções e forçar recarregamento
 * Este script deve ser executado quando as traduções não estão sendo atualizadas
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Limpando cache de traduções...');

// Função para limpar cache do Next.js
function clearNextCache() {
  const nextCacheDir = path.join(process.cwd(), '.next');
  
  if (fs.existsSync(nextCacheDir)) {
    console.log('📁 Removendo diretório .next...');
    try {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
      console.log('✅ Diretório .next removido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao remover .next:', error.message);
    }
  } else {
    console.log('ℹ️  Diretório .next não encontrado');
  }
}

// Função para limpar cache do node_modules
function clearNodeModulesCache() {
  const nodeModulesCacheDir = path.join(process.cwd(), 'node_modules', '.cache');
  
  if (fs.existsSync(nodeModulesCacheDir)) {
    console.log('📁 Removendo cache do node_modules...');
    try {
      fs.rmSync(nodeModulesCacheDir, { recursive: true, force: true });
      console.log('✅ Cache do node_modules removido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao remover cache do node_modules:', error.message);
    }
  } else {
    console.log('ℹ️  Cache do node_modules não encontrado');
  }
}

// Função para verificar se os arquivos de tradução existem e estão corretos
function verifyTranslationFiles() {
  console.log('🔍 Verificando arquivos de tradução...');
  
  const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
  const files = ['pt-BR.ts', 'en-US.ts'];
  
  for (const file of files) {
    const filePath = path.join(localesDir, file);
    
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} encontrado`);
      
      // Verificar se o arquivo tem conteúdo
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.length > 100) {
        console.log(`✅ ${file} tem conteúdo (${content.length} caracteres)`);
        
        // Verificar se tem export default
        if (content.includes('export default')) {
          console.log(`✅ ${file} tem export default`);
        } else {
          console.log(`❌ ${file} não tem export default`);
        }
        
        // Verificar algumas chaves específicas
        const testKeys = ['common.loading', 'reimbursement.form', 'auth.email'];
        for (const key of testKeys) {
          const keyParts = key.split('.');
          if (content.includes(keyParts[0]) && content.includes(keyParts[1])) {
            console.log(`✅ ${file} contém chave ${key}`);
          } else {
            console.log(`⚠️  ${file} pode não conter chave ${key}`);
          }
        }
      } else {
        console.log(`❌ ${file} está vazio ou muito pequeno`);
      }
    } else {
      console.log(`❌ ${file} não encontrado em ${filePath}`);
    }
  }
}

// Função para criar um arquivo de teste de tradução
function createTranslationTest() {
  console.log('🧪 Criando arquivo de teste de tradução...');
  
  const testContent = `'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

export default function TranslationTestPage() {
  const { t, locale, setLocale } = useI18n();

  const testKeys = [
    'common.loading',
    'common.error', 
    'common.success',
    'auth.email',
    'auth.emailPlaceholder',
    'reimbursement.form.personalInfo',
    'reimbursement.form.fullName',
    'register.title',
    'viewer.loading',
    'userEditor.permissions',
    'manager.moduleTitle'
  ];

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Teste de Traduções</h1>
      
      <div className="mb-6">
        <p className="mb-2">Idioma atual: <strong>{locale}</strong></p>
        <div className="space-x-2">
          <button 
            onClick={() => setLocale('pt-BR')}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Português
          </button>
          <button 
            onClick={() => setLocale('en-US')}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testKeys.map(key => (
          <div key={key} className="p-4 border rounded">
            <div className="font-mono text-sm text-gray-600 mb-2">{key}</div>
            <div className="font-medium">
              {t(key) === key ? (
                <span className="text-red-500">❌ CHAVE NÃO ENCONTRADA</span>
              ) : (
                <span className="text-green-600">✅ {t(key)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`;

  const testDir = path.join(process.cwd(), 'src', 'app', 'test-translations');
  const testFile = path.join(testDir, 'page.tsx');
  
  try {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, testContent);
    console.log('✅ Arquivo de teste criado em /test-translations');
    console.log('🌐 Acesse http://localhost:3000/test-translations para testar');
  } catch (error) {
    console.error('❌ Erro ao criar arquivo de teste:', error.message);
  }
}

// Executar todas as funções
async function main() {
  console.log('🚀 Iniciando limpeza e verificação de traduções...\n');
  
  clearNextCache();
  console.log('');
  
  clearNodeModulesCache();
  console.log('');
  
  verifyTranslationFiles();
  console.log('');
  
  createTranslationTest();
  console.log('');
  
  console.log('✅ Processo concluído!');
  console.log('📝 Próximos passos:');
  console.log('   1. Execute: npm run dev');
  console.log('   2. Acesse: http://localhost:3000/test-translations');
  console.log('   3. Verifique se as traduções estão funcionando');
}

main().catch(console.error);
