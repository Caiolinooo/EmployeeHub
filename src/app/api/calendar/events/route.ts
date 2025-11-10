import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Configuração OAuth2 do Google Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    if (!userId) {
      return NextResponse.json({
        error: 'userId é obrigatório'
      }, { status: 400 });
    }

    console.log(`📅 Buscando eventos do calendário para usuário ${userId}`);

    // TODO: Buscar tokens do usuário no banco de dados
    // const { data: userTokens, error: tokenError } = await supabaseAdmin
    //   .from('user_google_tokens')
    //   .select('tokens')
    //   .eq('user_id', userId)
    //   .single();

    // if (tokenError || !userTokens) {
    //   return NextResponse.json({
    //     error: 'Usuário não autenticado com Google Calendar',
    //     needsAuth: true
    //   }, { status: 401 });
    // }

    // Por enquanto, vamos simular eventos
    const mockEvents = [
      {
        id: 'event-1',
        summary: 'Reunião de Equipe',
        description: 'Reunião semanal da equipe de logística',
        start: {
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        location: 'Sala de Reuniões - ABZ Group',
        attendees: [
          { email: 'caio.correia@groupabz.com', responseStatus: 'accepted' }
        ],
        creator: {
          email: 'caio.correia@groupabz.com',
          displayName: 'Caio Correia'
        },
        organizer: {
          email: 'caio.correia@groupabz.com',
          displayName: 'Caio Correia'
        }
      },
      {
        id: 'event-2',
        summary: 'Treinamento de Segurança',
        description: 'Treinamento obrigatório sobre normas de segurança',
        start: {
          dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        location: 'Auditório Principal',
        attendees: [
          { email: 'caio.correia@groupabz.com', responseStatus: 'needsAction' }
        ],
        creator: {
          email: 'rh@groupabz.com',
          displayName: 'Recursos Humanos'
        },
        organizer: {
          email: 'rh@groupabz.com',
          displayName: 'Recursos Humanos'
        }
      },
      {
        id: 'event-3',
        summary: 'Avaliação de Desempenho',
        description: 'Reunião individual para avaliação de desempenho',
        start: {
          dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        location: 'Sala do Gerente',
        attendees: [
          { email: 'caio.correia@groupabz.com', responseStatus: 'tentative' }
        ],
        creator: {
          email: 'gerencia@groupabz.com',
          displayName: 'Gerência'
        },
        organizer: {
          email: 'gerencia@groupabz.com',
          displayName: 'Gerência'
        }
      }
    ];

    // Aplicar filtros de data se fornecidos
    let filteredEvents = mockEvents;
    
    if (timeMin) {
      const minDate = new Date(timeMin);
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.start.dateTime) >= minDate
      );
    }

    if (timeMax) {
      const maxDate = new Date(timeMax);
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.start.dateTime) <= maxDate
      );
    }

    // Limitar resultados
    filteredEvents = filteredEvents.slice(0, maxResults);

    console.log(`✅ ${filteredEvents.length} eventos encontrados`);

    return NextResponse.json({
      events: filteredEvents,
      total: filteredEvents.length,
      nextSyncToken: 'mock-sync-token',
      message: 'Eventos simulados - integração com Google Calendar em desenvolvimento'
    });

  } catch (error) {
    console.error('Erro ao buscar eventos do calendário:', error);
    return NextResponse.json({
      error: 'Erro interno ao buscar eventos',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      summary,
      description,
      start,
      end,
      location,
      attendees,
      reminders
    } = body;

    if (!userId || !summary || !start || !end) {
      return NextResponse.json({
        error: 'userId, summary, start e end são obrigatórios'
      }, { status: 400 });
    }

    console.log(`📅 Criando evento no calendário para usuário ${userId}`);

    // TODO: Buscar tokens do usuário e criar evento real no Google Calendar
    // Por enquanto, vamos simular a criação
    const mockEvent = {
      id: `event-${Date.now()}`,
      summary,
      description,
      start: {
        dateTime: start,
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: end,
        timeZone: 'America/Sao_Paulo'
      },
      location,
      attendees: attendees?.map((email: string) => ({
        email,
        responseStatus: 'needsAction'
      })) || [],
      creator: {
        email: 'caio.correia@groupabz.com',
        displayName: 'Sistema ABZ'
      },
      organizer: {
        email: 'caio.correia@groupabz.com',
        displayName: 'Sistema ABZ'
      },
      reminders: reminders || {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 }
        ]
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    console.log(`✅ Evento criado com sucesso: ${mockEvent.id}`);

    return NextResponse.json({
      message: 'Evento criado com sucesso',
      event: mockEvent,
      note: 'Evento simulado - integração com Google Calendar em desenvolvimento'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar evento no calendário:', error);
    return NextResponse.json({
      error: 'Erro interno ao criar evento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      eventId,
      summary,
      description,
      start,
      end,
      location,
      attendees
    } = body;

    if (!userId || !eventId) {
      return NextResponse.json({
        error: 'userId e eventId são obrigatórios'
      }, { status: 400 });
    }

    console.log(`📅 Atualizando evento ${eventId} para usuário ${userId}`);

    // TODO: Implementar atualização real no Google Calendar
    const updatedEvent = {
      id: eventId,
      summary: summary || 'Evento Atualizado',
      description,
      start: {
        dateTime: start,
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: end,
        timeZone: 'America/Sao_Paulo'
      },
      location,
      attendees: attendees?.map((email: string) => ({
        email,
        responseStatus: 'needsAction'
      })) || [],
      updated: new Date().toISOString()
    };

    console.log(`✅ Evento atualizado com sucesso: ${eventId}`);

    return NextResponse.json({
      message: 'Evento atualizado com sucesso',
      event: updatedEvent,
      note: 'Evento simulado - integração com Google Calendar em desenvolvimento'
    });

  } catch (error) {
    console.error('Erro ao atualizar evento no calendário:', error);
    return NextResponse.json({
      error: 'Erro interno ao atualizar evento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const eventId = searchParams.get('eventId');

    if (!userId || !eventId) {
      return NextResponse.json({
        error: 'userId e eventId são obrigatórios'
      }, { status: 400 });
    }

    console.log(`📅 Removendo evento ${eventId} para usuário ${userId}`);

    // TODO: Implementar remoção real no Google Calendar

    console.log(`✅ Evento removido com sucesso: ${eventId}`);

    return NextResponse.json({
      message: 'Evento removido com sucesso',
      eventId,
      note: 'Evento simulado - integração com Google Calendar em desenvolvimento'
    });

  } catch (error) {
    console.error('Erro ao remover evento do calendário:', error);
    return NextResponse.json({
      error: 'Erro interno ao remover evento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
