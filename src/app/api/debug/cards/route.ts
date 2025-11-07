import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🔍 Diagnosticando problemas com cards do dashboard...');

    const results: any[] = [];

    // 1. Verificar se a tabela cards existe
    results.push({ step: '1️⃣ Verificando tabela cards...' });
    
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      results.push({
        status: 'ERROR',
        message: 'Erro ao acessar tabela cards',
        error: tableError.message,
        solution: 'Execute o SQL para criar a tabela cards'
      });
      return NextResponse.json({ results });
    }

    results.push({
      status: 'OK',
      message: `Tabela cards existe com ${tableCheck || 0} registros`
    });

    // 2. Listar todos os cards
    results.push({ step: '2️⃣ Listando todos os cards na tabela...' });
    
    const { data: allCards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (cardsError) {
      results.push({
        status: 'ERROR',
        message: 'Erro ao buscar cards',
        error: cardsError.message
      });
      return NextResponse.json({ results });
    }

    if (!allCards || allCards.length === 0) {
      results.push({
        status: 'WARNING',
        message: 'Nenhum card encontrado na tabela',
        solution: 'Execute POST /api/admin/cards/upgrade-table para popular'
      });
      return NextResponse.json({ results });
    }

    results.push({
      status: 'OK',
      message: `Encontrados ${allCards.length} cards`,
      cards: allCards.map(card => ({
        id: card.id,
        title: card.title,
        order: card.order,
        enabled: card.enabled
      }))
    });

    // 3. Verificar especificamente o card Academy
    results.push({ step: '3️⃣ Verificando card Academy...' });
    
    const academyCard = allCards.find(card => card.id === 'academy');
    
    if (!academyCard) {
      results.push({
        status: 'ERROR',
        message: 'Card Academy não encontrado',
        solution: 'Execute POST /api/academy/populate-sample-data'
      });
      
      // Tentar criar o card Academy
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
        results.push({
          status: 'ERROR',
          message: 'Erro ao criar card Academy',
          error: createError.message
        });
      } else {
        results.push({
          status: 'FIXED',
          message: 'Card Academy criado com sucesso!',
          card: newCard
        });
      }
    } else {
      results.push({
        status: 'OK',
        message: 'Card Academy encontrado',
        card: {
          title: academyCard.title,
          description: academyCard.description,
          href: academyCard.href,
          enabled: academyCard.enabled,
          order: academyCard.order,
          icon_name: academyCard.icon_name
        }
      });
    }

    // 4. Verificar card Social
    results.push({ step: '4️⃣ Verificando card Social...' });
    
    const socialCard = allCards.find(card => card.id === 'social');
    
    if (!socialCard) {
      results.push({
        status: 'ERROR',
        message: 'Card Social não encontrado',
        solution: 'Execute POST /api/social/populate-card'
      });
      
      // Tentar criar o card Social
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

      const { data: newSocialCard, error: createSocialError } = await supabaseAdmin
        .from('cards')
        .insert(socialCardData)
        .select()
        .single();

      if (createSocialError) {
        results.push({
          status: 'ERROR',
          message: 'Erro ao criar card Social',
          error: createSocialError.message
        });
      } else {
        results.push({
          status: 'FIXED',
          message: 'Card Social criado com sucesso!',
          card: newSocialCard
        });
      }
    } else {
      results.push({
        status: 'OK',
        message: 'Card Social encontrado',
        card: {
          title: socialCard.title,
          enabled: socialCard.enabled,
          order: socialCard.order
        }
      });
    }

    // 5. Verificar estrutura das colunas
    results.push({ step: '5️⃣ Verificando estrutura das colunas...' });
    
    if (allCards.length > 0) {
      const firstCard = allCards[0];
      const columns = Object.keys(firstCard);
      
      const requiredColumns = ['id', 'title', 'description', 'href', 'enabled', 'order'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        results.push({
          status: 'ERROR',
          message: 'Colunas faltando',
          missing_columns: missingColumns,
          available_columns: columns
        });
      } else {
        results.push({
          status: 'OK',
          message: 'Todas as colunas obrigatórias estão presentes',
          columns: columns
        });
      }
    }

    // 6. Resumo final
    const finalCards = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    const summary = {
      total_cards: finalCards.data?.length || 0,
      academy_exists: !!finalCards.data?.find(c => c.id === 'academy'),
      social_exists: !!finalCards.data?.find(c => c.id === 'social'),
      admin_exists: !!finalCards.data?.find(c => c.id === 'admin')
    };

    results.push({
      step: '🎯 RESUMO FINAL',
      summary
    });

    return NextResponse.json({
      success: true,
      message: 'Diagnóstico completo',
      results,
      summary
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
