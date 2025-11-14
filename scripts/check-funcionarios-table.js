const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkFuncionariosTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar estrutura da tabela funcionarios
    console.log('\n📋 Verificando tabela funcionarios...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'funcionarios'
      ORDER BY ordinal_position;
    `);

    if (columnsResult.rows.length === 0) {
      console.log('❌ Tabela funcionarios não encontrada');
      return;
    }

    console.log('Colunas encontradas em funcionarios:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Verificar dados na tabela
    const dataResult = await client.query('SELECT COUNT(*) as count FROM funcionarios');
    console.log(`\n📊 Total de registros em funcionarios: ${dataResult.rows[0].count}`);

    if (dataResult.rows[0].count > 0) {
      const sampleResult = await client.query(`
        SELECT * FROM funcionarios LIMIT 3
      `);

      console.log('\n📋 Amostra de dados em funcionarios:');
      sampleResult.rows.forEach(row => {
        console.log(`  - ${row.id}: ${row.nome || row.first_name} ${row.last_name || ''} - ${row.email || ''}`);
      });
    }

    // Verificar se podemos atualizar os relacionamentos em avaliacoes_desempenho
    console.log('\n🔗 Verificando relacionamentos...');
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'avaliacoes_desempenho'
      AND (kcu.column_name = 'funcionario_id' OR kcu.column_name = 'avaliador_id');
    `);

    console.log('FKs de avaliacoes_desempenho:');
    fkResult.rows.forEach(fk => {
      console.log(`  - ${fk.constraint_name}: ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // Se as FKs apontam para funcionarios, criar views que apontem para users_unified
    if (fkResult.rows.length > 0) {
      console.log('\n🔧 Criando views para redirecionar relacionamentos...');

      // Verificar se existe tabela users_unified
      const unifiedResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'users_unified'
        );
      `);

      if (unifiedResult.rows[0].exists) {
        console.log('✅ Tabela users_unified encontrada');

        try {
          // Criar view que simula a tabela funcionarios baseada em users_unified
          await client.query(`
            CREATE OR REPLACE VIEW vw_funcionarios_unified AS
            SELECT
              u.id,
              u.first_name || ' ' || u.last_name as nome,
              u.position as cargo,
              u.department as departamento,
              u.email,
              u.role,
              u.is_lider,
              u.is_authorized,
              u.active as status,
              u.created_at,
              u.updated_at
            FROM users_unified u;
          `);
          console.log('✅ View vw_funcionarios_unified criada');

          // Verificar dados da view
          const viewResult = await client.query('SELECT COUNT(*) as count FROM vw_funcionarios_unified');
          console.log(`✅ View vw_funcionarios_unified tem ${viewResult.rows[0].count} registros`);

        } catch (viewError) {
          console.log('❌ Erro ao criar view:', viewError.message);
        }
      }
    }

    console.log('\n🚀 Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

checkFuncionariosTable();