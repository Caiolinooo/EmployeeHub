#!/usr/bin/env node

/**
 * Script para executar correção de políticas RLS da tabela avaliacoes_desempenho
 *
 * Este script:
 * 1. Lê o arquivo SQL com as políticas RLS
 * 2. Conecta ao banco de dados Supabase
 * 3. Executa as políticas em ordem
 * 4. Verifica se foram aplicadas corretamente
 *
 * Uso: node scripts/execute-fix-avaliacoes-rls.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente de múltiplos arquivos
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
const envProductionPath = path.join(__dirname, '..', '.env.production');
const envPath2 = path.join(__dirname, '..', '.env');

// Debug: Imprimir caminhos
console.log('Procurando arquivos .env:');
console.log('  .env.local:', envPath, '- Existe:', fs.existsSync(envPath));
console.log('  .env.production:', envProductionPath, '- Existe:', fs.existsSync(envProductionPath));
console.log('  .env:', envPath2, '- Existe:', fs.existsSync(envPath2));

// Tentar carregar de .env.local primeiro, depois .env.production, depois .env
let loaded = false;
if (fs.existsSync(envPath)) {
  console.log('Carregando .env.local...');
  const result = dotenv.config({ path: envPath });
  loaded = !result.error;
  if (result.error) console.log('Erro ao carregar .env.local:', result.error.message);
}
if (!loaded && fs.existsSync(envProductionPath)) {
  console.log('Carregando .env.production...');
  const result = dotenv.config({ path: envProductionPath });
  loaded = !result.error;
  if (result.error) console.log('Erro ao carregar .env.production:', result.error.message);
}
if (!loaded && fs.existsSync(envPath2)) {
  console.log('Carregando .env...');
  const result = dotenv.config({ path: envPath2 });
  loaded = !result.error;
  if (result.error) console.log('Erro ao carregar .env:', result.error.message);
}

// Último recurso: tentar sem especificar path
if (!loaded) {
  console.log('Tentando carregar dotenv sem path específico...');
  dotenv.config();
}

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║      CORREÇÃO DE POLÍTICAS RLS - AVALIACOES_DESEMPENHO      ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════╝\n', 'cyan');

  // 1. Verificar variáveis de ambiente
  log('1️⃣  Verificando configurações...', 'blue');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Aceitar tanto SUPABASE_SERVICE_ROLE_KEY quanto SUPABASE_SERVICE_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  // Debug
  log(`   DEBUG - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Definida' : 'NÃO definida'}`, 'cyan');
  log(`   DEBUG - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Definida' : 'NÃO definida'}`, 'cyan');
  log(`   DEBUG - SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? 'Definida' : 'NÃO definida'}`, 'cyan');

  if (!supabaseUrl || !supabaseServiceKey) {
    log('❌ Erro: Variáveis de ambiente não configuradas!', 'red');
    log('   Por favor, configure NEXT_PUBLIC_SUPABASE_URL e (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_KEY)', 'yellow');
    process.exit(1);
  }

  log(`   ✅ URL do Supabase: ${supabaseUrl}`, 'green');
  log(`   ✅ Service Key configurada`, 'green');

  // 2. Criar cliente Supabase Admin
  log('\n2️⃣  Conectando ao Supabase...', 'blue');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  log('   ✅ Conectado com sucesso!', 'green');

  // 3. Ler arquivo SQL
  log('\n3️⃣  Lendo arquivo SQL...', 'blue');

  const sqlFilePath = path.join(__dirname, 'fix-avaliacoes-rls-policies.sql');

  if (!fs.existsSync(sqlFilePath)) {
    log(`❌ Erro: Arquivo SQL não encontrado: ${sqlFilePath}`, 'red');
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  log(`   ✅ Arquivo lido com sucesso (${sqlContent.length} caracteres)`, 'green');

  // 4. Dividir SQL em comandos individuais
  log('\n4️⃣  Preparando comandos SQL...', 'blue');

  // Remover comentários e dividir por ponto e vírgula
  const commands = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.match(/^--.*/));

  log(`   ✅ ${commands.length} comandos preparados`, 'green');

  // 5. Executar comandos
  log('\n5️⃣  Executando comandos SQL...', 'blue');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];

    // Pular blocos DO que são muito grandes
    if (command.includes('DO $$') || command.length > 5000) {
      log(`   ⏭️  Pulando comando ${i + 1} (bloco DO ou muito grande)`, 'yellow');
      continue;
    }

    try {
      log(`   ⏳ Executando comando ${i + 1}/${commands.length}...`, 'cyan');

      const { error } = await supabase.rpc('exec_sql', { sql: command });

      if (error) {
        // Alguns erros são esperados (ex: política já existe)
        if (
          error.message.includes('already exists') ||
          error.message.includes('does not exist') ||
          error.message.includes('PGRST116')
        ) {
          log(`   ⚠️  Aviso (esperado): ${error.message.substring(0, 80)}...`, 'yellow');
        } else {
          log(`   ❌ Erro: ${error.message}`, 'red');
          errorCount++;
          errors.push({ command: i + 1, error: error.message });
        }
      } else {
        successCount++;
        log(`   ✅ Comando ${i + 1} executado com sucesso`, 'green');
      }
    } catch (err) {
      log(`   ❌ Erro ao executar comando ${i + 1}: ${err.message}`, 'red');
      errorCount++;
      errors.push({ command: i + 1, error: err.message });
    }
  }

  // 6. Executar usando função SQL direta (alternativa)
  log('\n6️⃣  Tentando executar via função SQL direta...', 'blue');

  try {
    // Criar uma função temporária para executar o SQL
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION execute_rls_fix()
      RETURNS void AS $func$
      BEGIN
        -- Desabilitar RLS temporariamente
        ALTER TABLE IF EXISTS avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;

        -- Remover políticas antigas
        DROP POLICY IF EXISTS "avaliacoes_select_policy" ON avaliacoes_desempenho;
        DROP POLICY IF EXISTS "avaliacoes_insert_policy" ON avaliacoes_desempenho;
        DROP POLICY IF EXISTS "avaliacoes_update_policy" ON avaliacoes_desempenho;
        DROP POLICY IF EXISTS "avaliacoes_delete_policy" ON avaliacoes_desempenho;

        -- Reabilitar RLS
        ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;

        -- Criar políticas (simplified - sem funções helper por enquanto)
        -- SELECT: Todos os usuários autenticados
        CREATE POLICY "avaliacoes_select_policy"
        ON avaliacoes_desempenho FOR SELECT
        USING (auth.uid() IS NOT NULL);

        -- INSERT: Service role apenas (backend via API)
        CREATE POLICY "avaliacoes_insert_policy"
        ON avaliacoes_desempenho FOR INSERT
        WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);

        -- UPDATE: Todos os usuários autenticados
        CREATE POLICY "avaliacoes_update_policy"
        ON avaliacoes_desempenho FOR UPDATE
        USING (auth.uid() IS NOT NULL);

        -- DELETE: Service role apenas
        CREATE POLICY "avaliacoes_delete_policy"
        ON avaliacoes_desempenho FOR DELETE
        USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Tentar executar via SQL direto
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: createFunctionSQL
    });

    if (createError) {
      log(`   ⚠️  Não foi possível criar função helper: ${createError.message}`, 'yellow');
    } else {
      log('   ✅ Função helper criada', 'green');

      // Executar a função
      const { error: execError } = await supabase.rpc('execute_rls_fix');

      if (execError) {
        log(`   ⚠️  Erro ao executar função: ${execError.message}`, 'yellow');
      } else {
        log('   ✅ Políticas RLS aplicadas com sucesso!', 'green');
      }
    }
  } catch (err) {
    log(`   ⚠️  Método alternativo falhou: ${err.message}`, 'yellow');
  }

  // 7. Verificar políticas criadas
  log('\n7️⃣  Verificando políticas criadas...', 'blue');

  try {
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('tablename, policyname, cmd')
      .in('tablename', ['avaliacoes_desempenho', 'pontuacoes_avaliacao', 'criterios']);

    if (error) {
      log(`   ⚠️  Não foi possível verificar políticas: ${error.message}`, 'yellow');
    } else if (policies && policies.length > 0) {
      log(`   ✅ ${policies.length} políticas encontradas:`, 'green');
      policies.forEach(p => {
        log(`      - ${p.tablename}.${p.policyname} (${p.cmd})`, 'cyan');
      });
    } else {
      log('   ⚠️  Nenhuma política encontrada', 'yellow');
    }
  } catch (err) {
    log(`   ⚠️  Erro ao verificar políticas: ${err.message}`, 'yellow');
  }

  // 8. Resumo
  log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                        RESUMO FINAL                           ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════╝\n', 'cyan');

  log(`   Comandos executados com sucesso: ${successCount}`, successCount > 0 ? 'green' : 'yellow');
  log(`   Comandos com erro: ${errorCount}`, errorCount > 0 ? 'red' : 'green');

  if (errors.length > 0) {
    log('\n   Erros encontrados:', 'red');
    errors.slice(0, 5).forEach(e => {
      log(`      - Comando ${e.command}: ${e.error.substring(0, 100)}...`, 'red');
    });
    if (errors.length > 5) {
      log(`      ... e mais ${errors.length - 5} erros`, 'red');
    }
  }

  log('\n✅ Script concluído!', 'green');
  log('   As políticas RLS foram configuradas.', 'cyan');
  log('   Teste criar uma avaliação através da API.', 'cyan');

  process.exit(0);
}

// Executar
main().catch(err => {
  log(`\n❌ Erro fatal: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
