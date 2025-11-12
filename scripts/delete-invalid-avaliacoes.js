const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteInvalidRecords() {
  const client = await pool.connect();

  try {
    console.log('🗑️  Deletando registros de avaliações com IDs inválidos...\n');

    // Começar transação
    await client.query('BEGIN');

    // Listar registros que serão deletados
    const { rows: toDelete } = await client.query(`
      SELECT ad.id, ad.funcionario_id, ad.avaliador_id, ad.status, ad.periodo
      FROM avaliacoes_desempenho ad
      LEFT JOIN users_unified uf ON ad.funcionario_id = uf.id
      LEFT JOIN users_unified ua ON ad.avaliador_id = ua.id
      WHERE (ad.funcionario_id IS NOT NULL AND uf.id IS NULL)
         OR (ad.avaliador_id IS NOT NULL AND ua.id IS NULL)
      ORDER BY ad.created_at DESC;
    `);

    console.log(`📋 Encontrados ${toDelete.length} registros para deletar:\n`);
    toDelete.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ID: ${row.id.substring(0, 8)}...`);
      console.log(`     Período: ${row.periodo}`);
      console.log(`     Status: ${row.status}`);
    });

    // Deletar registros
    const { rowCount } = await client.query(`
      DELETE FROM avaliacoes_desempenho ad
      USING (
        SELECT ad2.id
        FROM avaliacoes_desempenho ad2
        LEFT JOIN users_unified uf ON ad2.funcionario_id = uf.id
        LEFT JOIN users_unified ua ON ad2.avaliador_id = ua.id
        WHERE (ad2.funcionario_id IS NOT NULL AND uf.id IS NULL)
           OR (ad2.avaliador_id IS NOT NULL AND ua.id IS NULL)
      ) AS invalid
      WHERE ad.id = invalid.id;
    `);

    // Confirmar transação
    await client.query('COMMIT');

    console.log(`\n✅ ${rowCount} registros deletados com sucesso!\n`);

    // Verificar se ainda existem registros inválidos
    const { rows: remaining } = await client.query(`
      SELECT COUNT(*) as count
      FROM avaliacoes_desempenho ad
      LEFT JOIN users_unified uf ON ad.funcionario_id = uf.id
      LEFT JOIN users_unified ua ON ad.avaliador_id = ua.id
      WHERE (ad.funcionario_id IS NOT NULL AND uf.id IS NULL)
         OR (ad.avaliador_id IS NOT NULL AND ua.id IS NULL);
    `);

    if (remaining[0].count === '0') {
      console.log('✓ Todos os registros inválidos foram removidos!');
      console.log('✓ Pronto para criar as foreign keys.\n');
    } else {
      console.log(`⚠️  Ainda existem ${remaining[0].count} registros inválidos\n`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro ao deletar registros:', error.message);
    console.error('Transação revertida.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteInvalidRecords();
