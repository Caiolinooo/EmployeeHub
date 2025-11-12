/**
 * Script para executar a correção da view diretamente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeDirectFix() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    console.log('🔧 Executando correção da view diretamente via HTTP...');

    // Comandos SQL para executar
    const commands = [
      `DROP VIEW IF EXISTS vw_avaliacoes_desempenho`,

      `CREATE VIEW vw_avaliacoes_desempenho AS
SELECT
  ad.id,
  ad.funcionario_id,
  ad.avaliador_id,
  ad.periodo,
  ad.periodo_id,
  ad.data_inicio,
  ad.data_fim,
  ad.status,
  ad.pontuacao_total,
  ad.observacoes,
  ad.comentario_avaliador,
  ad.status_aprovacao,
  ad.data_autoavaliacao,
  ad.data_aprovacao,
  ad.aprovado_por,
  ad.created_at,
  ad.updated_at,
  ad.deleted_at,
  ad.dados_colaborador,
  ad.dados_gerente,
  -- User information fields for employee
  uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
  uu_func.position AS funcionario_cargo,
  uu_func.department AS funcionario_departamento,
  uu_func.email AS funcionario_email,
  -- User information fields for evaluator
  uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
  uu_aval.position AS avaliador_cargo,
  uu_aval.email AS avaliador_email,
  -- Period information
  pa.nome AS periodo_nome,
  pa.data_inicio AS periodo_data_inicio,
  pa.data_fim AS periodo_data_fim
FROM
  avaliacoes_desempenho ad
LEFT JOIN
  users_unified uu_func ON ad.funcionario_id = uu_func.id
LEFT JOIN
  users_unified uu_aval ON ad.avaliador_id = uu_aval.id
LEFT JOIN
  periodos_avaliacao pa ON ad.periodo_id = pa.id`,

      `COMMENT ON VIEW vw_avaliacoes_desempenho IS 'View de avaliações de desempenho com JOINs para tabelas de usuários e períodos. Inclui registros deletados para lixeira funcionar.'`
    ];

    // Tentar executar via HTTP direto (POSTGRESQL DIRECT)
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executando comando ${i + 1}/${commands.length}...`);

      try {
        // Tentar via SQL direto do Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql: command })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Comando ${i + 1} executado com sucesso:`, result);
        } else {
          console.warn(`⚠️  Comando ${i + 1} falhou (${response.status}):`, await response.text());
        }
      } catch (error) {
        console.error(`❌ Erro no comando ${i + 1}:`, error.message);
      }
    }

    console.log('\n🧪 Testando a view após as correções...');

    // Testar a view
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Testar registros ativos
    const { data: activeData, error: activeError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .is('deleted_at', null)
      .limit(1);

    if (activeError) {
      console.error('❌ Erro ao testar registros ativos:', activeError);
    } else {
      console.log('✅ Registros ativos funcionando:', activeData ? activeData.length : 0);
    }

    // Testar registros da lixeira
    const { data: trashData, error: trashError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .not('deleted_at', 'is', null)
      .limit(1);

    if (trashError) {
      console.error('❌ Erro ao testar lixeira:', trashError);
    } else {
      console.log('✅ Lixeira funcionando:', trashData ? trashData.length : 0);
    }

    // Verificar estrutura completa
    const { data: structureData, error: structureError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .limit(1);

    if (structureError) {
      console.error('❌ Erro ao verificar estrutura:', structureError);
    } else {
      console.log('✅ Estrutura da view:');
      if (structureData && structureData.length > 0) {
        console.log('   Campos disponíveis:', Object.keys(structureData[0]));
      } else {
        console.log('   View está vazia (sem registros)');
      }
    }

    console.log('\n🎉 Correção da view concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

executeDirectFix();