import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * API para fazer upgrade da tabela menu_items
 * Adiciona colunas de tradução se não existirem
 */
export async function POST() {
  try {
    console.log('🔄 Iniciando upgrade da tabela menu_items...');

    // Verificar se a tabela existe
    const { data: existingItems, error: checkError } = await supabaseAdmin
      .from('menu_items')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar tabela menu_items:', checkError);
      return NextResponse.json(
        { 
          error: 'Tabela menu_items não existe ou não pode ser acessada',
          details: checkError.message 
        },
        { status: 500 }
      );
    }

    // Tentar adicionar colunas de tradução
    console.log('📝 Adicionando colunas de tradução...');
    
    // Nota: Supabase não permite ALTER TABLE via API REST
    // Precisamos fazer isso via SQL direto ou manualmente no dashboard
    // Por enquanto, vamos apenas verificar se as colunas existem
    
    const { data: sampleItem } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .limit(1)
      .single();

    if (sampleItem) {
      const hasTranslations = 'title_pt' in sampleItem && 'title_en' in sampleItem;
      
      if (!hasTranslations) {
        console.warn('⚠️ Colunas de tradução não encontradas na tabela menu_items');
        console.warn('⚠️ Execute o seguinte SQL no Supabase Dashboard:');
        console.warn(`
          ALTER TABLE menu_items 
          ADD COLUMN IF NOT EXISTS title_pt TEXT,
          ADD COLUMN IF NOT EXISTS title_en TEXT;
        `);
        
        return NextResponse.json({
          success: false,
          message: 'Colunas de tradução não encontradas',
          sql: `
            ALTER TABLE menu_items 
            ADD COLUMN IF NOT EXISTS title_pt TEXT,
            ADD COLUMN IF NOT EXISTS title_en TEXT;
          `
        }, { status: 400 });
      }
      
      console.log('✅ Colunas de tradução já existem');
    }

    // Atualizar itens existentes com traduções
    console.log('📝 Atualizando itens com traduções...');
    
    const { data: allItems } = await supabaseAdmin
      .from('menu_items')
      .select('*');

    if (allItems && allItems.length > 0) {
      for (const item of allItems) {
        // Se não tem traduções, adicionar baseado no label
        if (!item.title_pt || !item.title_en) {
          const updates: any = {};
          
          if (!item.title_pt) {
            updates.title_pt = item.label || item.title || item.id;
          }
          
          if (!item.title_en) {
            // Traduções básicas
            const translations: Record<string, string> = {
              'Dashboard': 'Dashboard',
              'Manual Logístico': 'Logistics Manual',
              'Procedimento Logística': 'Logistics Procedures',
              'Políticas': 'Policies',
              'Procedimentos Gerais': 'General Procedures',
              'Calendário': 'Calendar',
              'ABZ News': 'ABZ News',
              'Reembolso': 'Reimbursement',
              'Contracheque': 'Payslip',
              'Ponto': 'Time Clock',
              'Folha de Pagamento': 'Payroll',
              'Avaliação': 'Performance Evaluation',
              'Academy': 'Academy',
              'Notícias': 'News',
              'Contatos': 'Contacts',
              'Administração': 'Administration'
            };
            
            updates.title_en = translations[item.label] || item.label || item.title || item.id;
          }
          
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin
              .from('menu_items')
              .update(updates)
              .eq('id', item.id);
            
            console.log(`✅ Atualizado item ${item.id} com traduções`);
          }
        }
      }
    }

    console.log('✅ Upgrade da tabela menu_items concluído');

    return NextResponse.json({
      success: true,
      message: 'Tabela menu_items atualizada com sucesso',
      itemsUpdated: allItems?.length || 0
    });

  } catch (error) {
    console.error('❌ Erro no upgrade da tabela menu_items:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao fazer upgrade da tabela menu_items',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

