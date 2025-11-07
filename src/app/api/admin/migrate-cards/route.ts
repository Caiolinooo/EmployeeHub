import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getHardcodedCards } from '@/data/cards';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST - Migrar cards hardcoded para o Supabase
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação e permissões de admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await verifyToken(token);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem migrar dados.' },
        { status: 403 }
      );
    }

    console.log('🔄 Iniciando migração de cards hardcoded para Supabase...');

    // Obter cards hardcoded
    const hardcodedCards = getHardcodedCards();
    console.log(`📦 ${hardcodedCards.length} cards hardcoded encontrados`);

    // Verificar se a tabela cards existe e criar se necessário
    const { data: existingCards, error: selectError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(1);

    if (selectError && selectError.code === '42P01') {
      console.log('📋 Tabela cards não existe, criando...');

      // Criar a tabela cards
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.cards (
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Criar índices
        CREATE INDEX IF NOT EXISTS idx_cards_enabled ON public.cards(enabled);
        CREATE INDEX IF NOT EXISTS idx_cards_order ON public.cards("order");
        CREATE INDEX IF NOT EXISTS idx_cards_admin_only ON public.cards(admin_only);
        CREATE INDEX IF NOT EXISTS idx_cards_manager_only ON public.cards(manager_only);

        -- Habilitar RLS
        ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

        -- Política para leitura (todos os usuários autenticados)
        CREATE POLICY IF NOT EXISTS "cards_select_policy" ON public.cards
          FOR SELECT USING (auth.role() = 'authenticated');

        -- Política para inserção/atualização/exclusão (apenas admins)
        CREATE POLICY IF NOT EXISTS "cards_admin_policy" ON public.cards
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.users_unified
              WHERE id = auth.uid() AND role = 'ADMIN'
            )
          );
      `;

      // Como não podemos executar SQL arbitrário via API, vamos retornar o SQL para execução manual
      console.error('❌ Erro ao criar tabela cards:', 'Função exec_sql não disponível');

      return NextResponse.json(
        {
          error: 'Tabela cards não existe. Execute o SQL abaixo no Supabase SQL Editor para criar a tabela:',
          sql: createTableSQL,
          instructions: [
            '1. Acesse o Supabase Dashboard',
            '2. Vá para SQL Editor',
            '3. Execute o SQL fornecido',
            '4. Tente a migração novamente'
          ]
        },
        { status: 500 }
      );
    } else if (selectError) {
      console.error('❌ Erro ao verificar tabela cards:', selectError);
      return NextResponse.json(
        { error: 'Erro ao acessar tabela cards.' },
        { status: 500 }
      );
    }

    // Migrar cada card
    const results = [];
    for (const card of hardcodedCards) {
      try {
        const { data, error } = await supabaseAdmin
          .from('cards')
          .upsert(
            {
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
              allowed_roles: card.allowedRoles || [],
              allowed_user_ids: card.allowedUserIds || [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { 
              onConflict: 'id',
              ignoreDuplicates: false 
            }
          );

        if (error) {
          console.error(`❌ Erro ao migrar card ${card.id}:`, error);
          results.push({ id: card.id, status: 'error', error: error.message });
        } else {
          console.log(`✅ Card ${card.id} migrado com sucesso`);
          results.push({ id: card.id, status: 'success' });
        }
      } catch (cardError) {
        console.error(`❌ Erro ao processar card ${card.id}:`, cardError);
        results.push({ id: card.id, status: 'error', error: String(cardError) });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`🎉 Migração concluída: ${successCount} sucessos, ${errorCount} erros`);

    return NextResponse.json({
      message: 'Migração concluída',
      total: hardcodedCards.length,
      success: successCount,
      errors: errorCount,
      results: results
    });

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor durante a migração' },
      { status: 500 }
    );
  }
}

// GET - Verificar status da migração
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await verifyToken(token);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Contar cards no Supabase
    const { count: supabaseCount, error: countError } = await supabaseAdmin
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json(
        { error: 'Erro ao contar cards no Supabase' },
        { status: 500 }
      );
    }

    // Contar cards hardcoded
    const hardcodedCards = getHardcodedCards();
    const hardcodedCount = hardcodedCards.length;

    return NextResponse.json({
      supabaseCount: supabaseCount || 0,
      hardcodedCount,
      needsMigration: (supabaseCount || 0) < hardcodedCount,
      status: (supabaseCount || 0) >= hardcodedCount ? 'synced' : 'needs_migration'
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
