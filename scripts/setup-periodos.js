const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function setupPeriodos() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar se já existem dados
    const result = await client.query('SELECT COUNT(*) as count FROM periodos_avaliacao');
    const count = result.rows[0].count;

    console.log(`📊 Total de registros: ${count}`);

    if (count === 0) {
      console.log('📝 Inserindo dados de exemplo...');

      // Inserir dados do ciclo 2025
      await client.query(`
        INSERT INTO periodos_avaliacao (id, nome, descricao, data_inicio, data_fim, ativo, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          'Ciclo de Avaliação 2025',
          'Avaliação de desempenho para o ano de 2025',
          '2025-01-01',
          '2025-12-31',
          true,
          NOW(),
          NOW()
        )
      `);

      console.log('✅ Dados inseridos');
    } else {
      console.log('ℹ️ Dados já existem na tabela');
    }

    // Listar todos os períodos
    const periodosResult = await client.query('SELECT * FROM periodos_avaliacao ORDER BY created_at DESC');
    const periodos = periodosResult.rows;

    console.log('\n📋 Períodos cadastrados:');
    periodos.forEach(p => {
      console.log(`  - ${p.nome} (${p.data_inicio} a ${p.data_fim}) - ${p.ativo ? 'Ativo' : 'Inativo'}`);
    });

    console.log('\n🚀 Setup de períodos concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

setupPeriodos();