#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import translation files
const ptBR = require('../src/i18n/locales/pt-BR.ts');
const enUS = require('../src/i18n/locales/en-US.ts');

console.log('🧪 Iniciando teste abrangente do sistema de traduções...\n');

// Function to get all keys from an object recursively
function getAllKeys(obj, prefix = '') {
  let keys = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  
  return keys;
}

// Function to get value from nested object using dot notation
function getValue(obj, key) {
  return key.split('.').reduce((o, k) => o && o[k], obj);
}

// Get all keys from both locales
const ptKeys = getAllKeys(ptBR.default || ptBR);
const enKeys = getAllKeys(enUS.default || enUS);

console.log(`📊 Estatísticas das traduções:`);
console.log(`   - Chaves em pt-BR: ${ptKeys.length}`);
console.log(`   - Chaves em en-US: ${enKeys.length}`);
console.log('');

// Find missing keys
const missingInEn = ptKeys.filter(key => !enKeys.includes(key));
const missingInPt = enKeys.filter(key => !ptKeys.includes(key));

if (missingInEn.length > 0) {
  console.log('❌ Chaves ausentes em en-US:');
  missingInEn.forEach(key => console.log(`   - ${key}`));
  console.log('');
} else {
  console.log('✅ Todas as chaves do pt-BR existem em en-US');
}

if (missingInPt.length > 0) {
  console.log('❌ Chaves ausentes em pt-BR:');
  missingInPt.forEach(key => console.log(`   - ${key}`));
  console.log('');
} else {
  console.log('✅ Todas as chaves do en-US existem em pt-BR');
}

// Check for empty translations
const ptObj = ptBR.default || ptBR;
const enObj = enUS.default || enUS;

const emptyInPt = ptKeys.filter(key => {
  const value = getValue(ptObj, key);
  return !value || value.trim() === '';
});

const emptyInEn = enKeys.filter(key => {
  const value = getValue(enObj, key);
  return !value || value.trim() === '';
});

if (emptyInPt.length > 0) {
  console.log('⚠️  Traduções vazias em pt-BR:');
  emptyInPt.forEach(key => console.log(`   - ${key}`));
  console.log('');
} else {
  console.log('✅ Nenhuma tradução vazia em pt-BR');
}

if (emptyInEn.length > 0) {
  console.log('⚠️  Traduções vazias em en-US:');
  emptyInEn.forEach(key => console.log(`   - ${key}`));
  console.log('');
} else {
  console.log('✅ Nenhuma tradução vazia em en-US');
}

// Check for identical translations (might indicate missing translations)
const identicalTranslations = [];
const commonKeys = ptKeys.filter(key => enKeys.includes(key));

commonKeys.forEach(key => {
  const ptValue = getValue(ptObj, key);
  const enValue = getValue(enObj, key);
  
  if (ptValue === enValue && ptValue && typeof ptValue === 'string') {
    // Skip keys that are expected to be the same (like URLs, codes, etc.)
    if (!key.includes('url') && !key.includes('code') && !key.includes('id') && 
        !ptValue.includes('http') && !ptValue.includes('@') && 
        ptValue.length > 3) {
      identicalTranslations.push({ key, value: ptValue });
    }
  }
});

if (identicalTranslations.length > 0) {
  console.log('⚠️  Traduções idênticas (possíveis traduções ausentes):');
  identicalTranslations.slice(0, 10).forEach(({ key, value }) => {
    console.log(`   - ${key}: "${value}"`);
  });
  if (identicalTranslations.length > 10) {
    console.log(`   ... e mais ${identicalTranslations.length - 10} traduções`);
  }
  console.log('');
}

// Test critical translation keys
const criticalKeys = [
  'common.loading',
  'common.error',
  'common.success',
  'common.chooseLanguage',
  'common.portuguese',
  'common.english',
  'auth.email',
  'auth.password',
  'auth.login',
  'auth.accessAccount',
  'register.title',
  'register.name',
  'register.lastName',
  'reimbursement.title',
  'reimbursement.form.personalInfo'
];

console.log('🔍 Testando chaves críticas:');
criticalKeys.forEach(key => {
  const ptValue = getValue(ptObj, key);
  const enValue = getValue(enObj, key);
  
  const ptExists = ptValue && typeof ptValue === 'string' && ptValue.trim() !== '';
  const enExists = enValue && typeof enValue === 'string' && enValue.trim() !== '';
  
  if (ptExists && enExists) {
    console.log(`   ✅ ${key}`);
  } else {
    console.log(`   ❌ ${key} - PT: ${ptExists ? '✓' : '✗'}, EN: ${enExists ? '✓' : '✗'}`);
  }
});

console.log('\n📋 Resumo do teste:');
console.log(`   - Total de chaves testadas: ${Math.max(ptKeys.length, enKeys.length)}`);
console.log(`   - Chaves ausentes: ${missingInEn.length + missingInPt.length}`);
console.log(`   - Traduções vazias: ${emptyInPt.length + emptyInEn.length}`);
console.log(`   - Traduções idênticas: ${identicalTranslations.length}`);

const hasIssues = missingInEn.length > 0 || missingInPt.length > 0 || 
                  emptyInPt.length > 0 || emptyInEn.length > 0;

if (hasIssues) {
  console.log('\n⚠️  Foram encontrados problemas no sistema de traduções.');
  process.exit(1);
} else {
  console.log('\n✅ Sistema de traduções está funcionando corretamente!');
  process.exit(0);
}
