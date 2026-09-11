/**
 * Ferramentas Chat / Teams
 */
import { registerTool } from '../tools-registry';
import type { IATool, IAToolResult } from '@/types/ia-global';
import { msGraphClient, resolveGraphLimit } from '../../microsoft/client';
import { supabaseAdmin } from '@/lib/supabase';
import { enrichTeamsMessages } from '../../graph-comms-format';

const pesquisarTeamsTool: IATool = {
  id: 'chat_pesquisar_teams',
  name: 'pesquisar_mensagens_teams',
  description: 'Pesquisa mensagens em conversas Teams (payload rico)',
  module: 'chat',
  adminOnly: false,
  definition: {
    name: 'pesquisar_mensagens_teams',
    description:
      'Busca texto em mensagens Teams. Retorna datas ISO+pt-BR, remetente, chat, preview/corpo truncado.',
    parameters: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Texto a buscar', required: true },
        limite: { type: 'number', description: 'Limite', required: false },
        email_usuario: { type: 'string', description: 'ADMIN: outro usuário', required: false },
      },
      required: ['consulta'],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    let mailbox = args.email_usuario as string | undefined;
    if (mailbox && ctx.userRole !== 'ADMIN') {
      return { success: false, error: 'Apenas ADMIN pode pesquisar outro usuário' };
    }
    if (!mailbox) {
      const { data } = await supabaseAdmin
        .from('users_unified')
        .select('email')
        .eq('id', ctx.userId)
        .maybeSingle();
      mailbox = data?.email || undefined;
    }
    if (!mailbox) return { success: false, error: 'E-mail não encontrado' };

    const limit = resolveGraphLimit(args.limite as number | undefined, 40);
    const mensagens = await msGraphClient.searchTeamsMessages(mailbox, {
      consulta: String(args.consulta),
      limite: limit,
    });
    return {
      success: true,
      data: {
        total: mensagens.length,
        detalhe: 'completo',
        mensagens: enrichTeamsMessages(mensagens, { maxItems: limit }),
      },
    };
  },
};

export async function registerTools() {
  registerTool(pesquisarTeamsTool);
  console.log('[IA Tools] Chat loaded (1 tool)');
}
