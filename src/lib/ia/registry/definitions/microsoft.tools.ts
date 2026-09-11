/**
 * Ferramentas Microsoft Graph (non-admin + pesquisa)
 */
import { registerTool } from '../tools-registry';
import type { IATool, IAToolResult } from '@/types/ia-global';
import { msGraphClient, resolveGraphLimit, GRAPH_HARD_CAP } from '../../microsoft/client';
import { supabaseAdmin } from '@/lib/supabase';
import { collectKpiCommunicationSignals } from '../../kpi-comms-signals';
import {
  buildEmailListPayload,
  enrichTeamsChats,
  enrichTeamsMessages,
} from '../../graph-comms-format';

async function resolveOwnEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users_unified')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  return data?.email || null;
}

const meusEmailsTool: IATool = {
  id: 'ms_meus_emails',
  name: 'meus_emails',
  description: 'Lista/pesquisa e-mails da própria caixa do usuário (detalhe completo)',
  module: 'microsoft',
  adminOnly: false,
  definition: {
    name: 'meus_emails',
    description:
      'E-mails da própria caixa com filtros flexíveis. Retorna datas ISO+pt-BR, remetente/destinatários, preview, pasta, webLink, status.',
    parameters: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Texto livre', required: false },
        de: { type: 'string', description: 'Remetente', required: false },
        assunto: { type: 'string', description: 'Assunto contém', required: false },
        data_inicio: { type: 'string', description: 'YYYY-MM-DD', required: false },
        data_fim: { type: 'string', description: 'YYYY-MM-DD', required: false },
        pasta: { type: 'string', description: 'inbox|sentitems|drafts|…', required: false },
        apenas_nao_lidos: { type: 'boolean', description: 'Se true, retorna só e-mails não lidos', required: false },
        com_anexos: { type: 'boolean', description: 'Se true, retorna só e-mails com anexo', required: false },
        incluir_corpo: { type: 'boolean', description: 'Corpo texto truncado', required: false },
        limite: { type: 'number', description: 'Limite (0=máx)', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const email = await resolveOwnEmail(ctx.userId);
    if (!email) return { success: false, error: 'E-mail não cadastrado' };
    const limit = resolveGraphLimit(args.limite as number | undefined, 50);
    const emails = await msGraphClient.searchEmails(email, args.consulta as string | undefined, {
      from: args.de as string | undefined,
      subject: args.assunto as string | undefined,
      dateFrom: args.data_inicio as string | undefined,
      dateTo: args.data_fim as string | undefined,
      folder: args.pasta as string | undefined,
      isRead: args.apenas_nao_lidos === true ? false : undefined,
      hasAttachments: args.com_anexos === true ? true : undefined,
      includeBody: !!args.incluir_corpo,
      top: limit,
    });
    return {
      success: true,
      data: buildEmailListPayload(emails, {
        includeBody: !!args.incluir_corpo,
        folderHint: args.pasta as string | undefined,
        limiteAplicado: limit,
        hardCap: GRAPH_HARD_CAP,
        maxItems: Math.min(limit, 50),
      }),
    };
  },
};

const minhasConversasTeamsTool: IATool = {
  id: 'ms_minhas_conversas_teams',
  name: 'minhas_conversas_teams',
  description: 'Chats/mensagens Teams do usuário (payload rico)',
  module: 'microsoft',
  adminOnly: false,
  definition: {
    name: 'minhas_conversas_teams',
    description: 'Lista chats ou pesquisa mensagens Teams com datas, participantes e preview',
    parameters: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Filtro de texto', required: false },
        limite: { type: 'number', description: 'Limite', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const email = await resolveOwnEmail(ctx.userId);
    if (!email) return { success: false, error: 'E-mail não cadastrado' };
    const limit = resolveGraphLimit(args.limite as number | undefined, 40);
    if (args.consulta) {
      const raw = await msGraphClient.searchTeamsMessages(email, {
        consulta: String(args.consulta),
        limite: limit,
      });
      return {
        success: true,
        data: {
          detalhe: 'completo',
          total: raw.length,
          mensagens: enrichTeamsMessages(raw, { maxItems: limit }),
        },
      };
    }
    const chats = await msGraphClient.listTeamsChats(email);
    return {
      success: true,
      data: {
        detalhe: 'completo',
        total: Math.min(chats.length, limit),
        chats: enrichTeamsChats(chats, limit),
      },
    };
  },
};

const sinaisKpiCommsTool: IATool = {
  id: 'ms_sinais_kpi_comms',
  name: 'buscar_sinais_kpi_comunicacao',
  description: 'Sinais de e-mail/Teams ligados a KPIs (detalhe completo)',
  module: 'microsoft',
  adminOnly: false,
  definition: {
    name: 'buscar_sinais_kpi_comunicacao',
    description: 'Varre e-mail e Teams por pendências/conclusões de KPI; retorna datas, ids, previews e links',
    parameters: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Janela em dias', required: false },
        limite: { type: 'number', description: 'Limite', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const email = await resolveOwnEmail(ctx.userId);
    if (!email) return { success: false, error: 'E-mail não cadastrado' };
    const data = await collectKpiCommunicationSignals({
      emailUsuario: email,
      dias: Number(args.dias) || 14,
      limite: resolveGraphLimit(args.limite as number | undefined, 30),
    });
    return { success: true, data };
  },
};

export async function registerTools() {
  registerTool(meusEmailsTool);
  registerTool(minhasConversasTeamsTool);
  registerTool(sinaisKpiCommsTool);
  console.log('[IA Tools] Microsoft loaded (3 tools)');
}
