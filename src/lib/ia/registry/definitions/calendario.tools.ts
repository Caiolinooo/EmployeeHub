/**
 * Ferramentas do Calendário (portal + Outlook)
 */
import { registerTool } from '../tools-registry';
import type { IATool, IAToolResult } from '@/types/ia-global';
import { supabaseAdmin } from '@/lib/supabase';
import { msGraphClient, resolveGraphLimit } from '../../microsoft/client';

const meuCalendarioTool: IATool = {
  id: 'cal_meu_calendario',
  name: 'meu_calendario',
  description: 'Eventos do calendário do usuário (portal + Graph)',
  module: 'calendario',
  adminOnly: false,
  definition: {
    name: 'meu_calendario',
    description: 'Lista eventos futuros/passados do usuário',
    parameters: {
      type: 'object',
      properties: {
        dias_futuros: { type: 'number', description: 'Dias à frente', required: false },
        dias_passados: { type: 'number', description: 'Dias atrás', required: false },
        limite: { type: 'number', description: 'Limite', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const daysFwd = Number(args.dias_futuros ?? 14);
    const daysBack = Number(args.dias_passados ?? 0);
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    const end = new Date();
    end.setDate(end.getDate() + daysFwd);
    const limit = resolveGraphLimit(args.limite as number | undefined, 50);

    const { data: portal } = await supabaseAdmin
      .from('calendar_events')
      .select('id, summary, start_time, end_time, location')
      .eq('user_id', ctx.userId)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true })
      .limit(limit);

    const { data: me } = await supabaseAdmin
      .from('users_unified')
      .select('email')
      .eq('id', ctx.userId)
      .maybeSingle();

    let outlook: any[] = [];
    if (me?.email) {
      try {
        outlook = await msGraphClient.listCalendarEvents(
          me.email,
          start.toISOString(),
          end.toISOString(),
          limit
        );
      } catch { /* ignore */ }
    }

    return {
      success: true,
      data: {
        portal: portal || [],
        outlook: outlook.map(e => ({
          titulo: e.subject,
          inicio: e.start?.dateTime,
          fim: e.end?.dateTime,
          local: e.location?.displayName,
        })),
      },
    };
  },
};

const criarEventoTool: IATool = {
  id: 'cal_criar_evento',
  name: 'criar_evento_calendario',
  description: 'Cria evento no calendário do portal',
  module: 'calendario',
  adminOnly: false,
  definition: {
    name: 'criar_evento_calendario',
    description: 'Cria evento (portal; opcional Outlook)',
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título', required: true },
        inicio: { type: 'string', description: 'Início ISO', required: true },
        fim: { type: 'string', description: 'Fim ISO', required: true },
        local: { type: 'string', description: 'Local', required: false },
        descricao: { type: 'string', description: 'Descrição', required: false },
        tambem_outlook: { type: 'boolean', description: 'Espelhar no Outlook', required: false },
      },
      required: ['titulo', 'inicio', 'fim'],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        user_id: ctx.userId,
        summary: args.titulo,
        description: args.descricao || null,
        start_time: args.inicio,
        end_time: args.fim,
        location: args.local || null,
        attendees: [],
        reminders: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, summary, start_time, end_time')
      .single();

    if (error) return { success: false, error: error.message };

    let outlook = null;
    if (args.tambem_outlook) {
      const { data: me } = await supabaseAdmin
        .from('users_unified')
        .select('email')
        .eq('id', ctx.userId)
        .maybeSingle();
      if (me?.email) {
        outlook = await msGraphClient.createCalendarEvent(me.email, {
          subject: String(args.titulo),
          start: String(args.inicio),
          end: String(args.fim),
          location: args.local as string | undefined,
          body: args.descricao as string | undefined,
        });
      }
    }

    return { success: true, data: { portal: data, outlook } };
  },
};

export async function registerTools() {
  registerTool(meuCalendarioTool);
  registerTool(criarEventoTool);
  console.log('[IA Tools] Calendário loaded (2 tools)');
}
