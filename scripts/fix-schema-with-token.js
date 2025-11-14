/**
 * Script para executar correções de schema usando API com token
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getAdminToken() {
  try {
    console.log('🔑 Obtendo token de admin...');

    // Fazer login como admin para obter token
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        email: 'admin@abz.com.br', // Email de admin padrão
        password: 'admin123' // Senha admin padrão - pode precisar ajustar
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token obtido com sucesso');
      return data.access_token;
    } else {
      const error = await response.text();
      console.log('❌ Erro ao obter token:', error);
      return null;
    }
  } catch (error) {
    console.log('❌ Erro na autenticação:', error.message);
    return null;
  }
}

async function fixSchemaWithToken() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    console.log('🔧 Executando correções de schema via API...');

    // Obter token de admin
    const adminToken = await getAdminToken();

    if (!adminToken) {
      console.log('❌ Não foi possível obter token de admin');
      console.log('\n💡 Alternativa: Tentando usar service key diretamente...');

      // Tentar usar service key como "token"
      const response = await fetch(`${supabaseUrl}/api/admin/fix-avaliacao-schema`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        }
      });

      console.log('Status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Resposta da API:', JSON.stringify(result, null, 2));
      } else {
        const error = await response.text();
        console.log('❌ Erro da API:', error);
      }

      return;
    }

    // Usar token obtido
    const response = await fetch(`${supabaseUrl}/api/admin/fix-avaliacao-schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'apikey': supabaseServiceKey
      }
    });

    console.log('Status:', response.status, response.statusText);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Resposta da API:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Erro da API:', error);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

fixSchemaWithToken();