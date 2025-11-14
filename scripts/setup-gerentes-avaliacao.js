const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function setupGerentesAvaliacao() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // 1. Criar tabela ciclos_avaliacao (se não existir)
    console.log('\n📅 Verificando/criando tabela ciclos_avaliacao...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ciclos_avaliacao (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ano INTEGER NOT NULL,
          nome VARCHAR(200) NOT NULL,
          descricao TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aberto', 'encerrado')),
          data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
          data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT ciclos_avaliacao_ano_unique UNIQUE (ano)
      );
    `);
    await client.query('ALTER TABLE ciclos_avaliacao ENABLE ROW LEVEL SECURITY');
    console.log('✅ Tabela ciclos_avaliacao criada');

    // 2. Criar tabela de gerentes de avaliação
    console.log('\n📋 Criando tabela gerentes_avaliacao_config...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS gerentes_avaliacao_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
          ativo BOOLEAN DEFAULT TRUE,
          criado_por UUID REFERENCES users_unified(id) ON DELETE SET NULL,
          criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          atualizado_por UUID REFERENCES users_unified(id) ON DELETE SET NULL,
          atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT gerentes_avaliacao_config_usuario_unique UNIQUE (usuario_id)
      );
    `);
    console.log('✅ Tabela gerentes_avaliacao_config criada');

    // 2. Habilitar RLS
    console.log('\n🔒 Habilitando RLS...');
    await client.query('ALTER TABLE gerentes_avaliacao_config ENABLE ROW LEVEL SECURITY');

    // 3. Criar políticas RLS (com verificação prévia)
    console.log('📜 Criando políticas RLS...');
    try {
      await client.query(`
        DROP POLICY IF EXISTS "Visualizar gerentes ativos" ON gerentes_avaliacao_config;
      `);
      await client.query(`
        CREATE POLICY "Visualizar gerentes ativos" ON gerentes_avaliacao_config
        FOR SELECT USING (ativo = true);
      `);
    } catch (e) {
      console.log('⚠️ Política Visualizar gerentes já existe ou erro:', e.message);
    }

    try {
      await client.query(`
        DROP POLICY IF EXISTS "Admins gerenciam gerentes" ON gerentes_avaliacao_config;
      `);
      await client.query(`
        CREATE POLICY "Admins gerenciam gerentes" ON gerentes_avaliacao_config
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

    // 4. Criar índices
    console.log('🔍 Criando índices...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_gerentes_avaliacao_usuario ON gerentes_avaliacao_config(usuario_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_gerentes_avaliacao_ativo ON gerentes_avaliacao_config(ativo)');

    // 5. Criar função toggle_gerente_avaliacao
    console.log('⚙️ Criando função toggle_gerente_avaliacao...');
    await client.query(`
      CREATE OR REPLACE FUNCTION toggle_gerente_avaliacao(
          usuario_id_param UUID,
          ativo_param BOOLEAN DEFAULT TRUE,
          usuario_operacao UUID DEFAULT auth.uid()
      )
      RETURNS JSON AS $$
      DECLARE
          usuario_existe BOOLEAN;
          config_existe BOOLEAN;
          result JSON;
      BEGIN
          -- Verificar se o usuário existe
          SELECT EXISTS(
              SELECT 1 FROM users_unified
              WHERE id = usuario_id_param
              AND is_authorized = true
              AND active = true
          ) INTO usuario_existe;

          IF NOT usuario_existe THEN
            result := json_build_object('sucesso', false, 'mensagem', 'Usuário não encontrado ou inativo');
            RETURN result;
          END IF;

          -- Verificar se já existe configuração
          SELECT EXISTS(
              SELECT 1 FROM gerentes_avaliacao_config
              WHERE usuario_id = usuario_id_param
          ) INTO config_existe;

          IF config_existe THEN
              -- Atualizar
              UPDATE gerentes_avaliacao_config
              SET ativo = ativo_param,
                  atualizado_por = usuario_operacao
              WHERE usuario_id = usuario_id_param;

              IF ativo_param THEN
                result := json_build_object('sucesso', true, 'mensagem', 'Usuário configurado como gerente de avaliação');
              ELSE
                result := json_build_object('sucesso', true, 'mensagem', 'Usuário removido como gerente de avaliação');
              END IF;
          ELSE
              -- Criar nova
              INSERT INTO gerentes_avaliacao_config (
                  usuario_id, ativo, criado_por, atualizado_por
              ) VALUES (
                  usuario_id_param, ativo_param, usuario_operacao, usuario_operacao
              );

              result := json_build_object('sucesso', true, 'mensagem', 'Usuário adicionado como gerente de avaliação');
          END IF;

          RETURN result;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // 6. Criar view vw_gerentes_avaliacao_ativos
    console.log('👁️ Criando view vw_gerentes_avaliacao_ativos...');
    await client.query(`
      CREATE OR REPLACE VIEW vw_gerentes_avaliacao_ativos AS
      SELECT
          g.id as config_id,
          u.id as usuario_id,
          u.first_name,
          u.last_name,
          u.email,
          u.position,
          u.department,
          u.role as sistema_role,
          g.ativo,
          g.criado_em,
          (u.first_name || ' ' || u.last_name) as nome_completo
      FROM gerentes_avaliacao_config g
      JOIN users_unified u ON g.usuario_id = u.id
      WHERE g.ativo = true
      ORDER BY u.first_name, u.last_name;
    `);

    // 7. Verificar/Criar ciclo de avaliação 2025
    console.log('🔄 Verificando ciclo de avaliação 2025...');
    const cicloCheck = await client.query('SELECT * FROM ciclos_avaliacao WHERE ano = 2025');

    if (cicloCheck.rows.length === 0) {
      console.log('📅 Criando ciclo de avaliação 2025...');
      await client.query(`
        INSERT INTO ciclos_avaliacao (ano, nome, status, data_inicio, data_fim)
        VALUES (
          2025,
          'Ciclo de Avaliação 2025',
          'aberto',
          '2025-01-01'::date,
          '2025-12-31'::date
        )
        ON CONFLICT (ano) DO NOTHING
      `);
      console.log('✅ Ciclo 2025 criado');
    } else {
      console.log('✅ Ciclo 2025 já existe');
    }

    // 8. Adicionar alguns gerentes padrão (admins e managers)
    console.log('👥 Configurando gerentes padrão...');
    const usuariosQuery = await client.query(`
      SELECT id, first_name, last_name, role
      FROM users_unified
      WHERE is_authorized = true
      AND active = true
      AND role IN ('ADMIN', 'MANAGER')
    `);

    for (const usuario of usuariosQuery.rows) {
      const result = await client.query('SELECT toggle_gerente_avaliacao($1, true)', [usuario.id]);
      const gerenteResult = result.rows[0].toggle_gerente_avaliacao;
      console.log(`✅ ${usuario.first_name} ${usuario.last_name} (${usuario.role}) adicionado como gerente`);
    }

    // 9. Verificação final
    console.log('\n🔍 Verificação final...');
    const tablesCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'gerentes_avaliacao_config'
    `);

    const gerentesCheck = await client.query('SELECT COUNT(*) as count FROM vw_gerentes_avaliacao_ativos');
    const ciclosCheck = await client.query("SELECT COUNT(*) as count FROM ciclos_avaliacao WHERE status = 'aberto'");

    console.log('\n🎉 RESULTADO FINAL:');
    console.log(`✅ Tabela gerentes_avaliacao_config: ${tablesCheck.rows.length > 0 ? 'OK' : 'FALHOU'}`);
    console.log(`✅ Gerentes de avaliação ativos: ${gerentesCheck.rows[0].count}`);
    console.log(`✅ Ciclos abertos: ${ciclosCheck.rows[0].count}`);
    console.log('\n🚀 Sistema de avaliação configurado com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

setupGerentesAvaliacao().catch(console.error);