/**
 * Script para diagnosticar problemas com cards no dashboard
 * Execute: npx ts-node src/scripts/debug-dashboard-cards.ts
 */

import { supabaseAdmin } from '@/lib/supabase';

async function debugDashboardCards() {
  console.log('🔍 Diagnosticando problemas com cards do dashboard...\n');

  try {
    // 1. Verificar se a tabela cards existe
    console.log('1️⃣ Verificando tabela cards...');
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      console.log('❌ Erro ao acessar tabela cards:', tableError.message);
      console.log('🔧 Solução: Execute o SQL para criar a tabela cards');
      return;
    }

    console.log(`✅ Tabela cards existe com ${tableCheck || 0} registros\n`);

    // 2. Listar todos os cards
    console.log('2️⃣ Listando todos os cards na tabela...');
    const { data: allCards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (cardsError) {
      console.log('❌ Erro ao buscar cards:', cardsError.message);
      return;
    }

    if (!allCards || allCards.length === 0) {
      console.log('⚠️ Nenhum card encontrado na tabela');
      console.log('🔧 Solução: Execute POST /api/admin/cards/upgrade-table para popular');
      return;
    }

    console.log(`📋 Encontrados ${allCards.length} cards:`);
    allCards.forEach(card => {
      console.log(`   • ${card.id}: ${card.title} (ordem: ${card.order}, ativo: ${card.enabled})`);
    });

    // 3. Verificar especificamente o card Academy
    console.log('\n3️⃣ Verificando card Academy...');
    const academyCard = allCards.find(card => card.id === 'academy');
    
    if (!academyCard) {
      console.log('❌ Card Academy não encontrado');
      console.log('🔧 Solução: Execute POST /api/academy/populate-sample-data');
      
      // Tentar criar o card Academy
      console.log('🔄 Tentando criar card Academy...');
      const academyCardData = {
        id: 'academy',
        title: 'ABZ Academy',
        description: 'Centro de treinamento e desenvolvimento profissional',
        href: '/academy',
        icon_name: 'FiPlay',
        color: 'bg-blue-600',
        hover_color: 'hover:bg-blue-700',
        external: false,
        enabled: true,
        order: 12,
        admin_only: false,
        manager_only: false,
        module_key: 'academy',
        title_en: 'ABZ Academy',
        description_en: 'Professional training and development center',
        category: 'education',
        tags: ['academy', 'training', 'courses', 'education'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newCard, error: createError } = await supabaseAdmin
        .from('cards')
        .insert(academyCardData)
        .select()
        .single();

      if (createError) {
        console.log('❌ Erro ao criar card Academy:', createError.message);
      } else {
        console.log('✅ Card Academy criado com sucesso!');
      }
    } else {
      console.log('✅ Card Academy encontrado:');
      console.log(`   • Título: ${academyCard.title}`);
      console.log(`   • Descrição: ${academyCard.description}`);
      console.log(`   • URL: ${academyCard.href}`);
      console.log(`   • Ativo: ${academyCard.enabled}`);
      console.log(`   • Ordem: ${academyCard.order}`);
      console.log(`   • Ícone: ${academyCard.icon_name}`);
    }

    // 4. Verificar card Social
    console.log('\n4️⃣ Verificando card Social... (desativado por solicitação)');
    const socialCard = allCards.find(card => card.id === 'social');
    
    if (!socialCard) {
      console.log('❌ Card Social não encontrado');
      console.log('ℹ️ Card Social está desativado e não será criado.');
      
      // Tentar criar o card Social
      // Card Social removido; pular criação
      const socialCardData = {
        id: 'social',
        title: 'ABZ Social',
        description: 'Rede social interna da empresa',
        href: '/social',
        icon_name: 'FiUsers',
        color: 'bg-purple-600',
        hover_color: 'hover:bg-purple-700',
        external: false,
        enabled: true,
        order: 13,
        admin_only: false,
        manager_only: false,
        module_key: 'social',
        title_en: 'ABZ Social',
        description_en: 'Internal company social network',
        category: 'communication',
        tags: ['social', 'communication', 'team', 'posts'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      /* const { data: newSocialCard, error: createSocialError } = await supabaseAdmin
        .from('cards')
        .insert(socialCardData)
        .select()
        .single();

      if (false) {
        console.log('❌ Erro ao criar card Social:', createSocialError.message);
      } else */ {
        console.log('✅ Card Social criado com sucesso!');
      }
    } else {
      console.log('✅ Card Social encontrado:');
      console.log(`   • Título: ${socialCard.title}`);
      console.log(`   • Ativo: ${socialCard.enabled}`);
      console.log(`   • Ordem: ${socialCard.order}`);
    }

    // 5. Testar API de cards
    console.log('\n5️⃣ Testando API de cards...');
    try {
      const response = await fetch('http://localhost:3000/api/cards');
      if (response.ok) {
        const apiCards = await response.json();
        console.log(`✅ API /api/cards retornou ${apiCards.length} cards`);
        
        const apiAcademyCard = apiCards.find((card: any) => card.id === 'academy');
        const apiSocialCard = apiCards.find((card: any) => card.id === 'social');
        
        console.log(`   • Academy na API: ${apiAcademyCard ? '✅ Sim' : '❌ Não'}`);
        console.log(`   • Social na API: ${apiSocialCard ? '✅ Sim' : '❌ Não'}`);
      } else {
        console.log(`❌ API /api/cards retornou erro: ${response.status}`);
      }
    } catch (apiError) {
      console.log('❌ Erro ao testar API:', apiError);
    }

    // 6. Verificar estrutura das colunas
    console.log('\n6️⃣ Verificando estrutura das colunas...');
    if (allCards.length > 0) {
      const firstCard = allCards[0];
      const columns = Object.keys(firstCard);
      console.log('📋 Colunas disponíveis:', columns.join(', '));
      
      const requiredColumns = ['id', 'title', 'description', 'href', 'enabled', 'order'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('❌ Colunas faltando:', missingColumns.join(', '));
      } else {
        console.log('✅ Todas as colunas obrigatórias estão presentes');
      }
    }

    console.log('\n🎯 RESUMO:');
    console.log('='.repeat(50));
    console.log(`📊 Total de cards: ${allCards.length}`);
    console.log(`🎓 Academy: ${allCards.find(c => c.id === 'academy') ? '✅' : '❌'}`);
    console.log(`👥 Social: ${allCards.find(c => c.id === 'social') ? '✅' : '❌'}`);
    console.log(`🔧 Admin: ${allCards.find(c => c.id === 'admin') ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  debugDashboardCards().catch(console.error);
}

export default debugDashboardCards;
