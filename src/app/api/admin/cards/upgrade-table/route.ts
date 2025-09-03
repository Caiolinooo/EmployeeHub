import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHardcodedCards } from '@/data/cards';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando upgrade da tabela cards...');

    // 1. Verificar se a tabela existe e sua estrutura atual
    const { data: existingTable, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .limit(1);

    if (tableError && (tableError.message.includes('does not exist') || tableError.code === '42P01')) {
      console.log('📝 Tabela cards não existe, criando tabela completa...');
      
      // Criar tabela completa do zero
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
    } else {
      console.log('📝 Tabela cards existe, verificando e adicionando colunas faltantes...');
      
      // Lista de colunas que devem existir
      const requiredColumns = [
        { name: 'module_key', type: 'TEXT', default: null },
        { name: 'title_en', type: 'TEXT', default: null },
        { name: 'description_en', type: 'TEXT', default: null },
        { name: 'category', type: 'TEXT', default: null },
        { name: 'tags', type: 'TEXT[]', default: null },
        { name: 'icon_name', type: 'TEXT', default: null }
      ];

      // Adicionar colunas faltantes
      for (const column of requiredColumns) {
        try {
          const alterSQL = `ALTER TABLE cards ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}${column.default ? ` DEFAULT ${column.default}` : ''};`;
          const { error: alterError } = await supabaseAdmin.rpc('exec_sql', { sql: alterSQL });
          
          if (alterError) {
            console.warn(`Aviso ao adicionar coluna ${column.name}:`, alterError.message);
          } else {
            console.log(`✅ Coluna ${column.name} adicionada/verificada`);
          }
        } catch (error) {
          console.warn(`Erro ao adicionar coluna ${column.name}:`, error);
        }
      }

      // Criar índices se não existirem
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_cards_enabled ON cards(enabled);',
        'CREATE INDEX IF NOT EXISTS idx_cards_order ON cards("order");',
        'CREATE INDEX IF NOT EXISTS idx_cards_module_key ON cards(module_key);',
        'CREATE INDEX IF NOT EXISTS idx_cards_admin_only ON cards(admin_only);',
        'CREATE INDEX IF NOT EXISTS idx_cards_manager_only ON cards(manager_only);'
      ];

      for (const indexSQL of indexes) {
        try {
          const { error: indexError } = await supabaseAdmin.rpc('exec_sql', { sql: indexSQL });
          if (indexError) {
            console.warn('Aviso ao criar índice:', indexError.message);
          }
        } catch (error) {
          console.warn('Erro ao criar índice:', error);
        }
      }
    }

    // 2. Verificar se existem cards na tabela
    const { data: existingCards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(5);

    if (cardsError) {
      console.error('Erro ao verificar cards existentes:', cardsError);
      return NextResponse.json({ error: 'Erro ao verificar cards existentes' }, { status: 500 });
    }

    // 3. Se não há cards, inserir cards hardcoded
    if (!existingCards || existingCards.length === 0) {
      console.log('📝 Inserindo cards hardcoded iniciais...');
      
      const hardcodedCards = getHardcodedCards();
      
      const cardsToInsert = hardcodedCards.map(card => ({
        id: card.id,
        title: card.title,
        description: card.description,
        href: card.href,
        icon_name: card.iconName,
        color: card.color,
        hover_color: card.hoverColor,
        external: card.external,
        enabled: card.enabled,
        order: card.order,
        admin_only: card.adminOnly || false,
        manager_only: card.managerOnly || false,
        allowed_roles: card.allowedRoles || null,
        allowed_user_ids: card.allowedUserIds || null,
        module_key: card.moduleKey || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabaseAdmin
        .from('cards')
        .upsert(cardsToInsert, { onConflict: 'id' });

      if (insertError) {
        console.error('Erro ao inserir cards:', insertError);
        return NextResponse.json({ error: 'Erro ao inserir cards iniciais' }, { status: 500 });
      }

      console.log(`✅ ${cardsToInsert.length} cards inseridos com sucesso!`);
    } else {
      console.log(`📋 ${existingCards.length} cards já existem na tabela`);
      
      // Verificar se cards importantes estão faltando (como Academy)
      const { data: academyCard } = await supabaseAdmin
        .from('cards')
        .select('id')
        .eq('id', 'academy')
        .single();

      if (!academyCard) {
        console.log('📝 Card Academy não encontrado, adicionando...');
        
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: academyError } = await supabaseAdmin
          .from('cards')
          .upsert(academyCardData, { onConflict: 'id' });

        if (academyError) {
          console.error('Erro ao inserir card Academy:', academyError);
        } else {
          console.log('✅ Card Academy adicionado com sucesso!');
        }
      }
    }

    // 4. Atualizar cards existentes que não têm module_key
    console.log('📝 Atualizando module_key para cards existentes...');
    
    const moduleKeyUpdates = [
      { id: 'manual', module_key: 'manual' },
      { id: 'procedimentos-logistica', module_key: 'procedimentos' },
      { id: 'politicas-empresa', module_key: 'politicas' },
      { id: 'calendario-eventos', module_key: 'calendario' },
      { id: 'noticias-empresa', module_key: 'noticias' },
      { id: 'reembolso', module_key: 'reembolso' },
      { id: 'contracheque', module_key: 'contracheque' },
      { id: 'ponto-eletronico', module_key: 'ponto' },
      { id: 'avaliacao', module_key: 'avaliacao' },
      { id: 'admin', module_key: 'admin' }
    ];

    for (const update of moduleKeyUpdates) {
      const { error: updateError } = await supabaseAdmin
        .from('cards')
        .update({ 
          module_key: update.module_key,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id)
        .is('module_key', null);

      if (updateError) {
        console.warn(`Aviso ao atualizar module_key para ${update.id}:`, updateError.message);
      }
    }

    console.log('✅ Module keys atualizados!');

    // 5. Verificar estrutura final
    const { data: finalCards, error: finalError } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key, enabled')
      .order('order', { ascending: true });

    if (finalError) {
      console.error('Erro ao verificar estrutura final:', finalError);
    } else {
      console.log(`🎉 Upgrade concluído! ${finalCards?.length || 0} cards na tabela`);
    }

    return NextResponse.json({
      success: true,
      message: 'Tabela cards atualizada com sucesso',
      cards_count: finalCards?.length || 0
    });

  } catch (error) {
    console.error('Erro durante upgrade da tabela cards:', error);
    return NextResponse.json(
      { error: 'Erro interno durante upgrade da tabela' },
      { status: 500 }
    );
  }
}
