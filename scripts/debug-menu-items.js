/**
 * Script para debugar itens do menu
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMenuItems() {
  console.log('🔍 Verificando itens do menu...\n');

  try {
    // Verificar se a tabela existe
    const { data: tables, error: tablesError } = await supabase
      .from('menu_items')
      .select('*')
      .limit(1);

    if (tablesError) {
      console.error('❌ Erro ao acessar tabela menu_items:', tablesError.message);
      console.log('\n📝 A tabela menu_items pode não existir. Criando...\n');
      
      // Tentar criar a tabela
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            href TEXT NOT NULL,
            label TEXT NOT NULL,
            title_pt TEXT,
            title_en TEXT,
            icon TEXT NOT NULL,
            external BOOLEAN DEFAULT false,
            enabled BOOLEAN DEFAULT true,
            "order" INTEGER NOT NULL,
            admin_only BOOLEAN DEFAULT false,
            manager_only BOOLEAN DEFAULT false,
            allowed_roles TEXT[],
            allowed_user_ids TEXT[],
            module_key TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (createError) {
        console.error('❌ Erro ao criar tabela:', createError.message);
        return;
      }

      console.log('✅ Tabela menu_items criada com sucesso!\n');
    }

    // Buscar todos os itens
    const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar itens:', error.message);
      return;
    }

    console.log(`📊 Total de itens no banco: ${menuItems?.length || 0}\n`);

    if (!menuItems || menuItems.length === 0) {
      console.log('⚠️ Nenhum item encontrado. Populando com dados padrão...\n');
      
      const defaultItems = [
        {
          id: 'dashboard',
          href: '/dashboard',
          label: 'Dashboard',
          title_pt: 'Dashboard',
          title_en: 'Dashboard',
          icon: 'FiGrid',
          external: false,
          enabled: true,
          order: 1,
          admin_only: false
        },
        {
          id: 'manual',
          href: '/manual',
          label: 'Manual Logístico',
          title_pt: 'Manual Logístico',
          title_en: 'Logistics Manual',
          icon: 'FiBookOpen',
          external: false,
          enabled: true,
          order: 2,
          admin_only: false
        },
        {
          id: 'procedimentos-logistica',
          href: '/procedimentos-logistica',
          label: 'Procedimentos Logística',
          title_pt: 'Procedimentos Logística',
          title_en: 'Logistics Procedures',
          icon: 'FiClipboard',
          external: false,
          enabled: true,
          order: 3,
          admin_only: false
        },
        {
          id: 'politicas',
          href: '/politicas',
          label: 'Políticas',
          title_pt: 'Políticas',
          title_en: 'Policies',
          icon: 'FiFileText',
          external: false,
          enabled: true,
          order: 4,
          admin_only: false
        },
        {
          id: 'calendario',
          href: '/calendario',
          label: 'Calendário',
          title_pt: 'Calendário',
          title_en: 'Calendar',
          icon: 'FiCalendar',
          external: false,
          enabled: true,
          order: 5,
          admin_only: false
        },
        {
          id: 'noticias',
          href: '/noticias',
          label: 'Notícias',
          title_pt: 'Notícias',
          title_en: 'News',
          icon: 'FiRss',
          external: false,
          enabled: true,
          order: 6,
          admin_only: false
        },
        {
          id: 'reembolso',
          href: '/reembolso',
          label: 'Reembolso',
          title_pt: 'Reembolso',
          title_en: 'Reimbursement',
          icon: 'FiDollarSign',
          external: false,
          enabled: true,
          order: 7,
          admin_only: false
        },
        {
          id: 'contracheque',
          href: '/contracheque',
          label: 'Contracheque',
          title_pt: 'Contracheque',
          title_en: 'Payslip',
          icon: 'FiFileText',
          external: false,
          enabled: true,
          order: 8,
          admin_only: false
        },
        {
          id: 'ponto',
          href: '/ponto',
          label: 'Ponto',
          title_pt: 'Ponto',
          title_en: 'Timesheet',
          icon: 'FiClock',
          external: false,
          enabled: true,
          order: 9,
          admin_only: false
        },
        {
          id: 'avaliacao',
          href: '/avaliacao',
          label: 'Avaliação',
          title_pt: 'Avaliação',
          title_en: 'Evaluation',
          icon: 'FiBarChart2',
          external: false,
          enabled: true,
          order: 10,
          admin_only: false,
          manager_only: true
        },
        {
          id: 'academy',
          href: '/academy',
          label: 'ABZ Academy',
          title_pt: 'ABZ Academy',
          title_en: 'ABZ Academy',
          icon: 'FiBook',
          external: false,
          enabled: true,
          order: 11,
          admin_only: false
        },
        {
          id: 'admin',
          href: '/admin',
          label: 'Administração',
          title_pt: 'Administração',
          title_en: 'Administration',
          icon: 'FiSettings',
          external: false,
          enabled: true,
          order: 12,
          admin_only: true
        }
      ];

      const { data: inserted, error: insertError } = await supabase
        .from('menu_items')
        .insert(defaultItems)
        .select();

      if (insertError) {
        console.error('❌ Erro ao inserir itens:', insertError.message);
        return;
      }

      console.log(`✅ ${inserted.length} itens inseridos com sucesso!\n`);
      
      // Buscar novamente para mostrar
      const { data: newItems } = await supabase
        .from('menu_items')
        .select('*')
        .order('order', { ascending: true });

      console.log('📋 Itens do menu:');
      newItems?.forEach(item => {
        console.log(`  ${item.order}. ${item.label} (${item.href}) - ${item.enabled ? '✅' : '❌'}`);
      });
    } else {
      console.log('📋 Itens do menu:');
      menuItems.forEach(item => {
        console.log(`  ${item.order}. ${item.label} (${item.href}) - ${item.enabled ? '✅' : '❌'}`);
      });
    }

    console.log('\n✅ Debug concluído!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugMenuItems();

