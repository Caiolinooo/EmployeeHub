/**
 * Script para verificar se a tabela notifications existe e tem a estrutura correta
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyNotificationsTable() {
  console.log('\n🔍 Verificando tabela notifications...\n');

  try {
    // Tentar buscar da tabela notifications
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Tabela notifications NÃO existe');
        console.log('\n📋 Estrutura necessária:');
        console.log(`
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  push_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  action_url TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
        `);
        return false;
      } else {
        console.error('❌ Erro ao acessar tabela:', error.message);
        return false;
      }
    }

    console.log('✅ Tabela notifications existe');

    // Verificar estrutura dos campos
    if (data && data.length > 0) {
      const campos = Object.keys(data[0]);
      console.log('\n📊 Campos encontrados:', campos.join(', '));
    }

    // Contar notificações existentes
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📈 Total de notificações no sistema: ${count || 0}`);
    }

    // Contar por tipo
    const { data: typeCount, error: typeError } = await supabase
      .from('notifications')
      .select('type')
      .limit(100);

    if (!typeError && typeCount) {
      const tipos = typeCount.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📋 Notificações por tipo:');
      Object.entries(tipos).forEach(([tipo, qtd]) => {
        console.log(`   - ${tipo}: ${qtd}`);
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error);
    return false;
  }
}

// Executar verificação
verifyNotificationsTable()
  .then(success => {
    if (success) {
      console.log('\n✅ Verificação concluída com sucesso\n');
    } else {
      console.log('\n⚠️  Ação necessária: Criar tabela notifications\n');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
