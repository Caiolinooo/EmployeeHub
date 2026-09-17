/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- script legado CommonJS executado direto pelo node */
// scripts/fix-avaliacoes-set-gerente.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não carregadas.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_KEY / SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fixAvaliacoes() {
  try {
    console.log('🔍 Buscando mapeamentos de gerente/colaborador...');
    const { data: mappings, error: mapError } = await supabase
      .from('avaliacao_colaborador_gerente')
      .select('id, colaborador_id, gerente_id, periodo_id');

    if (mapError) throw mapError;
    if (!mappings || mappings.length === 0) {
      console.log('⚠️ Nenhum mapeamento encontrado em avaliacao_colaborador_gerente.');
      return;
    }

    console.log(`✅ ${mappings.length} mapeamentos encontrados.`);

    let updated = 0;

    for (const m of mappings) {
      const filtro = {
        funcionario_id: m.colaborador_id,
      };

      if (m.periodo_id) {
        filtro.periodo_id = m.periodo_id;
      }

      console.log(
        `➡️ Ajustando avaliações do colaborador ${m.colaborador_id} para gerente ${m.gerente_id}...`
      );

      const { data, error } = await supabase
        .from('avaliacoes_desempenho')
        .update({ avaliador_id: m.gerente_id })
        .match({ ...filtro, avaliador_id: null });

      if (error) {
        console.error('  ❌ Erro ao atualizar avaliações:', error.message);
      } else {
        const count = data ? data.length : 0;
        console.log(`  ✓ ${count} avaliação(ões) atualizada(s).`);
        updated += count;
      }
    }

    console.log(`\n🎯 Total atualizado: ${updated} avaliação(ões).`);
  } catch (err) {
    console.error('❌ Erro geral ao ajustar avaliações:', err);
  }
}

fixAvaliacoes();