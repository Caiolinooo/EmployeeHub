const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixGerentesAvaliacaoView() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Verificar se a tabela gerentes_avaliacao_config existe
    console.log('\n📋 Verificando tabela gerentes_avaliacao_config...');
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'gerentes_avaliacao_config'
      );
    `);

    const tableExists = tableResult.rows[0].exists;
    console.log(`✅ Tabela gerentes_avaliacao_config existe: ${tableExists ? 'SIM' : 'NÃO'}`);

    if (!tableExists) {
      console.log('❌ Tabela não existe! Executando script de criação...');

      // Criar tabela
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
      console.log('✅ Tabela criada');

      // Habilitar RLS
      await client.query('ALTER TABLE gerentes_avaliacao_config ENABLE ROW LEVEL SECURITY');
      console.log('✅ RLS habilitado');

      // Criar políticas
      await client.query(`
        CREATE POLICY "Visualizar gerentes ativos" ON gerentes_avaliacao_config
        FOR SELECT USING (ativo = true);
      `);

      await client.query(`
        CREATE POLICY "Admins gerenciam gerentes" ON gerentes_avaliacao_config
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users_unified
                WHERE id = auth.uid()
                AND role = 'ADMIN'
                AND is_authorized = true
                AND active = true
            )
        );
      `);
      console.log('✅ Políticas RLS criadas');

      // Criar função toggle_gerente_avaliacao
      await client.query(`
        CREATE OR REPLACE FUNCTION toggle_gerente_avaliacao(
            usuario_id_param UUID,
            ativo_param BOOLEAN DEFAULT TRUE,
            usuario_operacao UUID DEFAULT auth.uid()
        )
        RETURNS TABLE(
            sucesso BOOLEAN,
            mensagem TEXT
        ) AS $$
        DECLARE
            usuario_existe BOOLEAN;
            config_existe BOOLEAN;
        BEGIN
            -- Verificar se o usuário existe e está ativo
            SELECT EXISTS(
                SELECT 1 FROM users_unified
                WHERE id = usuario_id_param
                AND is_authorized = true
                AND active = true
            ) INTO usuario_existe;

            IF NOT usuario_existe THEN
                RETURN NEXT SELECT false, 'Usuário não encontrado ou inativo'::TEXT;
                RETURN;
            END IF;

            -- Verificar se já existe configuração
            SELECT EXISTS(
                SELECT 1 FROM gerentes_avaliacao_config
                WHERE usuario_id = usuario_id_param
            ) INTO config_existe;

            IF config_existe THEN
                -- Atualizar configuração existente
                UPDATE gerentes_avaliacao_config
                SET
                    ativo = ativo_param,
                    atualizado_por = usuario_operacao
                WHERE usuario_id = usuario_id_param;

                IF ativo_param THEN
                    RETURN NEXT SELECT true, 'Usuário configurado como gerente de avaliação'::TEXT;
                ELSE
                    RETURN NEXT SELECT true, 'Usuário removido como gerente de avaliação'::TEXT;
                END IF;
            ELSE
                -- Criar nova configuração
                INSERT INTO gerentes_avaliacao_config (
                    usuario_id,
                    ativo,
                    criado_por,
                    atualizado_por
                ) VALUES (
                    usuario_id_param,
                    ativo_param,
                    usuario_operacao,
                    usuario_operacao
                );

                RETURN NEXT SELECT true, 'Usuário adicionado como gerente de avaliação'::TEXT;
            END IF;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `);
      console.log('✅ Função toggle_gerente_avaliacao criada');
    }

    // Remover view existente se houver
    console.log('\n🗑️ Removendo view existente...');
    try {
      await client.query('DROP VIEW IF EXISTS vw_gerentes_avaliacao_ativos');
      console.log('✅ View vw_gerentes_avaliacao_ativos removida');
    } catch (e) {
      console.log('⚠️ View não existe ou erro ao remover:', e.message);
    }

    // Criar view novamente
    console.log('\n👁️ Criando view vw_gerentes_avaliacao_ativos...');
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
          g.criado_por,
          g.atualizado_em,
          g.atualizado_por,
          -- Campo para facilitar no frontend
          (u.first_name || ' ' || u.last_name) as nome_completo
      FROM gerentes_avaliacao_config g
      JOIN users_unified u ON g.usuario_id = u.id
      WHERE g.ativo = true
      ORDER BY u.first_name, u.last_name;
    `);
    console.log('✅ View vw_gerentes_avaliacao_ativos criada');

    // Verificar dados na view
    console.log('\n📊 Verificando dados na view...');
    const viewDataResult = await client.query('SELECT COUNT(*) as count FROM vw_gerentes_avaliacao_ativos');
    const viewCount = viewDataResult.rows[0].count;
    console.log(`✅ Total de gerentes ativos na view: ${viewCount}`);

    if (viewCount > 0) {
      const viewDetailsResult = await client.query(`
        SELECT usuario_id, nome_completo, email, position
        FROM vw_gerentes_avaliacao_ativos
        ORDER BY nome_completo
      `);

      console.log('📋 Gerentes ativos encontrados:');
      viewDetailsResult.rows.forEach(gerente => {
        console.log(`  - ${gerente.nome_completo} (${gerente.email}) - ${gerente.position || 'Sem cargo'}`);
      });
    }

    // Verificar se a API vai funcionar simulando a consulta
    console.log('\n🧪 Testando consulta que a API faz...');

    try {
      const usuariosResult = await client.query(`
        SELECT id, first_name, last_name, email, position, department, role, is_authorized, active
        FROM users_unified
        WHERE is_authorized = true AND active = true
        ORDER BY first_name ASC
      `);

      const gerentesConfigResult = await client.query(`
        SELECT * FROM vw_gerentes_avaliacao_ativos
      `);

      console.log(`✅ Usuários encontrados: ${usuariosResult.rows.length}`);
      console.log(`✅ Gerentes configurados: ${gerentesConfigResult.rows.length}`);

      // Simular lógica da API
      const gerentesIds = new Set(gerentesConfigResult.rows.map(g => g.usuario_id));
      const usuarios = usuariosResult.rows;
      const gerentesAtuais = usuarios.filter(u => gerentesIds.has(u.id));
      const usuariosDisponiveis = usuarios.filter(u => !gerentesIds.has(u.id));

      console.log('\n📈 Estatísticas finais:');
      console.log(`  - Total usuários: ${usuarios.length}`);
      console.log(`  - Gerentes atuais: ${gerentesAtuais.length}`);
      console.log(`  - Usuários disponíveis: ${usuariosDisponiveis.length}`);

    } catch (testError) {
      console.log('❌ Erro no teste da consulta:', testError.message);
    }

    console.log('\n🚀 Configuração concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

fixGerentesAvaliacaoView();