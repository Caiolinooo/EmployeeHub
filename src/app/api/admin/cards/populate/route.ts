import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { allSystemCards } from '@/scripts/populate-cards-supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API - Populando tabela cards do Supabase...');

    // 1. Verificar se a tabela existe, se não, criar
    const { data: existingCards, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(1);

    if (checkError && (checkError.message.includes('does not exist') || checkError.code === '42P01')) {
      console.log('📝 Tabela cards não existe, criando...');
      
      // Criar tabela completa
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          href TEXT NOT NULL,
          icon_name TEXT,
          color TEXT,
          hover_color TEXT,
          external BOOLEAN DEFAULT false,
          enabled BOOLEAN DEFAULT true,
          "order" INTEGER DEFAULT 0,
          admin_only BOOLEAN DEFAULT false,
          manager_only BOOLEAN DEFAULT false,
          allowed_roles JSONB,
          allowed_user_ids JSONB,
          module_key TEXT,
          title_en TEXT,
          description_en TEXT,
          category TEXT,
          tags TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX IF NOT EXISTS idx_cards_enabled ON cards(enabled);
        CREATE INDEX IF NOT EXISTS idx_cards_order ON cards("order");
        CREATE INDEX IF NOT EXISTS idx_cards_module_key ON cards(module_key);
        CREATE INDEX IF NOT EXISTS idx_cards_admin_only ON cards(admin_only);
        CREATE INDEX IF NOT EXISTS idx_cards_manager_only ON cards(manager_only);
      `;

      const { error: createError } = await supabaseAdmin.rpc('exec_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('Erro ao criar tabela:', createError);
        return NextResponse.json({ error: 'Erro ao criar tabela cards' }, { status: 500 });
      }

      console.log('✅ Tabela cards criada com sucesso!');
    }

    // 2. Inserir/atualizar todos os cards
    console.log(`📝 Inserindo/atualizando ${allSystemCards.length} cards...`);
    
    const cardsWithTimestamp = allSystemCards.map(card => ({
      ...card,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('cards')
      .upsert(cardsWithTimestamp, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('Erro ao inserir cards:', upsertError);
      return NextResponse.json(
        { error: 'Erro ao inserir cards', details: upsertError.message },
        { status: 500 }
      );
    }

    console.log('✅ Cards inseridos/atualizados com sucesso!');

    // 3. Verificar resultado final
    const { data: finalCards, error: finalError } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key, enabled, order')
      .order('order', { ascending: true });

    if (finalError) {
      console.error('Erro ao verificar cards finais:', finalError);
      return NextResponse.json(
        { error: 'Erro ao verificar cards finais', details: finalError.message },
        { status: 500 }
      );
    }

    console.log(`🎉 Processo concluído! ${finalCards?.length || 0} cards na tabela`);

    // 4. Retornar estatísticas detalhadas
    const cardsByCategory = finalCards?.reduce((acc: any, card: any) => {
      const category = allSystemCards.find(c => c.id === card.id)?.category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const enabledCount = finalCards?.filter(card => card.enabled).length || 0;
    const adminOnlyCount = allSystemCards.filter(card => card.admin_only).length;
    const managerOnlyCount = allSystemCards.filter(card => card.manager_only).length;

    return NextResponse.json({
      success: true,
      message: `${allSystemCards.length} cards processados com sucesso`,
      statistics: {
        total_cards: finalCards?.length || 0,
        enabled_cards: enabledCount,
        admin_only_cards: adminOnlyCount,
        manager_only_cards: managerOnlyCount,
        cards_by_category: cardsByCategory,
        modules_with_cards: finalCards?.filter(card => card.module_key).length || 0
      },
      cards: finalCards?.map(card => ({
        id: card.id,
        title: card.title,
        module_key: card.module_key,
        enabled: card.enabled,
        order: card.order
      }))
    });

  } catch (error) {
    console.error('❌ Erro durante população dos cards:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno durante população dos cards',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// GET - Verificar status da tabela cards
export async function GET() {
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key, enabled, order, category')
      .order('order', { ascending: true });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          exists: false,
          message: 'Tabela cards não existe',
          cards_count: 0
        });
      }
      
      return NextResponse.json(
        { error: 'Erro ao verificar tabela cards', details: error.message },
        { status: 500 }
      );
    }

    // Estatísticas
    const enabledCount = cards?.filter(card => card.enabled).length || 0;
    const withModuleKey = cards?.filter(card => card.module_key).length || 0;
    
    const cardsByCategory = cards?.reduce((acc: any, card: any) => {
      const category = allSystemCards.find(c => c.id === card.id)?.category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      exists: true,
      cards_count: cards?.length || 0,
      enabled_count: enabledCount,
      with_module_key: withModuleKey,
      cards_by_category: cardsByCategory,
      cards: cards?.map(card => ({
        id: card.id,
        title: card.title,
        module_key: card.module_key,
        enabled: card.enabled,
        order: card.order
      }))
    });

  } catch (error) {
    console.error('Erro ao verificar status da tabela cards:', error);
    return NextResponse.json(
      { error: 'Erro interno ao verificar tabela' },
      { status: 500 }
    );
  }
}
