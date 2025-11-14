const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createPeriodosAvaliacao() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Criar tabela periodos_avaliacao para compatibilidade
    console.log('\n📅 Criando tabela periodos_avaliacao para compatibilidade...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS periodos_avaliacao (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome VARCHAR(200) NOT NULL,
          ano INTEGER NOT NULL,
          descricao TEXT,
          data_inicio DATE NOT NULL,
          data_fim DATE NOT NULL,
          data_limite_autoavaliacao DATE,
          data_limite_aprovacao DATE,
          status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ativo BOOLEAN DEFAULT TRUE
      );
    `);
    console.log('✅ Tabela periodos_avaliacao criada');

    // Habilitar RLS
    await client.query('ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY');

    // Criar políticas RLS (sem IF NOT EXISTS)
    try {
      await client.query(`
        DROP POLICY IF EXISTS "Visualizar periodos" ON periodos_avaliacao;
      `);
      await client.query(`
        CREATE POLICY "Visualizar periodos" ON periodos_avaliacao
        FOR SELECT USING (true);
      `);
    } catch (e) {
      console.log('⚠️ Política Visualizar já existe ou erro:', e.message);
    }

    try {
      await client.query(`
        DROP POLICY IF EXISTS "Admins gerenciam periodos" ON periodos_avaliacao;
      `);
      await client.query(`
        CREATE POLICY "Admins gerenciam periodos" ON periodos_avaliacao
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users_unified
                WHERE id = auth.uid()
                AND role = 'ADMIN'
            )
        );
      `);
    } catch (e) {
      console.log('⚠️ Política Admins já existe ou erro:', e.message);
    }

    // Migrar dados da tabela ciclos_avaliacao se existir
    console.log('🔄 Migrando dados de ciclos_avaliacao...');
    const { rows: ciclos } = await client.query('SELECT * FROM ciclos_avaliacao');

    if (ciclos.length > 0) {
      for (const ciclo of ciclos) {
        await client.query(`
          INSERT INTO periodos_avaliacao (
            id, nome, ano, descricao, data_inicio, data_fim, status, ativo, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          ON CONFLICT (id) DO NOTHING
        `, [
          ciclo.id,
          ciclo.nome,
          ciclo.ano,
          ciclo.descricao,
          ciclo.data_inicio,
          ciclo.data_fim,
          ciclo.status === 'aberto' ? 'ativo' : 'encerrado',
          ciclo.status === 'aberto',
          ciclo.created_at,
          ciclo.updated_at
        ]);
      }
      console.log(`✅ ${ciclos.length} ciclos migrados para periodos_avaliacao`);
    }

    // Verificação final
    const { rows: periodos } = await client.query('SELECT COUNT(*) as count FROM periodos_avaliacao');
    console.log(`\n🎉 Total de períodos na tabela: ${periodos[0].count}`);

    // Criar trigger para atualizar timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION atualizar_timestamp_periodo()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_periodo ON periodos_avaliacao;
      CREATE TRIGGER trigger_atualizar_timestamp_periodo
          BEFORE UPDATE ON periodos_avaliacao
          FOR EACH ROW
          EXECUTE FUNCTION atualizar_timestamp_periodo();
    `);

    console.log('✅ Trigger de timestamp criado');
    console.log('\n🚀 Tabela periodos_avaliacao configurada com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

createPeriodosAvaliacao().catch(console.error);