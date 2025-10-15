/**
 * Script para correções finais nas tabelas Card e MenuItem
 * 
 * Correções:
 * 1. Adicionar card Dashboard (order: 0)
 * 2. Remover duplicação procedimentos/procedimentos-gerais
 * 3. Corrigir ID do admin (UUID -> string)
 * 4. Reorganizar orders para evitar duplicações
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFinalIssues() {
  console.log('🔧 Iniciando correções finais...\n');

  try {
    // 1. Adicionar Dashboard
    console.log('📊 Adicionando card Dashboard...');
    
    const dashboardCard = {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Visão geral do sistema',
      href: '/dashboard',
      icon: 'dashboard',
      iconName: 'FiGrid',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      external: false,
      enabled: true,
      order: 0,
      adminOnly: false,
      managerOnly: false,
      titleEn: 'Dashboard',
      descriptionEn: 'System overview',
      moduleKey: 'dashboard',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { error: dashError } = await supabase
      .from('Card')
      .upsert(dashboardCard, { onConflict: 'id' });
    
    if (dashError) {
      console.error('❌ Erro ao adicionar Dashboard:', dashError.message);
    } else {
      console.log('✅ Dashboard adicionado\n');
    }

    // 2. Remover duplicação procedimentos
    console.log('🗑️  Removendo duplicação de procedimentos...');
    
    // Manter procedimentos-logistica e procedimentos-gerais, remover "procedimentos"
    const { error: delError } = await supabase
      .from('Card')
      .delete()
      .eq('id', 'procedimentos');
    
    if (delError) {
      console.error('❌ Erro ao deletar procedimentos:', delError.message);
    } else {
      console.log('✅ Duplicação removida\n');
    }

    // 3. Corrigir ID do admin
    console.log('🔧 Corrigindo ID do admin...');
    
    // Buscar o registro com UUID
    const { data: adminData, error: adminFetchError } = await supabase
      .from('Card')
      .select('*')
      .eq('href', '/admin')
      .single();
    
    if (adminFetchError) {
      console.error('❌ Erro ao buscar admin:', adminFetchError.message);
    } else if (adminData) {
      // Deletar o registro antigo
      await supabase.from('Card').delete().eq('id', adminData.id);
      
      // Inserir com ID correto
      const newAdmin = {
        ...adminData,
        id: 'admin',
        updatedAt: new Date().toISOString()
      };
      
      const { error: adminInsertError } = await supabase
        .from('Card')
        .insert(newAdmin);
      
      if (adminInsertError) {
        console.error('❌ Erro ao inserir admin:', adminInsertError.message);
      } else {
        console.log('✅ ID do admin corrigido\n');
      }
    }

    // 4. Reorganizar orders
    console.log('📋 Reorganizando orders...');
    
    const { data: allCards, error: fetchError } = await supabase
      .from('Card')
      .select('*')
      .order('order')
      .order('title');
    
    if (fetchError) throw fetchError;

    // Definir ordem correta
    const correctOrder = [
      'dashboard',
      'manual',
      'folha-pagamento',
      'procedimentos-logistica',
      'procedimentos-gerais',
      'politicas',
      'calendario',
      'noticias',
      'reembolso',
      'contracheque',
      'ponto',
      'avaliacao',
      'avaliacoes-avancadas',
      'academy',
      'dashboard-bi',
      'relatorios-pdf',
      'workflows',
      'chat',
      'api-mobile',
      'integracao-erp',
      'admin'
    ];

    // Atualizar orders
    for (let i = 0; i < correctOrder.length; i++) {
      const cardId = correctOrder[i];
      const card = allCards.find(c => c.id === cardId);
      
      if (card) {
        const { error: updateError } = await supabase
          .from('Card')
          .update({ order: i + 1, updatedAt: new Date().toISOString() })
          .eq('id', cardId);
        
        if (updateError) {
          console.error(`  ❌ Erro ao atualizar ${cardId}:`, updateError.message);
        } else {
          console.log(`  ✅ ${cardId}: order = ${i + 1}`);
        }
      }
    }

    console.log('\n🔄 Sincronizando MenuItem...');
    
    // Buscar dados atualizados
    const { data: finalCards, error: finalError } = await supabase
      .from('Card')
      .select('*')
      .order('order');
    
    if (finalError) throw finalError;

    // Limpar MenuItem
    await supabase
      .from('MenuItem')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Inserir todos os cards como menu items
    const menuItems = finalCards.map(card => ({
      id: card.id,
      href: card.href,
      label: card.title,
      icon: card.iconName || card.icon || 'FiCircle',
      external: card.external,
      enabled: card.enabled,
      order: card.order,
      adminOnly: card.adminOnly,
      managerOnly: card.managerOnly,
      allowedRoles: card.allowedRoles,
      allowedUserIds: card.allowedUserIds,
      title_pt: card.title,
      title_en: card.titleEn,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    const { error: menuError } = await supabase
      .from('MenuItem')
      .insert(menuItems);
    
    if (menuError) {
      console.error('❌ Erro ao sincronizar MenuItem:', menuError.message);
    } else {
      console.log(`✅ ${menuItems.length} itens sincronizados\n`);
    }

    console.log('✅ Correções finais concluídas!');
    console.log('\n📊 Resumo:');
    console.log(`  - Card: ${finalCards.length} registros`);
    console.log(`  - MenuItem: ${menuItems.length} registros`);
    console.log('  - Todos os dados consolidados e sincronizados\n');

  } catch (error) {
    console.error('❌ Erro durante correções:', error);
    process.exit(1);
  }
}

fixFinalIssues();

