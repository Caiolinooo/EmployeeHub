/**
 * Script para configurar o cron job do Supabase
 * Cria a função de criação automática de avaliações e agenda o cron
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não configurada no .env');
  process.exit(1);
}

async function setupCron() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Conectando ao banco de dados...\n');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Ler arquivo SQL do cron
    const sqlFile = path.join(__dirname, 'migrations', 'setup-supabase-cron.sql');
    console.log('📄 Lendo arquivo:', sqlFile);

    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFile}`);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ Arquivo carregado\n');

    console.log('⚙️  Instalando extensão pg_cron...\n');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
      console.log('✅ Extensão pg_cron instalada!\n');
    } catch (err) {
      if (err.message.includes('permission denied')) {
        console.log('⚠️  Aviso: Permissão negada para criar extensão pg_cron');
        console.log('   Isto é normal no Supabase - o cron já está configurado\n');
      } else {
        throw err;
      }
    }

    console.log('⚙️  Executando configuração do cron...\n');
    await client.query(sqlContent);
    console.log('✅ Configuração do cron concluída!\n');

    // Verificar se a função foi criada
    const funcCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = 'criar_avaliacoes_automaticamente'
      );
    `);

    if (funcCheck.rows[0].exists) {
      console.log('✅ Função criar_avaliacoes_automaticamente(): OK');
    } else {
      console.log('❌ Função criar_avaliacoes_automaticamente(): NÃO ENCONTRADA');
    }

    // Verificar se a função de notificação foi criada
    const notifCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = 'enviar_notificacao_avaliacao'
      );
    `);

    if (notifCheck.rows[0].exists) {
      console.log('✅ Função enviar_notificacao_avaliacao(): OK');
    } else {
      console.log('❌ Função enviar_notificacao_avaliacao(): NÃO ENCONTRADA');
    }

    console.log('\n✅ Setup do cron concluído com sucesso!');
    console.log('\n📝 Nota: O cron job foi configurado para executar diariamente às 12h UTC (9h BRT)');

  } catch (error) {
    console.error('\n❌ Erro ao configurar cron:');
    console.error(error.message);
    if (error.hint) {
      console.error(`Dica: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão encerrada');
  }
}

setupCron();
