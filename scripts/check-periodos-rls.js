const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkRLSPolicies() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar políticas RLS da tabela periodos_avaliacao
    console.log('\n📋 Verificando políticas RLS da tabela periodos_avaliacao...');
    const policiesResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'periodos_avaliacao'
      ORDER BY policyname;
    `);

    if (policiesResult.rows.length === 0) {
      console.log('⚠️ Nenhuma política RLS encontrada para periodos_avaliacao');
    } else {
      console.log('✅ Políticas RLS encontradas:');
      policiesResult.rows.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.cmd} (roles: ${policy.roles || 'ALL'})`);
      });
    }

    // Verificar se RLS está habilitado
    console.log('\n🔒 Verificando se RLS está habilitado...');
    const rlsResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE tablename = 'periodos_avaliacao';
    `);

    if (rlsResult.rows.length > 0) {
      const rlsEnabled = rlsResult.rows[0].rowsecurity;
      console.log(`✅ RLS está ${rlsEnabled ? 'HABILITADO' : 'DESABILITADO'} na tabela periodos_avaliacao`);
    }

    // Verificar se o usuário ADMIN pode acessar
    console.log('\n👤 Testando acesso para usuários ADMIN...');
    const adminTestResult = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM users_unified
        WHERE role = 'ADMIN'
        AND is_authorized = true
        AND active = true
        LIMIT 1
      ) as has_admin;
    `);

    const hasAdmin = adminTestResult.rows[0].has_admin;
    console.log(`✅ Existem usuários ADMIN ativos: ${hasAdmin ? 'SIM' : 'NÃO'}`);

    // Verificar structure da tabela
    console.log('\n🏗️ Verificando estrutura da tabela periodos_avaliacao...');
    const structureResult = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'periodos_avaliacao'
      ORDER BY ordinal_position;
    `);

    console.log('✅ Estrutura da tabela:');
    structureResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ' ALLOW NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
    });

    // Verificar dados existentes
    console.log('\n📊 Verificando dados existentes...');
    const dataResult = await client.query('SELECT COUNT(*) as count FROM periodos_avaliacao');
    const count = dataResult.rows[0].count;
    console.log(`✅ Total de registros em periodos_avaliacao: ${count}`);

    // Listar períodos
    if (count > 0) {
      const periodosResult = await client.query(`
        SELECT
          id,
          nome,
          data_inicio,
          data_fim,
          ativo,
          created_at
        FROM periodos_avaliacao
        ORDER BY created_at DESC
        LIMIT 5
      `);

      console.log('\n📅 Últimos períodos cadastrados:');
      periodosResult.rows.forEach(p => {
        console.log(`  - ${p.nome} (${p.data_inicio} a ${p.data_fim}) - ${p.ativo ? 'Ativo' : 'Inativo'}`);
      });
    }

    console.log('\n🚀 Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

checkRLSPolicies();