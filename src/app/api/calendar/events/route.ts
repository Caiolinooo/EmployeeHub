import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

const forbidden = () => NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });

function canActFor(user: AuthenticatedUser, ownerId: string | null | undefined, grants: readonly string[]) {
  return ownerId === user.id || canWithGrant(user.id, user.role, grants);
}

async function eventOwner(eventId: string): Promise<string | null | undefined> {
  const { data } = await supabaseAdmin.from('calendar_events').select('user_id').eq('id', eventId).maybeSingle();
  return data ? (data as { user_id: string | null }).user_id : undefined;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    if (!(await canActFor(user, userId, ['calendario.manage']))) return forbidden();

    let query = supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true })
      .limit(maxResults);

    if (timeMin) {
      query = query.gte('start_time', timeMin);
    }
    if (timeMax) {
      query = query.lte('start_time', timeMax);
    }

    const { data: events, error } = await query;

    if (error) {
      throw error;
    }

    // Map to Google Calendar format for compatibility
    const mappedEvents = events.map(event => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start_time, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: event.end_time, timeZone: 'America/Sao_Paulo' },
      location: event.location,
      attendees: event.attendees?.map((email: string) => ({ email, responseStatus: 'needsAction' })) || [],
      created: event.created_at,
      updated: event.updated_at
    }));

    return NextResponse.json({
      events: mappedEvents,
      total: mappedEvents.length
    });

  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar eventos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const { summary, description, start, end, location, attendees, reminders } = body;
    const userId = body.userId || user.id;

    if (!summary || !start || !end) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    if (!(await canActFor(user, userId, ['calendario.create', 'calendario.manage']))) return forbidden();

    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        user_id: userId,
        summary,
        description,
        start_time: start,
        end_time: end,
        location,
        attendees: attendees || [],
        reminders: reminders || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Evento criado com sucesso',
      event: {
        ...event,
        id: event.id
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return NextResponse.json({ error: 'Erro interno ao criar evento' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const { eventId, summary, description, start, end, location, attendees } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 });
    }

    const ownerId = await eventOwner(eventId);
    if (ownerId === undefined) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    if (!(await canActFor(user, ownerId, ['calendario.update', 'calendario.manage']))) return forbidden();

    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .update({
        summary,
        description,
        start_time: start,
        end_time: end,
        location,
        attendees,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Evento atualizado com sucesso',
      event
    });

  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar evento' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 });
    }

    const ownerId = await eventOwner(eventId);
    if (ownerId === undefined) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    if (!(await canActFor(user, ownerId, ['calendario.delete', 'calendario.manage']))) return forbidden();

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return NextResponse.json({ message: 'Evento removido com sucesso' });

  } catch (error) {
    console.error('Erro ao remover evento:', error);
    return NextResponse.json({ error: 'Erro interno ao remover evento' }, { status: 500 });
  }
}
