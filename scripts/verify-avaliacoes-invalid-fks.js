const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyInvalidForeignKeys() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verificando registros com foreign keys inválidos...\n');

    // Verificar funcionario_id inválidos
    console.log('📋 Verificando funcionario_id inválidos:');
    const { rows: invalidFuncionarios } = await client.query(`
      SELECT ad.id, ad.funcionario_id, ad.status, ad.periodo, ad.created_at
      FROM avaliacoes_desempenho ad
      LEFT JOIN users_unified u ON ad.funcionario_id = u.id
      WHERE ad.funcionario_id IS NOT NULL
        AND u.id IS NULL
      ORDER BY ad.created_at DESC;
    `);

    if (invalidFuncionarios.length > 0) {
      console.log(`⚠️  Encontrados ${invalidFuncionarios.length} registros com funcionario_id inválido:\n`);
      invalidFuncionarios.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Avaliação ID: ${row.id}`);
        console.log(`     Funcionário ID: ${row.funcionario_id}`);
        console.log(`     Status: ${row.status}`);
        console.log(`     Período: ${row.periodo}`);
        console.log(`     Criado em: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('✓ Nenhum registro com funcionario_id inválido\n');
    }

    // Verificar avaliador_id inválidos
    console.log('📋 Verificando avaliador_id inválidos:');
    const { rows: invalidAvaliadores } = await client.query(`
      SELECT ad.id, ad.avaliador_id, ad.status, ad.periodo, ad.created_at
      FROM avaliacoes_desempenho ad
      LEFT JOIN users_unified u ON ad.avaliador_id = u.id
      WHERE ad.avaliador_id IS NOT NULL
        AND u.id IS NULL
      ORDER BY ad.created_at DESC;
    `);

    if (invalidAvaliadores.length > 0) {
      console.log(`⚠️  Encontrados ${invalidAvaliadores.length} registros com avaliador_id inválido:\n`);
      invalidAvaliadores.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Avaliação ID: ${row.id}`);
        console.log(`     Avaliador ID: ${row.avaliador_id}`);
        console.log(`     Status: ${row.status}`);
        console.log(`     Período: ${row.periodo}`);
        console.log(`     Criado em: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('✓ Nenhum registro com avaliador_id inválido\n');
    }

    // Contadores gerais
    const { rows: totalAvaliacoes } = await client.query('SELECT COUNT(*) as count FROM avaliacoes_desempenho');
    const { rows: totalUsers } = await client.query('SELECT COUNT(*) as count FROM users_unified');

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Resumo:');
    console.log(`   Total de avaliações: ${totalAvaliacoes[0].count}`);
    console.log(`   Avaliações com funcionario_id inválido: ${invalidFuncionarios.length}`);
    console.log(`   Avaliações com avaliador_id inválido: ${invalidAvaliadores.length}`);
    console.log(`   Total de usuários em users_unified: ${totalUsers[0].count}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (invalidFuncionarios.length > 0 || invalidAvaliadores.length > 0) {
      console.log('⚠️  AÇÃO NECESSÁRIA:');
      console.log('   Existem registros com IDs inválidos que precisam ser corrigidos');
      console.log('   antes de criar as foreign keys.\n');
      console.log('   Opções:');
      console.log('   1. Deletar registros inválidos');
      console.log('   2. Atualizar para apontar para usuários válidos');
      console.log('   3. Criar registros faltantes em users_unified\n');
    } else {
      console.log('✅ Todos os registros são válidos!');
      console.log('   Pode prosseguir com a criação das foreign keys.\n');
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyInvalidForeignKeys();
