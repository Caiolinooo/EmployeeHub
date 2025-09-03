import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testando carregamento de cards como o dashboard faz...');

    // Simular dados de usuário como o dashboard enviaria
    const testUserData = {
      userId: 'test-user-id',
      userRole: 'admin',
      userEmail: 'caio.correia@groupabz.com',
      userPhone: '+5522997847289'
    };

    console.log('📤 Enviando dados para /api/cards/supabase:', testUserData);

    // Fazer a mesma chamada que o dashboard faz
    const response = await fetch('http://localhost:3000/api/cards/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUserData)
    });

    console.log('📥 Resposta da API:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Erro ao chamar API de cards',
        status: response.status,
        details: errorText
      }, { status: 500 });
    }

    const cards = await response.json();
    console.log(`✅ API retornou ${cards.length} cards`);

    // Verificar se o card Academy está presente
    const academyCard = cards.find((card: any) => card.id === 'academy');
    const newsCard = cards.find((card: any) => card.id === 'noticias');
    const adminCard = cards.find((card: any) => card.id === 'admin');

    const summary = {
      total_cards: cards.length,
      academy_found: !!academyCard,
      news_found: !!newsCard,
      admin_found: !!adminCard,
      academy_details: academyCard || null,
      news_details: newsCard || null,
      all_card_ids: cards.map((card: any) => card.id)
    };

    console.log('📊 Resumo:', summary);

    return NextResponse.json({
      success: true,
      message: 'Teste de carregamento de cards concluído',
      summary,
      cards: cards.map((card: any) => ({
        id: card.id,
        title: card.title,
        enabled: card.enabled,
        order: card.order
      }))
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno no teste',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
