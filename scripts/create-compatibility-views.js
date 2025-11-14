const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createCompatibilityViews() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao Supabase PostgreSQL');

    // Remover views existentes se houver
    console.log('\n🗑️ Removendo views de compatibilidade existentes...');
    try {
      await client.query('DROP VIEW IF EXISTS funcionarios CASCADE;');
      console.log('✅ View funcionarios removida');
    } catch (e) {
      console.log('⚠️ View funcionarios não existe ou erro ao remover');
    }

    // Criar view de compatibilidade para funcionarios
    console.log('\n👁️ Criando view de compatibilidade para funcionarios...');
    await client.query(`
      CREATE OR REPLACE VIEW funcionarios AS
      SELECT
        id,
        first_name as nome,
        position as cargo,
        department as departamento,
        email,
        role,
        is_lider,
        is_authorized,
        active as status
      FROM users_unified;
    `);
    console.log('✅ View funcionarios criada com sucesso');

    // Criar view para avaliacoes_desempenho com relacionamentos
    console.log('\n👁️ Criando view para avaliacoes_desempenho com relacionamentos...');
    await client.query(`
      CREATE OR REPLACE VIEW vw_avaliacoes_desempenho_relacionamentos AS
      SELECT
        a.id,
        a.funcionario_id,
        a.avaliador_id,
        a.periodo_id,
        a.periodo,
        a.status,
        a.pontuacao_total,
        a.observacoes,
        a.created_at,
        a.updated_at,
        a.deleted_at,
        a.comentario_avaliador,
        a.status_aprovacao,
        a.data_autoavaliacao,
        a.data_aprovacao,
        a.aprovado_por,
        a.dados_colaborador,
        a.dados_gerente,
        a.resultado,
        f.first_name as funcionario_nome,
        f.last_name as funcionario_sobrenome,
        f.email as funcionario_email,
        av.first_name as avaliador_nome,
        av.last_name as avaliador_sobrenome,
        av.email as avaliador_email,
        p.nome as periodo_nome,
        p.data_inicio as periodo_data_inicio,
        p.data_fim as periodo_data_fim
      FROM avaliacoes_desempenho a
      LEFT JOIN users_unified f ON a.funcionario_id = f.id
      LEFT JOIN users_unified av ON a.avaliador_id = av.id
      LEFT JOIN periodos_avaliacao p ON a.periodo_id = p.id;
    `);
    console.log('✅ View vw_avaliacoes_desempenho_relacionamentos criada com sucesso');

    // Verificar se os dados estão corretos
    console.log('\n📊 Verificando dados das views...');

    const funcionariosCount = await client.query('SELECT COUNT(*) as count FROM funcionarios');
    console.log(`✅ Total de funcionários na view: ${funcionariosCount.rows[0].count}`);

    const avaliacoesCount = await client.query('SELECT COUNT(*) as count FROM vw_avaliacoes_desempenho_relacionamentos WHERE deleted_at IS NULL');
    console.log(`✅ Total de avaliações ativas na view: ${avaliacoesCount.rows[0].count}`);

    // Mostrar amostra dos dados
    const sampleAvaliacoes = await client.query(`
      SELECT
        id,
        funcionario_nome,
        avaliador_nome,
        periodo_nome,
        status
      FROM vw_avaliacoes_desempenho_relacionamentos
      WHERE deleted_at IS NULL
      LIMIT 3
    `);

    if (sampleAvaliacoes.rows.length > 0) {
      console.log('\n📋 Amostra de avaliações com relacionamentos:');
      sampleAvaliacoes.rows.forEach(av => {
        console.log(`  - ${av.funcionario_nome} avaliado por ${av.avaliador_nome} (${av.periodo_nome}) - ${av.status}`);
      });
    }

    console.log('\n🚀 Views de compatibilidade criadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante criação das views:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada');
  }
}

createCompatibilityViews();