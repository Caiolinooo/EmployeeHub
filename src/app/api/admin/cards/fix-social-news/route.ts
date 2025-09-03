import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔧 Corrigindo cards: removendo Social e ajustando Notícias...');

    const results = [];

    // 1. Remover o card 'social'
    console.log('🗑️ Removendo card Social...');
    const { error: deleteError } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('id', 'social');

    if (deleteError) {
      results.push({
        action: 'DELETE_SOCIAL',
        status: 'ERROR',
        message: 'Erro ao remover card Social',
        error: deleteError.message
      });
    } else {
      results.push({
        action: 'DELETE_SOCIAL',
        status: 'SUCCESS',
        message: 'Card Social removido com sucesso'
      });
    }

    // 2. Verificar se existe card de notícias
    console.log('🔍 Verificando card de Notícias...');
    const { data: newsCards, error: newsError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .or('id.eq.noticias-empresa,id.eq.abz-news,id.eq.news,id.eq.noticias');

    if (newsError) {
      results.push({
        action: 'CHECK_NEWS',
        status: 'ERROR',
        message: 'Erro ao verificar card de Notícias',
        error: newsError.message
      });
      return NextResponse.json({ success: false, results }, { status: 500 });
    }

    let newsCard = newsCards?.[0];

    // 3. Se não existe card de notícias, criar um
    if (!newsCard) {
      console.log('📰 Criando card de Notícias/Social...');
      const newsCardData = {
        id: 'noticias-empresa',
        title: 'ABZ News',
        description: 'Fique por dentro das novidades e interaja com a equipe',
        href: '/noticias-empresa',
        icon_name: 'FiRss',
        color: 'bg-orange-600',
        hover_color: 'hover:bg-orange-700',
        external: false,
        enabled: true,
        order: 5,
        admin_only: false,
        manager_only: false,
        module_key: 'noticias-empresa'
      };

      const { data: newNewsCard, error: createError } = await supabaseAdmin
        .from('cards')
        .insert([newsCardData])
        .select()
        .single();

      if (createError) {
        results.push({
          action: 'CREATE_NEWS',
          status: 'ERROR',
          message: 'Erro ao criar card de Notícias',
          error: createError.message
        });
      } else {
        newsCard = newNewsCard;
        results.push({
          action: 'CREATE_NEWS',
          status: 'SUCCESS',
          message: 'Card de Notícias criado com sucesso',
          card: newsCard
        });
      }
    } else {
      // 4. Atualizar card de notícias existente para incluir função social
      console.log('📝 Atualizando card de Notícias para incluir função social...');
      
      const updatedData = {
        title: 'ABZ News',
        description: 'Fique por dentro das novidades e interaja com a equipe',
        icon_name: 'FiRss',
        color: 'bg-orange-600',
        hover_color: 'hover:bg-orange-700',
        enabled: true,
        order: 5
      };

      const { data: updatedCard, error: updateError } = await supabaseAdmin
        .from('cards')
        .update(updatedData)
        .eq('id', newsCard.id)
        .select()
        .single();

      if (updateError) {
        results.push({
          action: 'UPDATE_NEWS',
          status: 'ERROR',
          message: 'Erro ao atualizar card de Notícias',
          error: updateError.message
        });
      } else {
        newsCard = updatedCard;
        results.push({
          action: 'UPDATE_NEWS',
          status: 'SUCCESS',
          message: 'Card de Notícias atualizado com função social',
          card: newsCard
        });
      }
    }

    // 5. Verificar resultado final
    const { data: finalCards, error: finalError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (finalError) {
      results.push({
        action: 'FINAL_CHECK',
        status: 'ERROR',
        message: 'Erro ao verificar resultado final',
        error: finalError.message
      });
    } else {
      const socialCardExists = finalCards.some(card => card.id === 'social');
      const newsCardExists = finalCards.some(card => 
        card.id === 'noticias-empresa' || card.id === 'abz-news' || card.id === 'news'
      );

      results.push({
        action: 'FINAL_CHECK',
        status: 'SUCCESS',
        message: 'Verificação final concluída',
        summary: {
          total_cards: finalCards.length,
          social_card_removed: !socialCardExists,
          news_card_exists: newsCardExists,
          cards: finalCards.map(card => ({
            id: card.id,
            title: card.title,
            order: card.order
          }))
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Correção de cards Social/Notícias concluída',
      results
    });

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Verificar status atual dos cards relacionados
    const { data: allCards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .or('id.eq.social,id.eq.noticias-empresa,id.eq.abz-news,id.eq.news')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({
        error: 'Erro ao verificar cards',
        details: error.message
      }, { status: 500 });
    }

    const socialCard = allCards?.find(card => card.id === 'social');
    const newsCard = allCards?.find(card => 
      card.id === 'noticias-empresa' || card.id === 'abz-news' || card.id === 'news'
    );

    return NextResponse.json({
      success: true,
      message: 'Status atual dos cards Social/Notícias',
      status: {
        social_exists: !!socialCard,
        news_exists: !!newsCard,
        social_card: socialCard || null,
        news_card: newsCard || null,
        all_related_cards: allCards
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
