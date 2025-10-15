/**
 * Script para consolidar dados das tabelas Card, cards e MenuItem
 * 
 * Estratégia:
 * 1. Remover duplicados da tabela Card (manter apenas IDs string)
 * 2. Mesclar dados da tabela cards na Card
 * 3. Sincronizar MenuItem com Card
 * 4. Deletar tabela cards após migração
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeamento de ícones Material para React Icons
const iconMapping = {
  'book': 'FiBookOpen',
  'description': 'FiClipboard',
  'policy': 'FiFileText',
  'calendar_today': 'FiCalendar',
  'newspaper': 'FiRss',
  'receipt': 'FiDollarSign',
  'payments': 'FiDollarSign',
  'schedule': 'FiClock',
  'assessment': 'FiBarChart2',
  'admin_panel_settings': 'FiSettings',
  'play_circle': 'FiPlay',
  'trending_up': 'FiTrendingUp',
  'download': 'FiDownload',
  'smartphone': 'FiSmartphone',
  'storage': 'FiDatabase',
  'bar_chart': 'FiBarChart',
  'layers': 'FiGitBranch',
  'chat': 'FiMessageSquare',
  'dashboard': 'FiGrid'
};

async function consolidateData() {
  console.log('🚀 Iniciando consolidação de dados...\n');

  try {
    // 1. Buscar todos os dados das tabelas
    console.log('📊 Buscando dados das tabelas...');
    
    const { data: cardData, error: cardError } = await supabase
      .from('Card')
      .select('*')
      .order('order');
    
    if (cardError) throw cardError;

    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .order('order');
    
    if (cardsError) throw cardsError;

    console.log(`✅ Card: ${cardData.length} registros`);
    console.log(`✅ cards: ${cardsData.length} registros\n`);

    // 2. Identificar e remover duplicados da tabela Card
    console.log('🔍 Identificando duplicados na tabela Card...');
    
    const cardsByHref = {};
    const duplicatesToDelete = [];
    
    cardData.forEach(card => {
      if (!cardsByHref[card.href]) {
        cardsByHref[card.href] = [];
      }
      cardsByHref[card.href].push(card);
    });

    // Para cada href, manter apenas o registro com ID string (mais recente)
    Object.keys(cardsByHref).forEach(href => {
      const cards = cardsByHref[href];
      if (cards.length > 1) {
        // Ordenar: IDs string primeiro, depois por data de atualização
        cards.sort((a, b) => {
          const aIsString = !a.id.includes('-');
          const bIsString = !b.id.includes('-');
          
          if (aIsString && !bIsString) return -1;
          if (!aIsString && bIsString) return 1;
          
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        
        // Marcar os demais para deleção
        for (let i = 1; i < cards.length; i++) {
          duplicatesToDelete.push(cards[i].id);
        }
        
        console.log(`  ⚠️  ${href}: ${cards.length} duplicados encontrados, mantendo ID: ${cards[0].id}`);
      }
    });

    console.log(`\n📝 Total de duplicados a remover: ${duplicatesToDelete.length}\n`);

    // 3. Deletar duplicados
    if (duplicatesToDelete.length > 0) {
      console.log('🗑️  Removendo duplicados...');
      
      for (const id of duplicatesToDelete) {
        const { error } = await supabase
          .from('Card')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error(`  ❌ Erro ao deletar ${id}:`, error.message);
        } else {
          console.log(`  ✅ Deletado: ${id}`);
        }
      }
      console.log('');
    }

    // 4. Buscar dados atualizados da Card
    const { data: updatedCardData, error: updatedError } = await supabase
      .from('Card')
      .select('*')
      .order('order');
    
    if (updatedError) throw updatedError;

    console.log(`✅ Card após limpeza: ${updatedCardData.length} registros\n`);

    // 5. Mesclar dados da tabela cards na Card
    console.log('🔄 Mesclando dados da tabela cards na Card...');
    
    const cardMap = {};
    updatedCardData.forEach(card => {
      cardMap[card.href] = card;
    });

    const cardsToInsert = [];
    const cardsToUpdate = [];

    cardsData.forEach(card => {
      if (cardMap[card.href]) {
        // Atualizar registro existente com dados mais completos
        const existing = cardMap[card.href];
        const updated = {
          id: existing.id,
          title: card.title || existing.title,
          description: card.description || existing.description,
          href: card.href,
          icon: card.icon_name ? iconMapping[existing.icon] || existing.icon : existing.icon,
          iconName: card.icon_name || existing.iconName,
          color: card.color || existing.color,
          hoverColor: card.hover_color || existing.hoverColor,
          external: card.external,
          enabled: card.enabled,
          order: card.order,
          adminOnly: card.admin_only,
          managerOnly: card.manager_only,
          titleEn: card.title_en || existing.titleEn,
          descriptionEn: card.description_en || existing.descriptionEn,
          moduleKey: card.module_key || existing.moduleKey,
          allowedRoles: card.allowed_roles || existing.allowedRoles,
          allowedUserIds: card.allowed_user_ids || existing.allowedUserIds,
          updatedAt: new Date().toISOString()
        };
        
        cardsToUpdate.push(updated);
      } else {
        // Inserir novo registro
        cardsToInsert.push({
          id: card.id,
          title: card.title,
          description: card.description,
          href: card.href,
          icon: iconMapping[card.icon_name] || 'FiCircle',
          iconName: card.icon_name,
          color: card.color,
          hoverColor: card.hover_color,
          external: card.external,
          enabled: card.enabled,
          order: card.order,
          adminOnly: card.admin_only,
          managerOnly: card.manager_only,
          titleEn: card.title_en,
          descriptionEn: card.description_en,
          moduleKey: card.module_key,
          allowedRoles: card.allowed_roles,
          allowedUserIds: card.allowed_user_ids,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    console.log(`  📥 Registros a inserir: ${cardsToInsert.length}`);
    console.log(`  📝 Registros a atualizar: ${cardsToUpdate.length}\n`);

    // Inserir novos registros
    if (cardsToInsert.length > 0) {
      console.log('📥 Inserindo novos registros...');
      const { error: insertError } = await supabase
        .from('Card')
        .insert(cardsToInsert);
      
      if (insertError) {
        console.error('❌ Erro ao inserir:', insertError.message);
      } else {
        console.log(`✅ ${cardsToInsert.length} registros inseridos\n`);
      }
    }

    // Atualizar registros existentes
    if (cardsToUpdate.length > 0) {
      console.log('📝 Atualizando registros existentes...');
      for (const card of cardsToUpdate) {
        const { error: updateError } = await supabase
          .from('Card')
          .update(card)
          .eq('id', card.id);
        
        if (updateError) {
          console.error(`  ❌ Erro ao atualizar ${card.id}:`, updateError.message);
        } else {
          console.log(`  ✅ Atualizado: ${card.id}`);
        }
      }
      console.log('');
    }

    // 6. Sincronizar MenuItem com Card
    console.log('🔄 Sincronizando MenuItem com Card...');
    
    const { data: finalCardData, error: finalError } = await supabase
      .from('Card')
      .select('*')
      .order('order');
    
    if (finalError) throw finalError;

    // Limpar MenuItem
    const { error: deleteMenuError } = await supabase
      .from('MenuItem')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos
    
    if (deleteMenuError && !deleteMenuError.message.includes('no rows')) {
      console.error('❌ Erro ao limpar MenuItem:', deleteMenuError.message);
    }

    // Inserir todos os cards como menu items
    const menuItems = finalCardData.map(card => ({
      id: card.id,
      href: card.href,
      label: card.title,
      icon: card.icon || iconMapping[card.iconName] || 'FiCircle',
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

    const { error: insertMenuError } = await supabase
      .from('MenuItem')
      .insert(menuItems);
    
    if (insertMenuError) {
      console.error('❌ Erro ao inserir em MenuItem:', insertMenuError.message);
    } else {
      console.log(`✅ ${menuItems.length} itens sincronizados em MenuItem\n`);
    }

    console.log('✅ Consolidação concluída com sucesso!');
    console.log('\n📊 Resumo final:');
    console.log(`  - Card: ${finalCardData.length} registros`);
    console.log(`  - MenuItem: ${menuItems.length} registros`);
    console.log(`  - cards: ${cardsData.length} registros (manter por enquanto para backup)\n`);

  } catch (error) {
    console.error('❌ Erro durante consolidação:', error);
    process.exit(1);
  }
}

consolidateData();

