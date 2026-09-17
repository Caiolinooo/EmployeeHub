import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTranslatedCards } from '@/data/cards';

export const dynamic = 'force-dynamic';

// GET - Obter todos os cards com fallback para dados hardcoded
export async function GET() {
  try {
    console.log('🔄 API Cards - Buscando cards do Supabase...');

    // Tentar buscar do Supabase primeiro
    const { data: cardsFromDb, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });
    let cards = cardsFromDb;

    if (error) {
      console.log('⚠️ Erro ao buscar do Supabase:', error.message);
      console.log('📦 Usando dados hardcoded como fallback');
      const fallbackCards = getTranslatedCards((key: string) => {
        const translations: { [key: string]: string } = {
          'cards.manualColaborador': 'Manual do Colaborador',
          'cards.manualColaboradorDesc': 'Acesse o manual completo do colaborador',
          'cards.procedimentosLogistica': 'Procedimentos de Logística',
          'cards.procedimentosLogisticaDesc': 'Consulte os procedimentos padrões da área',
          'cards.politicas': 'Políticas',
          'cards.politicasDesc': 'Consulte as políticas da empresa',
          'cards.procedimentosGerais': 'Procedimentos Gerais',
          'cards.procedimentosGeraisDesc': 'Consulte os procedimentos gerais da empresa',
          'cards.calendario': 'Calendário',
          'cards.calendarioDesc': 'Visualize eventos e datas importantes',
          'cards.noticias': 'ABZ News',
          'cards.noticiasDesc': 'Fique por dentro das novidades da empresa',
          'cards.reembolso': 'Reembolso',
          'cards.reembolsoDesc': 'Solicite reembolsos de despesas',
          'cards.contracheque': 'Contracheque',
          'cards.contrachequeDesc': 'Acesse seus contracheques',
          'cards.ponto': 'Ponto',
          'cards.pontoDesc': 'Registre seu ponto e consulte seu histórico',
          'avaliacao.title': 'Avaliação de Desempenho',
          'avaliacao.description': 'Gerencie avaliações de desempenho dos colaboradores',
          'cards.folhaPagamento': 'Folha de Pagamento',
          'cards.folhaPagamentoDesc': 'Gerencie a folha de pagamento dos colaboradores',
          'admin.title': 'Administração',
          'admin.dashboard': 'Painel administrativo',
        };
        return translations[key] || key;
      });
      return NextResponse.json(fallbackCards);
    }

    if (!cards || cards.length === 0) {
      console.log('📦 Nenhum card encontrado no Supabase, tentando popular automaticamente...');

      // Tentar popular a tabela automaticamente
      try {
        const populateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/cards/populate`, {
          method: 'POST'
        });

        if (populateResponse.ok) {
          console.log('✅ Tabela cards populada automaticamente');

          // Tentar buscar novamente
          const { data: newCards, error: newError } = await supabaseAdmin
            .from('cards')
            .select('*')
            .order('order', { ascending: true });

          if (!newError && newCards && newCards.length > 0) {
            cards = newCards;
            console.log(`✅ ${cards.length} cards carregados após população automática`);
          }
        }
      } catch (populateError) {
        console.warn('⚠️ Erro na população automática:', populateError);
      }

      // Se ainda não há cards, usar fallback
      if (!cards || cards.length === 0) {
        console.log('📦 Usando dados hardcoded como fallback');
        const fallbackCards = getTranslatedCards((key: string) => {
          const translations: { [key: string]: string } = {
            'cards.manualColaborador': 'Manual do Colaborador',
            'cards.manualColaboradorDesc': 'Acesse o manual completo do colaborador',
            'cards.procedimentosLogistica': 'Procedimentos de Logística',
            'cards.procedimentosLogisticaDesc': 'Consulte os procedimentos padrões da área',
            'cards.politicas': 'Políticas',
            'cards.politicasDesc': 'Consulte as políticas da empresa',
            'cards.procedimentosGerais': 'Procedimentos Gerais',
            'cards.procedimentosGeraisDesc': 'Consulte os procedimentos gerais da empresa',
            'cards.calendario': 'Calendário',
            'cards.calendarioDesc': 'Visualize eventos e datas importantes',
            'cards.noticias': 'ABZ News',
            'cards.noticiasDesc': 'Fique por dentro das novidades da empresa',
            'cards.reembolso': 'Reembolso',
            'cards.reembolsoDesc': 'Solicite reembolsos de despesas',
            'cards.contracheque': 'Contracheque',
            'cards.contrachequeDesc': 'Acesse seus contracheques',
            'cards.ponto': 'Ponto',
            'cards.pontoDesc': 'Registre seu ponto e consulte seu histórico',
            'avaliacao.title': 'Avaliação de Desempenho',
            'avaliacao.description': 'Gerencie avaliações de desempenho dos colaboradores',
            'cards.folhaPagamento': 'Folha de Pagamento',
            'cards.folhaPagamentoDesc': 'Gerencie a folha de pagamento dos colaboradores',
            'admin.title': 'Administração',
            'admin.dashboard': 'Painel administrativo',
          };
          return translations[key] || key;
        });
        return NextResponse.json(fallbackCards);
      }
    }

    console.log(`✅ ${cards.length} cards carregados do Supabase`);

    // Mapear os dados do Supabase para o formato esperado pelo frontend
    const formattedCards = cards.map(card => ({
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      iconName: card.icon_name || card.icon,
      color: card.color,
      hoverColor: card.hover_color,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.admin_only || false,
      managerOnly: card.manager_only || false,
      allowedRoles: card.allowed_roles || [],
      allowedUserIds: card.allowed_user_ids || [],
      moduleKey: card.module_key,
      titleEn: card.title_en,
      descriptionEn: card.description_en,
      category: card.category,
      tags: card.tags || []
    }));

    return NextResponse.json(formattedCards);
  } catch (error) {
    console.error('❌ Erro na API de cards:', error);
    console.log('📦 Usando dados hardcoded como fallback de emergência');
    const fallbackCards = getTranslatedCards((key: string) => {
      const translations: { [key: string]: string } = {
        'cards.manualColaborador': 'Manual do Colaborador',
        'cards.manualColaboradorDesc': 'Acesse o manual completo do colaborador',
        'cards.procedimentosLogistica': 'Procedimentos de Logística',
        'cards.procedimentosLogisticaDesc': 'Consulte os procedimentos padrões da área',
        'cards.politicas': 'Políticas',
        'cards.politicasDesc': 'Consulte as políticas da empresa',
        'cards.procedimentosGerais': 'Procedimentos Gerais',
        'cards.procedimentosGeraisDesc': 'Consulte os procedimentos gerais da empresa',
        'cards.calendario': 'Calendário',
        'cards.calendarioDesc': 'Visualize eventos e datas importantes',
        'cards.noticias': 'ABZ News',
        'cards.noticiasDesc': 'Fique por dentro das novidades da empresa',
        'cards.reembolso': 'Reembolso',
        'cards.reembolsoDesc': 'Solicite reembolsos de despesas',
        'cards.contracheque': 'Contracheque',
        'cards.contrachequeDesc': 'Acesse seus contracheques',
        'cards.ponto': 'Ponto',
        'cards.pontoDesc': 'Registre seu ponto e consulte seu histórico',
        'avaliacao.title': 'Avaliação de Desempenho',
        'avaliacao.description': 'Gerencie avaliações de desempenho dos colaboradores',
        'cards.folhaPagamento': 'Folha de Pagamento',
        'cards.folhaPagamentoDesc': 'Gerencie a folha de pagamento dos colaboradores',
        'admin.title': 'Administração',
        'admin.dashboard': 'Painel administrativo',
      };
      return translations[key] || key;
    });
    return NextResponse.json(fallbackCards);
  }
}

// POST - Criar um novo card
export async function POST(request: NextRequest) {

  try {
    const body = await request.json();
    const {
      title, description, href, icon, color, hoverColor, external, enabled, order,
      adminOnly, managerOnly, allowedRoles, allowedUserIds, titleEn, descriptionEn
    } = body;

    // Validar os dados de entrada
    if (!title || !description || !href || !icon || !color || !hoverColor || order === undefined) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const cardData = {
      title,
      description,
      href,
      icon,
      color,
      hoverColor,
      external: external || false,
      enabled: enabled !== undefined ? enabled : true,
      order,
      adminOnly: adminOnly || false,
      managerOnly: managerOnly || false,
      allowedRoles: allowedRoles || null,
      allowedUserIds: allowedUserIds || null,
      titleEn: titleEn || null,
      descriptionEn: descriptionEn || null
    };

    // Inserir o card no Supabase
    const { data: newCard, error } = await supabaseAdmin
      .from('cards')
      .insert(cardData)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar card:', error);
      return NextResponse.json(
        { error: 'Erro ao criar card' },
        { status: 500 }
      );
    }

    return NextResponse.json(newCard, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
