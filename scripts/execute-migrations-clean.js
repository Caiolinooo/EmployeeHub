/**
 * Script para executar migrations com limpeza prévia
 * Remove tabelas antigas e cria novamente
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuração da conexão PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não configurada no .env');
  process.exit(1);
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function executarMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Conectando ao banco de dados...\n');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');

    // Avisar sobre DROP de tabelas
    console.log('⚠️  ATENÇÃO: Este script vai DROPAR e RECRIAR as seguintes tabelas:');
    console.log('   - avaliacao_usuarios_elegiveis');
    console.log('   - gerentes_avaliacao_config');
    console.log('   - avaliacao_colaborador_gerente');
    console.log('   - avaliacao_cron_log');
    console.log('');
    console.log('   Os dados nestas tabelas serão PERDIDOS!\n');

    const answer = await askQuestion('Deseja continuar? (s/N): ');

    if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
      console.log('❌ Operação cancelada pelo usuário');
      process.exit(0);
    }

    console.log('\n🗑️  Removendo tabelas antigas...\n');

    // Dropar tabelas na ordem correta (dependências primeiro)
    const dropStatements = [
      'DROP TABLE IF EXISTS avaliacao_colaborador_gerente CASCADE',
      'DROP TABLE IF EXISTS gerentes_avaliacao_config CASCADE',
      'DROP TABLE IF EXISTS avaliacao_usuarios_elegiveis CASCADE',
      'DROP TABLE IF EXISTS avaliacao_cron_log CASCADE',
      'DROP FUNCTION IF EXISTS get_gerente_colaborador CASCADE',
      'DROP FUNCTION IF EXISTS is_usuario_lider CASCADE'
    ];

    for (const statement of dropStatements) {
      try {
        await client.query(statement);
        console.log(`✅ ${statement.substring(0, 60)}...`);
      } catch (err) {
        console.log(`⚠️  ${statement.substring(0, 60)}... (não existia)`);
      }
    }

    // Ler arquivo SQL
    const sqlFile = path.join(__dirname, 'migrations', 'avaliacao-complete-setup.sql');
    console.log('\n📄 Lendo arquivo:', sqlFile);

    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFile}`);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ Arquivo SQL carregado\n');

    // Executar o SQL completo
    console.log('⚙️  Executando migrations...\n');
    await client.query(sqlContent);
    console.log('✅ Migrations executadas com sucesso!\n');

    // Verificar tabelas criadas
    console.log('🔍 Verificando tabelas criadas...\n');

    const tables = [
      'avaliacao_usuarios_elegiveis',
      'gerentes_avaliacao_config',
      'avaliacao_colaborador_gerente',
      'avaliacao_cron_log',
      'periodos_avaliacao',
      'criterios'
    ];

    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `, [table]);

      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} Tabela ${table}: ${exists ? 'OK' : 'NÃO ENCONTRADA'}`);
    }

    // Verificar funções criadas
    console.log('\n🔍 Verificando funções criadas...\n');

    const functions = [
      'get_gerente_colaborador',
      'is_usuario_lider'
    ];

    for (const func of functions) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc
          WHERE proname = $1
        );
      `, [func]);

      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} Função ${func}(): ${exists ? 'OK' : 'NÃO ENCONTRADA'}`);
    }

    console.log('\n✅ Migrations concluídas com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro ao executar migrations:');
    console.error(error.message);
    if (error.position) {
      console.error(`Posição do erro: ${error.position}`);
    }
    if (error.hint) {
      console.error(`Dica: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão encerrada');
  }
}

executarMigrations();
