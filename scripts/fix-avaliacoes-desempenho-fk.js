const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixAvaliacoesDesempenhoFK() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar estrutura da tabela avaliacoes_desempenho
    console.log('\n📋 Verificando estrutura da tabela avaliacoes_desempenho...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'avaliacoes_desempenho'
      ORDER BY ordinal_position;
    `);

    console.log('Colunas encontradas:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Verificar se as colunas necessárias existem
    const hasDadosColaborador = columnsResult.rows.some(col => col.column_name === 'dados_colaborador');
    const hasDadosGerente = columnsResult.rows.some(col => col.column_name === 'dados_gerente');

    if (!hasDadosColaborador) {
      console.log('\n🔧 Adicionando coluna dados_colaborador...');
      await client.query(`
        ALTER TABLE avaliacoes_desempenho
        ADD COLUMN dados_colaborador JSONB;
      `);
      console.log('✅ Coluna dados_colaborador adicionada');
    }

    if (!hasDadosGerente) {
      console.log('\n🔧 Adicionando coluna dados_gerente...');
      await client.query(`
        ALTER TABLE avaliacoes_desempenho
        ADD COLUMN dados_gerente JSONB;
      `);
      console.log('✅ Coluna dados_gerente adicionada');
    }

    // Verificar foreign keys existentes
    console.log('\n🔗 Verificando foreign keys...');
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
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
      AND tc.table_name = 'avaliacoes_desempenho';
    `);

    console.log('Foreign keys encontrados:');
    fkResult.rows.forEach(fk => {
      console.log(`  - ${fk.constraint_name}: ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // Verificar se existe FK para users_unified
    const hasUsersUnifiedFK = fkResult.rows.some(fk =>
      fk.foreign_table_name === 'users_unified' ||
      fk.foreign_table_name === 'users'
    );

    if (!hasUsersUnifiedFK) {
      console.log('\n⚠️ Aviso: Não há foreign keys para users_unified. Verificando dados...');

      // Verificar se há dados na tabela
      const dataResult = await client.query(`
        SELECT COUNT(*) as count
        FROM avaliacoes_desempenho
        WHERE deleted_at IS NULL
      `);

      console.log(`📊 Total de avaliações ativas: ${dataResult.rows[0].count}`);

      // Listar amostra de dados
      const sampleResult = await client.query(`
        SELECT id, funcionario_id, avaliador_id, status, periodo
        FROM avaliacoes_desempenho
        WHERE deleted_at IS NULL
        LIMIT 3
      `);

      if (sampleResult.rows.length > 0) {
        console.log('\n📋 Amostra de avaliações:');
        sampleResult.rows.forEach(row => {
          console.log(`  - ID: ${row.id}, Func: ${row.funcionario_id}, Aval: ${row.avaliador_id}, Status: ${row.status}`);
        });
      }
    }

    // Verificar se a tabela users ainda existe (se existir, criar views de compatibilidade)
    const usersTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    const hasUsersTable = usersTableResult.rows[0].exists;
    console.log(`\n📋 Tabela 'users' existe: ${hasUsersTable ? 'SIM' : 'NÃO'}`);

    if (!hasUsersTable) {
      console.log('🔧 Criando view de compatibilidade para "users"...');
      try {
        await client.query(`
          CREATE OR REPLACE VIEW users AS
          SELECT id, first_name, last_name, email, role, position, department, is_authorized, active
          FROM users_unified;
        `);
        console.log('✅ View de compatibilidade "users" criada');
      } catch (viewError) {
        console.log('⚠️ Erro ao criar view:', viewError.message);
      }
    }

    // Verificar dados atuais
    const finalDataResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as ativas
      FROM avaliacoes_desempenho
    `);

    console.log('\n📊 Resumo das avaliações:');
    console.log(`  - Total: ${finalDataResult.rows[0].total}`);
    console.log(`  - Ativas: ${finalDataResult.rows[0].ativas}`);

    console.log('\n🚀 Correção da avaliacoes_desempenho concluída!');

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

fixAvaliacoesDesempenhoFK();