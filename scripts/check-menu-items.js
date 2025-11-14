const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkMenuItems() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar se a tabela menu_items existe
    console.log('\n📋 Verificando tabela menu_items...');
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'menu_items'
      );
    `);

    const tableExists = tableResult.rows[0].exists;
    console.log(`✅ Tabela menu_items existe: ${tableExists ? 'SIM' : 'NÃO'}`);

    if (!tableExists) {
      console.log('❌ Tabela menu_items não existe! Criando...');

      // Criar tabela menu_items
      await client.query(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(200) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          path VARCHAR(500),
          category VARCHAR(100) DEFAULT 'general',
          order_index INTEGER DEFAULT 0,
          enabled BOOLEAN DEFAULT true,
          target VARCHAR(20) DEFAULT '_self',
          parent_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ Tabela menu_items criada');

      // Habilitar RLS
      await client.query('ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;');

      // Criar política para permitir leitura pública
      await client.query(`
        CREATE POLICY "Menu público" ON menu_items
        FOR SELECT USING (enabled = true);
      `);
      console.log('✅ Políticas RLS criadas');

      // Inserir itens de menu padrão
      await client.query(`
        INSERT INTO menu_items (title, description, icon, path, category, order_index) VALUES
        ('Dashboard', 'Página principal do sistema', 'FiHome', '/', 'dashboard', 1),
        ('Avaliações', 'Sistema de avaliações de desempenho', 'FiClipboard', '/avaliacao', 'avaliacao', 2),
        ('Usuários', 'Gerenciamento de usuários', 'FiUsers', '/admin/users', 'admin', 3),
        ('Relatórios', 'Relatórios do sistema', 'FiFileText', '/relatorios', 'relatorios', 4),
        ('Configurações', 'Configurações do sistema', 'FiSettings', '/admin/settings', 'admin', 5)
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Itens de menu padrão inseridos');
    }

    // Verificar itens na tabela
    const itemsResult = await client.query(`
      SELECT id, title, path, category, enabled, order_index
      FROM menu_items
      WHERE enabled = true
      ORDER BY category, order_index;
    `);

    console.log(`✅ Total de itens de menu ativos: ${itemsResult.rows.length}`);
    itemsResult.rows.forEach(item => {
      console.log(`  - ${item.title} (${item.path}) - ${item.category}`);
    });

    // Testar a consulta que a API faz
    console.log('\n🧪 Testando consulta da API...');
    const testResult = await client.query(`
      SELECT * FROM menu_items
      WHERE enabled = true
      ORDER BY order_index ASC
    `);

    console.log(`✅ API test: ${testResult.rows.length} itens encontrados`);

    console.log('\n🚀 Verificação de menu_items concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

checkMenuItems();