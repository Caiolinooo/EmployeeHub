const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testGerentesFunction() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar se a função toggle_gerente_avaliacao existe
    console.log('\n🔍 Verificando função toggle_gerente_avaliacao...');
    const functionResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_name = 'toggle_gerente_avaliacao'
      AND routine_schema = 'public';
    `);

    if (functionResult.rows.length === 0) {
      console.log('❌ Função toggle_gerente_avaliacao não existe!');
      return;
    }

    console.log('✅ Função toggle_gerente_avaliacao encontrada');

    // Listar usuários disponíveis para teste
    console.log('\n👥 Listando usuários disponíveis...');
    const usersResult = await client.query(`
      SELECT id, first_name, last_name, email, role
      FROM users_unified
      WHERE is_authorized = true AND active = true
      ORDER BY first_name
      LIMIT 3;
    `);

    console.log('Usuários encontrados:');
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.first_name} ${user.last_name} (${user.email}) - ${user.role}`);
    });

    if (usersResult.rows.length > 0) {
      const testUser = usersResult.rows[0];
      console.log(`\n🧪 Testando função com usuário: ${testUser.first_name} ${testUser.last_name}`);

      try {
        const testResult = await client.query(`
          SELECT * FROM toggle_gerente_avaliacao(
            $1::UUID,
            true,
            '75abe69b-15ac-4ac2-b973-1075c37252c5'::UUID
          );
        `, [testUser.id]);

        console.log('✅ Resultado da função:', testResult.rows[0]);

        // Testar remoção
        const removeResult = await client.query(`
          SELECT * FROM toggle_gerente_avaliacao(
            $1::UUID,
            false,
            '75abe69b-15ac-4ac2-b973-1075c37252c5'::UUID
          );
        `, [testUser.id]);

        console.log('✅ Resultado da remoção:', removeResult.rows[0]);

      } catch (testError) {
        console.error('❌ Erro ao testar função:', testError.message);
        console.error('Detalhes:', testError);
      }
    }

    // Verificar estrutura da tabela gerentes_avaliacao_config
    console.log('\n📋 Verificando tabela gerentes_avaliacao_config...');
    const tableResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gerentes_avaliacao_config'
      ORDER BY ordinal_position;
    `);

    console.log('Estrutura da tabela:');
    tableResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Verificar dados atuais
    const currentDataResult = await client.query(`
      SELECT
        g.id,
        g.usuario_id,
        g.ativo,
        u.first_name,
        u.last_name,
        u.email
      FROM gerentes_avaliacao_config g
      JOIN users_unified u ON g.usuario_id = u.id
      ORDER BY u.first_name;
    `);

    console.log(`\n📊 Gerentes configurados atualmente: ${currentDataResult.rows.length}`);
    currentDataResult.rows.forEach(gerente => {
      console.log(`  - ${gerente.first_name} ${gerente.last_name} (${gerente.email}) - ${gerente.ativo ? 'Ativo' : 'Inativo'}`);
    });

    console.log('\n🚀 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

testGerentesFunction();