import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API para atualizar traduções dos cards no banco de dados
 * POST /api/admin/cards/update-translations
 */
export async function POST() {
  try {
    console.log('🔄 Atualizando traduções dos cards...');

    // Mapeamento de traduções para cada card
    const translations: Record<string, { title_pt: string; title_en: string; description_pt: string; description_en: string }> = {
      'manual-logistica': {
        title_pt: 'Manual de Logística',
        title_en: 'Logistics Manual',
        description_pt: 'Acesse o manual de logística da empresa',
        description_en: 'Access the company logistics manual'
      },
      'procedimentos-logistica': {
        title_pt: 'Procedimentos Logística',
        title_en: 'Logistics Procedures',
        description_pt: 'Procedimentos operacionais de logística',
        description_en: 'Logistics operational procedures'
      },
      'politicas': {
        title_pt: 'Políticas',
        title_en: 'Policies',
        description_pt: 'Consulte as políticas da empresa',
        description_en: 'Check company policies'
      },
      'procedimentos-gerais': {
        title_pt: 'Procedimentos Gerais',
        title_en: 'General Procedures',
        description_pt: 'Procedimentos gerais da empresa',
        description_en: 'General company procedures'
      },
      'avaliacao': {
        title_pt: 'Avaliação',
        title_en: 'Evaluation',
        description_pt: 'Sistema de avaliação de desempenho',
        description_en: 'Performance evaluation system'
      },
      'calendario': {
        title_pt: 'Calendário',
        title_en: 'Calendar',
        description_pt: 'Calendário de eventos e feriados',
        description_en: 'Events and holidays calendar'
      },
      'contatos': {
        title_pt: 'Contatos',
        title_en: 'Contacts',
        description_pt: 'Lista de contatos da empresa',
        description_en: 'Company contacts list'
      },
      'ponto': {
        title_pt: 'Ponto',
        title_en: 'Timesheet',
        description_pt: 'Sistema de controle de ponto',
        description_en: 'Time tracking system'
      },
      'contracheque': {
        title_pt: 'Contracheque',
        title_en: 'Payroll',
        description_pt: 'Consulte seus contracheques',
        description_en: 'Check your payslips'
      },
      'reembolso': {
        title_pt: 'Reembolso',
        title_en: 'Reimbursement',
        description_pt: 'Sistema de solicitação de reembolsos',
        description_en: 'Reimbursement request system'
      },
      'noticias': {
        title_pt: 'Notícias',
        title_en: 'News',
        description_pt: 'Central de notícias e comunicados',
        description_en: 'News and announcements center'
      },
      'academy': {
        title_pt: 'ABZ Academy',
        title_en: 'ABZ Academy',
        description_pt: 'Centro de treinamento e desenvolvimento',
        description_en: 'Training and development center'
      },
      'chat': {
        title_pt: 'Chat',
        title_en: 'Chat',
        description_pt: 'Sistema de mensagens instantâneas',
        description_en: 'Instant messaging system'
      },
      'social': {
        title_pt: 'ABZ Social',
        title_en: 'ABZ Social',
        description_pt: 'Rede social interna da empresa',
        description_en: 'Internal company social network'
      },
      'admin': {
        title_pt: 'Administração',
        title_en: 'Administration',
        description_pt: 'Painel de administração do sistema',
        description_en: 'System administration panel'
      }
    };

    // Buscar todos os cards do banco
    const { data: cards, error: fetchError } = await supabaseAdmin
      .from('cards')
      .select('*');

    if (fetchError) {
      console.error('❌ Erro ao buscar cards:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar cards', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        message: 'Nenhum card encontrado no banco',
        updated: 0
      });
    }

    console.log(`📋 Encontrados ${cards.length} cards para atualizar`);

    // Atualizar cada card com as traduções
    const updates = [];
    for (const card of cards) {
      const translation = translations[card.id];
      
      if (translation) {
        const { error: updateError } = await supabaseAdmin
          .from('cards')
          .update({
            title: translation.title_pt,
            title_en: translation.title_en,
            description: translation.description_pt,
            description_en: translation.description_en,
            updated_at: new Date().toISOString()
          })
          .eq('id', card.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar card ${card.id}:`, updateError);
        } else {
          console.log(`✅ Card ${card.id} atualizado com sucesso`);
          updates.push(card.id);
        }
      } else {
        console.warn(`⚠️ Tradução não encontrada para card: ${card.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updates.length} cards atualizados com sucesso`,
      updated: updates.length,
      cards: updates
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar status das traduções
export async function GET() {
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, title_en, description, description_en')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar cards', details: error.message },
        { status: 500 }
      );
    }

    // Verificar quais cards têm traduções
    const withTranslations = cards?.filter(c => c.title_en && c.description_en) || [];
    const withoutTranslations = cards?.filter(c => !c.title_en || !c.description_en) || [];

    return NextResponse.json({
      total: cards?.length || 0,
      withTranslations: withTranslations.length,
      withoutTranslations: withoutTranslations.length,
      cardsWithoutTranslations: withoutTranslations.map(c => c.id),
      cards: cards
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

