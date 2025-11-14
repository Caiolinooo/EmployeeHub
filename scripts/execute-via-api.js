/**
 * Script para executar SQL via API Admin
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeViaAPI() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    console.log('🔧 Executando SQL via API...');

    // Criar cliente Supabase para obter token de admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SQL para adicionar coluna deleted_at
    const sql1 = 'ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;';

    // SQL para adicionar colunas à notifications
    const sql2 = `
      DO $$
      BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
              ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
              ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;
              ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "read" BOOLEAN DEFAULT FALSE;
              ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'info';
              ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB NULL;
              RAISE NOTICE 'Colunas adicionadas à tabela notifications';
          ELSE
              RAISE NOTICE 'Tabela notifications não encontrada';
          END IF;
      END $$;
    `;

    console.log('\n1️⃣ Tentando executar SQL direto via RPC...');

    // Tentar executar via função RPC se existir
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: sql1
      });

      if (error) {
        console.log('❌ Erro RPC:', error.message);

        // Tentar via SQL Admin (se tiver função)
        console.log('\n2️⃣ Tentando via sql_admin...');
        const { data: data2, error: error2 } = await supabase.rpc('sql_admin', {
          query: sql1
        });

        if (error2) {
          console.log('❌ Erro sql_admin:', error2.message);
        } else {
          console.log('✅ SQL executado via sql_admin!');
        }
      } else {
        console.log('✅ SQL executado via RPC!');
      }
    } catch (e) {
      console.log('❌ Erro na execução:', e.message);
    }

    // Tentar método alternativo via POST simples
    console.log('\n3️⃣ Tentando método POST alternativo...');
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          sql: sql1
        })
      });

      console.log('Status RPC:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.text();
        console.log('✅ Resposta RPC:', result || 'Sucesso');
      } else {
        const error = await response.text();
        console.log('❌ Erro RPC:', error);
      }
    } catch (e) {
      console.log('❌ Erro RPC:', e.message);
    }

    // Verificação final
    console.log('\n🔍 Verificação final...');

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
          console.log('✅ users_unified.deleted_at: ' + (hasDeletedAt ? 'Presente' : 'Ausente'));
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

executeViaAPI();