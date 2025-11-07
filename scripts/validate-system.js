#!/usr/bin/env node

/**
 * Script de validação do sistema
 * Verifica funcionalidades críticas após mudanças
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════');
console.log('  VALIDAÇÃO DO SISTEMA - EmployeeHub');
console.log('═══════════════════════════════════════════════════\n');

let errors = [];
let warnings = [];
let passed = 0;
let failed = 0;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`${colors.red}✗${colors.reset} ${name}`);
      failed++;
      errors.push(name);
    } else {
      console.log(`${colors.green}✓${colors.reset} ${name}`);
      passed++;
    }
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}: ${error.message}`);
    failed++;
    errors.push(`${name}: ${error.message}`);
  }
}

function warn(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
  warnings.push(message);
}

console.log('📋 Verificando arquivos críticos...\n');

// 1. Verificar estrutura de diretórios
test('Diretório src/ existe', () => {
  return fs.existsSync(path.join(__dirname, '../src'));
});

test('Diretório src/app/ existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/app'));
});

test('Diretório src/components/ existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/components'));
});

test('Diretório src/lib/ existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/lib'));
});

// 2. Verificar arquivos de configuração
console.log('\n📦 Verificando arquivos de configuração...\n');

test('package.json existe', () => {
  const pkgPath = path.join(__dirname, '../package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Verificar dependências críticas
  if (!pkg.dependencies) return false;
  if (!pkg.dependencies['next']) return false;
  if (!pkg.dependencies['react']) return false;
  if (!pkg.dependencies['@supabase/supabase-js']) return false;

  return true;
});

test('tsconfig.json existe', () => {
  return fs.existsSync(path.join(__dirname, '../tsconfig.json'));
});

test('next.config.js existe', () => {
  return fs.existsSync(path.join(__dirname, '../next.config.js'));
});

test('.env.example existe (template)', () => {
  const envExample = path.join(__dirname, '../.env.example');
  return fs.existsSync(envExample) || fs.existsSync(path.join(__dirname, '../.env.local'));
});

// 3. Verificar arquivos críticos de autenticação
console.log('\n🔐 Verificando módulos de autenticação...\n');

test('src/lib/auth.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/lib/auth.ts'));
});

test('src/lib/auth.ts tem verifyToken', () => {
  const authPath = path.join(__dirname, '../src/lib/auth.ts');
  if (!fs.existsSync(authPath)) return false;

  const content = fs.readFileSync(authPath, 'utf8');
  return content.includes('export function verifyToken') ||
         content.includes('export const verifyToken');
});

test('src/lib/auth.ts tem verifyRequestToken', () => {
  const authPath = path.join(__dirname, '../src/lib/auth.ts');
  if (!fs.existsSync(authPath)) return false;

  const content = fs.readFileSync(authPath, 'utf8');
  return content.includes('verifyRequestToken');
});

// 4. Verificar middleware
console.log('\n⚙️  Verificando middleware...\n');

test('src/middleware.config.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/middleware.config.ts'));
});

test('src/middleware.config.ts tem isPublicRoute', () => {
  const middlewarePath = path.join(__dirname, '../src/middleware.config.ts');
  if (!fs.existsSync(middlewarePath)) return false;

  const content = fs.readFileSync(middlewarePath, 'utf8');
  return content.includes('isPublicRoute');
});

// 5. Verificar Supabase
console.log('\n🗄️  Verificando integração Supabase...\n');

test('src/lib/supabase.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/lib/supabase.ts'));
});

test('src/lib/supabase.ts tem getSupabaseClient', () => {
  const supabasePath = path.join(__dirname, '../src/lib/supabase.ts');
  if (!fs.existsSync(supabasePath)) return false;

  const content = fs.readFileSync(supabasePath, 'utf8');
  return content.includes('getSupabaseClient');
});

// 6. Verificar rotas de API críticas
console.log('\n🌐 Verificando rotas de API críticas...\n');

test('src/app/api/auth/login/route.ts existe', () => {
  const loginPath = path.join(__dirname, '../src/app/api/auth/login/route.ts');
  return fs.existsSync(loginPath) ||
         fs.existsSync(path.join(__dirname, '../src/pages/api/auth/login.ts'));
});

test('src/app/api/users-unified/route.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/app/api/users-unified/route.ts'));
});

// 7. Verificar segurança
console.log('\n🔒 Verificando documentação de segurança...\n');

test('SECURITY.md existe', () => {
  return fs.existsSync(path.join(__dirname, '../SECURITY.md'));
});

test('SECURITY.md documenta vulnerabilidades', () => {
  const secPath = path.join(__dirname, '../SECURITY.md');
  if (!fs.existsSync(secPath)) return false;

  const content = fs.readFileSync(secPath, 'utf8');
  return content.includes('xlsx') &&
         content.includes('vulnerabilidade') || content.includes('vulnerability');
});

// 8. Verificar atualizações de dependências
console.log('\n📊 Verificando atualizações de dependências...\n');

test('next atualizado para >= 14.2.33', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const nextVersion = pkg.dependencies.next;

  // Extrair número da versão
  const match = nextVersion.match(/(\d+\.\d+\.\d+)/);
  if (!match) return false;

  const [major, minor, patch] = match[1].split('.').map(Number);

  // Verificar >= 14.2.33
  if (major > 14) return true;
  if (major === 14 && minor > 2) return true;
  if (major === 14 && minor === 2 && patch >= 33) return true;

  return false;
});

test('nodemailer atualizado para >= 7.0.7', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const nodemailerVersion = pkg.dependencies.nodemailer;

  // Extrair número da versão
  const match = nodemailerVersion.match(/(\d+\.\d+\.\d+)/);
  if (!match) return false;

  const [major, minor, patch] = match[1].split('.').map(Number);

  // Verificar >= 7.0.7
  if (major > 7) return true;
  if (major === 7 && minor > 0) return true;
  if (major === 7 && minor === 0 && patch >= 7) return true;

  return false;
});

test('pdfjs-dist atualizado para >= 4.1.393', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const pdfjsVersion = pkg.dependencies['pdfjs-dist'];

  // Extrair número da versão
  const match = pdfjsVersion.match(/(\d+\.\d+\.\d+)/);
  if (!match) return false;

  const [major, minor, patch] = match[1].split('.').map(Number);

  // Verificar >= 4.1.393
  if (major > 4) return true;
  if (major === 4 && minor > 1) return true;
  if (major === 4 && minor === 1 && patch >= 393) return true;

  return false;
});

test('playwright atualizado para >= 1.55.1', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const playwrightVersion = pkg.dependencies.playwright;

  // Extrair número da versão
  const match = playwrightVersion.match(/(\d+\.\d+\.\d+)/);
  if (!match) return false;

  const [major, minor, patch] = match[1].split('.').map(Number);

  // Verificar >= 1.55.1
  if (major > 1) return true;
  if (major === 1 && minor > 55) return true;
  if (major === 1 && minor === 55 && patch >= 1) return true;

  return false;
});

test('task-master-ai removido', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  return !pkg.dependencies['task-master-ai'];
});

// 9. Verificar i18n
console.log('\n🌍 Verificando internacionalização...\n');

test('src/i18n/locales/pt-BR.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/i18n/locales/pt-BR.ts'));
});

test('src/i18n/locales/en-US.ts existe', () => {
  return fs.existsSync(path.join(__dirname, '../src/i18n/locales/en-US.ts'));
});

// 10. Verificar documentação
console.log('\n📚 Verificando documentação...\n');

test('docs/NAMING_CONVENTIONS.md existe', () => {
  return fs.existsSync(path.join(__dirname, '../docs/NAMING_CONVENTIONS.md'));
});

test('README.md existe', () => {
  return fs.existsSync(path.join(__dirname, '../README.md'));
});

// RESUMO
console.log('\n═══════════════════════════════════════════════════');
console.log('  RESUMO DA VALIDAÇÃO');
console.log('═══════════════════════════════════════════════════\n');

console.log(`${colors.green}✓ Testes passou: ${passed}${colors.reset}`);
console.log(`${colors.red}✗ Testes falhou: ${failed}${colors.reset}`);
console.log(`${colors.yellow}⚠ Avisos: ${warnings.length}${colors.reset}\n`);

if (errors.length > 0) {
  console.log(`${colors.red}Erros encontrados:${colors.reset}`);
  errors.forEach(err => console.log(`  - ${err}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log(`${colors.yellow}Avisos:${colors.reset}`);
  warnings.forEach(warn => console.log(`  - ${warn}`));
  console.log('');
}

// Status final
const percentage = ((passed / (passed + failed)) * 100).toFixed(1);
console.log(`Taxa de sucesso: ${percentage}%\n`);

if (failed > 0) {
  console.log(`${colors.red}❌ Validação FALHOU${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`${colors.green}✅ Validação PASSOU${colors.reset}\n`);
  process.exit(0);
}
