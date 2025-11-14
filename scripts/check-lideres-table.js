const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkLideresTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar tabelas relacionadas a líderes
    console.log('\n📋 Verificando tabelas relacionadas a líderes...');

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE '%lider%' OR table_name LIKE '%leader%')
      ORDER BY table_name;
    `);

    console.log('Tabelas encontradas:');
    if (tablesResult.rows.length === 0) {
      console.log('  ❌ Nenhuma tabela relacionada a líderes encontrada');
    } else {
      tablesResult.rows.forEach(table => {
        console.log(`  ✅ ${table.table_name}`);
      });
    }

    // Verificar tabela funcionarios
    console.log('\n📋 Verificando tabela funcionarios...');
    const funcionariosResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'funcionarios'
      );
    `);

    const funcionariosExists = funcionariosResult.rows[0].exists;
    console.log(`✅ Tabela funcionarios existe: ${funcionariosExists ? 'SIM' : 'NÃO'}`);

    // Verificar se users_unified tem coluna is_lider
    console.log('\n📋 Verificando coluna is_lider em users_unified...');
    try {
      const columnResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'users_unified'
          AND column_name = 'is_lider'
        );
      `);

      const hasColumn = columnResult.rows[0].exists;
      console.log(`✅ Coluna is_lider em users_unified: ${hasColumn ? 'SIM' : 'NÃO'}`);

      if (!hasColumn) {
        console.log('🔧 Adicionando coluna is_lider à tabela users_unified...');
        await client.query(`
          ALTER TABLE users_unified
          ADD COLUMN is_lider BOOLEAN DEFAULT false;
        `);
        console.log('✅ Coluna is_lider adicionada com sucesso');
      }

      // Listar usuários com status de líder
      const lideresResult = await client.query(`
        SELECT
          id,
          first_name,
          last_name,
          email,
          position,
          department,
          is_lider,
          is_authorized,
          active,
          role
        FROM users_unified
        WHERE is_authorized = true AND active = true
        ORDER BY first_name;
      `);

      console.log(`\n👥 Usuários disponíveis (${lideresResult.rows.length}):`);
      lideresResult.rows.forEach(user => {
        console.log(`  ${user.is_lider ? '👑' : '  '} ${user.first_name} ${user.last_name} - ${user.position || user.role} - ${user.email}`);
      });

      const lideresAtivos = lideresResult.rows.filter(u => u.is_lider);
      console.log(`\n📊 Líderes ativos: ${lideresAtivos.length}`);
      lideresAtivos.forEach(lider => {
        console.log(`  👑 ${lider.first_name} ${lider.last_name} - ${lider.position || lider.role}`);
      });

    } catch (columnError) {
      console.error('❌ Erro ao verificar/criar coluna is_lider:', columnError.message);
    }

    // Criar tabela de líderes se não existir
    if (tablesResult.rows.length === 0) {
      console.log('\n🔧 Criando tabela de líderes...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS lideres (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
          setor_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ativo BOOLEAN DEFAULT true,
          CONSTRAINT lideres_usuario_unique UNIQUE (usuario_id)
        );
      `);
      console.log('✅ Tabela lideres criada');

      // Habilitar RLS
      await client.query('ALTER TABLE lideres ENABLE ROW LEVEL SECURITY;');
      console.log('✅ RLS habilitado');

      // Criar políticas
      await client.query(`
        CREATE POLICY "Líderes visíveis para todos" ON lideres
        FOR SELECT USING (ativo = true);
      `);

      await client.query(`
        CREATE POLICY "Admins gerenciam líderes" ON lideres
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
          )
        );
      `);
      console.log('✅ Políticas RLS criadas');
    }

    console.log('\n🚀 Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

checkLideresTable();