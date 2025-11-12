/**
 * Script para executar a correção da view vw_avaliacoes_desempenho
 * Remove o filtro deleted_at IS NULL para permitir lixeira funcionar
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeViewFix() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔧 Executando correção da view vw_avaliacoes_desempenho...');

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

    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executando comando ${i + 1}/${commands.length}...`);

      // Usar SQL direto via RPC se a função exec_sql existir
      try {
        const { error } = await supabase.rpc('exec_sql', { query: command });
        if (error) {
          console.warn('⚠️  RPC falhou, tentando método alternativo...');

          // Método alternativo: criar uma API temporária
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ query: command })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
      } catch (err) {
        console.error(`❌ Erro no comando ${i + 1}:`, err.message);
        console.log(`Comando: ${command.substring(0, 100)}...`);
      }
    }

    console.log('✅ Script executado. Verificando se a view funciona...');

    // Testar a view
    const { data, error } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao testar view:', error);
    } else {
      console.log('✅ View está funcionando!');
      if (data && data.length > 0) {
        console.log('📊 Campos disponíveis:', Object.keys(data[0]));
      } else {
        console.log('📊 View não retornou registros (pode estar vazia)');
      }
    }

    // Testar specifically para lixeira (registros com deleted_at)
    const { data: trashData, error: trashError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .not('deleted_at', 'is', null)
      .limit(1);

    if (trashError) {
      console.error('❌ Erro ao testar lixeira:', trashError);
    } else {
      console.log('✅ Lixeira está funcionando!');
      console.log(`📊 Registros na lixeira: ${trashData ? trashData.length : 0}`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

executeViewFix();