#!/usr/bin/env node

/**
 * Script para testar configuração de Push Notifications
 * Verifica se as chaves VAPID estão configuradas corretamente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPushConfiguration() {
  console.log('🔄 Testando configuração de Push Notifications...\n');

  try {
    // 1. Verificar se a tabela app_secrets existe
    const { data: tables, error: tableError } = await supabase
      .from('app_secrets')
      .select('key')
      .limit(1);

    if (tableError) {
      console.error('❌ Tabela app_secrets não encontrada:', tableError.message);
      console.log('💡 Execute o script setup-vapid-keys.sql primeiro');
      return;
    }

    // 2. Verificar chaves VAPID
    const { data: vapidKeys, error: vapidError } = await supabase
      .from('app_secrets')
      .select('key, value, description')
      .like('key', 'VAPID_%');

    if (vapidError) {
      console.error('❌ Erro ao buscar chaves VAPID:', vapidError.message);
      return;
    }

    console.log('📋 Chaves VAPID encontradas:');
    const requiredKeys = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
    const foundKeys = vapidKeys.map(k => k.key);

    requiredKeys.forEach(key => {
      const found = foundKeys.includes(key);
      const keyData = vapidKeys.find(k => k.key === key);
      
      if (found) {
        console.log(`✅ ${key}: ${key === 'VAPID_PRIVATE_KEY' ? '***HIDDEN***' : keyData.value.substring(0, 30) + '...'}`);
      } else {
        console.log(`❌ ${key}: NÃO ENCONTRADA`);
      }
    });

    // 3. Verificar tabela push_subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .limit(1);

    if (subError) {
      console.log('\n⚠️ Tabela push_subscriptions não encontrada');
      console.log('💡 Será criada automaticamente quando o primeiro usuário se inscrever');
    } else {
      console.log('\n✅ Tabela push_subscriptions existe');
    }

    // 4. Status final
    const allKeysPresent = requiredKeys.every(key => foundKeys.includes(key));
    
    console.log('\n' + '='.repeat(50));
    if (allKeysPresent) {
      console.log('🎉 Push Notifications CONFIGURADO CORRETAMENTE!');
      console.log('✅ Todas as chaves VAPID estão presentes');
      console.log('✅ Sistema pronto para enviar notificações push');
    } else {
      console.log('❌ Configuração INCOMPLETA');
      console.log('💡 Execute: npm run setup:vapid');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testPushConfiguration();