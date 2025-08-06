/**
 * Script para ativar o bypass de aprovação de usuários
 * Este script configura o sistema para aprovar usuários automaticamente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  console.log('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY estão definidas em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function enableUserBypass() {
  try {
    console.log('🔧 Configurando bypass de aprovação de usuários...\n');

    // Verificar se a configuração já existe
    const { data: existingConfig, error: checkError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'user_approval_settings')
      .single();

    const bypassSettings = {
      bypassApproval: true,
      autoActivateOnEmailVerification: true
    };

    let result;

    if (existingConfig) {
      console.log('📝 Atualizando configuração existente...');
      
      // Atualizar configuração existente
      const { data, error: updateError } = await supabase
        .from('settings')
        .update({
          value: bypassSettings,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'user_approval_settings')
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      result = data;
    } else {
      console.log('➕ Criando nova configuração...');
      
      // Criar nova configuração
      const { data, error: insertError } = await supabase
        .from('settings')
        .insert({
          key: 'user_approval_settings',
          value: bypassSettings,
          description: 'Configurações de aprovação de usuários - Bypass ativado automaticamente'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      result = data;
    }

    console.log('✅ Bypass de aprovação configurado com sucesso!\n');
    console.log('📋 Configurações aplicadas:');
    console.log('   • Bypass de Aprovação Manual: ✅ ATIVADO');
    console.log('   • Ativação Automática após Verificação: ✅ ATIVADO\n');
    
    console.log('🎯 Resultado:');
    console.log('   • Novos usuários serão aprovados automaticamente');
    console.log('   • Não será necessária aprovação manual do administrador');
    console.log('   • Usuários não receberão emails de "aguardando aprovação"\n');
    
    console.log('⚙️  Para alterar essas configurações:');
    console.log('   1. Acesse o painel admin: /admin');
    console.log('   2. Clique em "Configurações de Aprovação"');
    console.log('   3. Ajuste as configurações conforme necessário\n');

    return result;

  } catch (error) {
    console.error('❌ Erro ao configurar bypass de aprovação:', error);
    
    if (error.message.includes('relation "settings" does not exist')) {
      console.log('\n💡 A tabela "settings" não existe. Criando...');
      
      try {
        // Tentar criar a tabela settings
        const { error: createTableError } = await supabase.rpc('create_settings_table');
        
        if (createTableError) {
          console.log('\n📝 Execute este SQL no Supabase para criar a tabela settings:');
          console.log(`
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração de bypass
INSERT INTO settings (key, value, description) 
VALUES (
  'user_approval_settings',
  '{"bypassApproval": true, "autoActivateOnEmailVerification": true}',
  'Configurações de aprovação de usuários - Bypass ativado'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
          `);
        }
      } catch (createError) {
        console.error('Erro ao criar tabela:', createError);
      }
    }
    
    process.exit(1);
  }
}

// Executar o script
if (require.main === module) {
  enableUserBypass()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { enableUserBypass };
