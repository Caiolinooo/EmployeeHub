const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixPeriodosRLS() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Remover políticas conflitantes
    console.log('\n🗑️ Removendo políticas RLS conflitantes...');
    const policies = [
      'Admins gerenciam periodos',
      'Apenas admins podem gerenciar períodos',
      'Todos podem ver períodos ativos',
      'Visualizar periodos'
    ];

    for (const policyName of policies) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policyName}" ON periodos_avaliacao;`);
        console.log(`✅ Política "${policyName}" removida`);
      } catch (e) {
        console.log(`⚠️ Política "${policyName}" não existe ou erro: ${e.message}`);
      }
    }

    // Criar função execute_sql se não existir
    console.log('\n⚙️ Verificando função execute_sql...');
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION execute_sql(sql_param TEXT)
        RETURNS VOID
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_param;
        END;
        $$;
      `);
      console.log('✅ Função execute_sql criada/verificada');
    } catch (e) {
      console.log('⚠️ Erro ao criar função execute_sql:', e.message);
    }

    // Criar políticas RLS corretas
    console.log('\n📜 Criando políticas RLS corretas...');

    // Política para admins poderem gerenciar (INSERT, UPDATE, DELETE)
    try {
      await client.query(`
        CREATE POLICY "Admins gerenciam periodos" ON periodos_avaliacao
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
            AND is_authorized = true
            AND active = true
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
            AND is_authorized = true
            AND active = true
          )
        );
      `);
      console.log('✅ Política "Admins gerenciam periodos" criada');
    } catch (e) {
      console.log('⚠️ Erro ao criar política de admins:', e.message);
    }

    // Política para todos poderem visualizar períodos ativos
    try {
      await client.query(`
        CREATE POLICY "Todos visualizam periodos ativos" ON periodos_avaliacao
        FOR SELECT USING (ativo = true);
      `);
      console.log('✅ Política "Todos visualizam periodos ativos" criada');
    } catch (e) {
      console.log('⚠️ Erro ao criar política de visualização:', e.message);
    }

    // Política para admins poderem ver todos os períodos (inclusive inativos)
    try {
      await client.query(`
        CREATE POLICY "Admins visualizam todos periodos" ON periodos_avaliacao
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
            AND is_authorized = true
            AND active = true
          )
        );
      `);
      console.log('✅ Política "Admins visualizam todos periodos" criada');
    } catch (e) {
      console.log('⚠️ Erro ao criar política de visualização para admins:', e.message);
    }

    // Verificar políticas finais
    console.log('\n📋 Verificando políticas finais...');
    const finalPoliciesResult = await client.query(`
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE tablename = 'periodos_avaliacao'
      ORDER BY policyname;
    `);

    console.log('✅ Políticas RLS finais:');
    finalPoliciesResult.rows.forEach(policy => {
      console.log(`  - ${policy.policyname}: ${policy.cmd} (roles: ${policy.roles || 'ALL'})`);
    });

    // Testar acesso como ADMIN (usando auth.uid() simulado)
    console.log('\n🧪 Testando acesso...');

    // Listar administradores para teste
    const adminsResult = await client.query(`
      SELECT id, first_name, last_name, email
      FROM users_unified
      WHERE role = 'ADMIN'
      AND is_authorized = true
      AND active = true
      ORDER BY first_name;
    `);

    console.log(`✅ Encontrados ${adminsResult.rows.length} administradores ativos:`);
    adminsResult.rows.forEach(admin => {
      console.log(`  - ${admin.first_name} ${admin.last_name} (${admin.email})`);
    });

    console.log('\n🚀 Correção de RLS concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

fixPeriodosRLS();