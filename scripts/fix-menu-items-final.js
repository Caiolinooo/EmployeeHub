const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixMenuItemsFinal() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar estrutura da tabela menu_items
    console.log('\n📋 Verificando estrutura da tabela menu_items...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'menu_items'
      ORDER BY ordinal_position;
    `);

    console.log('Colunas encontradas:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Verificar se existe a coluna 'order'
    const hasOrderColumn = columnsResult.rows.some(col => col.column_name === 'order');
    if (!hasOrderColumn) {
      console.log('\n🔧 Adicionando coluna order...');
      await client.query(`
        ALTER TABLE menu_items
        ADD COLUMN "order" INTEGER DEFAULT 0;
      `);
      console.log('✅ Coluna order adicionada');
    }

    // Atualizar valores na coluna order baseado no order_index
    await client.query(`
      UPDATE menu_items
      SET "order" = order_index
      WHERE "order" IS NULL AND order_index IS NOT NULL;
    `);
    console.log('✅ Valores da coluna order atualizados');

    // Verificar dados atuais
    const dataResult = await client.query(`
      SELECT id, title, enabled, "order", order_index
      FROM menu_items
      ORDER BY COALESCE("order", order_index, 0);
    `);

    console.log('\n📊 Itens de menu atuais:');
    dataResult.rows.forEach(item => {
      console.log(`  - ${item.title} (enabled: ${item.enabled}, order: ${item.order || item.order_index})`);
    });

    // Criar política RLS se não existir
    console.log('\n📜 Verificando políticas RLS...');
    await client.query(`
      CREATE POLICY IF NOT EXISTS "Menu público" ON menu_items
      FOR SELECT USING (enabled = true);
    `);
    console.log('✅ Política RLS verificada/criada');

    console.log('\n🚀 Correção do menu_items concluída!');

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

fixMenuItemsFinal();