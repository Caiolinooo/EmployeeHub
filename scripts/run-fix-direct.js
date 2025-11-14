/**
 * Script para executar SQL diretamente via API Supabase
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runDirectFix() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    console.log('🔧 Executando correções diretas no banco...');

    // SQL para adicionar coluna deleted_at
    const sql1 = 'ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;';

    // Executar SQL 1
    console.log('\n1️⃣ Adicionando deleted_at à users_unified...');
    try {
      const response = await fetch(\`\${supabaseUrl}/rest/v1/\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${supabaseServiceKey}\`,
          'apikey': supabaseServiceKey,
          'Accept': 'application/vnd.pgrst.object+json'
        },
        body: JSON.stringify({
          query: sql1
        })
      });

      console.log('Status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.text();
        console.log('✅ Resposta:', result || 'Comando executado');
      } else {
        const error = await response.text();
        console.log('❌ Erro:', error);
      }
    } catch (error) {
      console.log('❌ Erro na requisição:', error.message);
    }

    // Verificação final
    console.log('\n🔍 Verificação final...');

    // Criar cliente Supabase para verificação
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('id, deleted_at')
        .limit(1);

      if (userError) {
        console.log('❌ Erro ao verificar users_unified:', userError.message);
      } else {
        if (userData && userData.length > 0) {
          const hasDeletedAt = userData[0].hasOwnProperty('deleted_at');
          console.log(\`✅ users_unified.deleted_at: \${hasDeletedAt ? 'Presente' : 'Ausente'}\`);
        } else {
          console.log('ℹ️  Nenhum usuário encontrado para verificação');
        }
      }
    } catch (e) {
      console.log('❌ Erro na verificação final:', e.message);
    }

    console.log('\n🎉 Processo concluído!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

runDirectFix();
