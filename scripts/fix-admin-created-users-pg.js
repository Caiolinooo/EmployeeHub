/**
 * Script para marcar como verificados os usuários criados pelo admin
 * Executa via PostgreSQL direto
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixAdminCreatedUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Buscando usuários criados pelo admin antes de 2025-11-07 23:00:00 UTC...\n');

    // Buscar usuários que precisam ser atualizados
    const selectQuery = `
      SELECT
        id,
        email,
        first_name,
        last_name,
        email_verified,
        created_at,
        access_history
      FROM users_unified
      WHERE
        created_at < '2025-11-07 23:00:00+00'
        AND (email_verified = false OR email_verified IS NULL)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(access_history) AS history_item
          WHERE
            history_item->>'action' = 'CREATED'
            AND history_item->>'details' LIKE 'Usuário criado por%'
        )
      ORDER BY created_at DESC
    `;

    const result = await pool.query(selectQuery);
    const users = result.rows;

    console.log(`📊 Encontrados ${users.length} usuários criados pelo admin:\n`);

    if (users.length === 0) {
      console.log('✅ Nenhum usuário precisa ser atualizado');
      await pool.end();
      process.exit(0);
    }

    users.forEach(user => {
      const createdByEntry = user.access_history.find(item =>
        item.action === 'CREATED' &&
        item.details &&
        item.details.includes('Usuário criado por')
      );
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`    ${createdByEntry?.details || 'Criado pelo admin'}`);
      console.log(`    Criado em: ${user.created_at}\n`);
    });

    console.log('📝 Atualizando usuários...\n');

    // Atualizar todos os usuários de uma vez
    const updateQuery = `
      UPDATE users_unified
      SET
        email_verified = true,
        updated_at = NOW()
      WHERE
        created_at < '2025-11-07 23:00:00+00'
        AND (email_verified = false OR email_verified IS NULL)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(access_history) AS history_item
          WHERE
            history_item->>'action' = 'CREATED'
            AND history_item->>'details' LIKE 'Usuário criado por%'
        )
      RETURNING id, email, first_name, last_name
    `;

    const updateResult = await pool.query(updateQuery);
    const updatedUsers = updateResult.rows;

    console.log('✅ Usuários atualizados:');
    updatedUsers.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name} (${user.email})`);
    });

    console.log('\n📊 RESULTADO:');
    console.log(`   ✅ Total atualizado: ${updatedUsers.length}`);

    console.log('\n🎉 Script concluído!');
    console.log('Agora os usuários criados pelo admin podem fazer login sem verificar email.');

    await pool.end();

  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    await pool.end();
    process.exit(1);
  }
}

fixAdminCreatedUsers();
