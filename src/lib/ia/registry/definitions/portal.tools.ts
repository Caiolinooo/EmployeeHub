/**
 * Ferramentas de navegação do AI Companion / Portal Action Bus + KPI boards
 */
import { registerTool } from '../tools-registry';
import type { IATool, IAToolResult } from '@/types/ia-global';
import type { AICommandPayload } from '../../portal-action-bus';
import { aliasToPath, buildNavCommand, resolvePortalNavigation } from '../../portal-navigation';
import {
  createKpiBoard,
  updateKpiBoard,
  listKpiBoards,
  getActiveKpiBoard,
  getKpiBoard,
  setActiveKpiBoard,
  buildOpenKpiBoardCommands,
  findUserBoard,
  deleteUserBoard,
  deleteAllUserBoards,
} from '../../kpi-board';

const navegarPortalTool: IATool = {
  id: 'portal_navegar',
  name: 'navegar_portal',
  description: 'Gera comando NAVIGATE para o AI Companion (typos/sinônimos ok)',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'navegar_portal',
    description: 'Navega o usuário para um módulo do portal (ex: ferias, reembolso, kpi, /kpi, tripulantes)',
    parameters: {
      type: 'object',
      properties: {
        destino: { type: 'string', description: 'Alias, frase ou path: ferias, reembolso, kpi, /kpi, tripulantes, academy, …', required: true },
        highlight: { type: 'string', description: 'CSS selector opcional', required: false },
      },
      required: ['destino'],
    },
  },
  handler: async (args): Promise<IAToolResult> => {
    const destino = String(args.destino || '').trim();
    if (!destino) return { success: false, error: 'destino obrigatório' };

    const match = resolvePortalNavigation(destino);
    const path = match && match.score >= 0.78 ? match.route.path : aliasToPath(destino);
    const commands: AICommandPayload[] = [
      match && match.score >= 0.78
        ? buildNavCommand(match)
        : { action: 'NAVIGATE', target: path, label: `Navegando para ${path}...` },
    ];
    if (args.highlight) {
      commands.push({
        action: 'HIGHLIGHT_ELEMENT',
        target: String(args.highlight),
        label: 'Destacando elemento',
      });
    }

    return {
      success: true,
      data: { path, commands, match },
    };
  },
};

const criarQuadroKpiTool: IATool = {
  id: 'portal_criar_quadro_kpi',
  name: 'criar_quadro_kpi',
  description: 'Cria quadro branco KPI persistido',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'criar_quadro_kpi',
    description: 'Cria quadro KPI (harness por role; html_sandbox só ADMIN). Sem HTML no origin do portal.',
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título do quadro KPI', required: true },
        spec: { type: 'object', description: 'Especificação do quadro (widgets, layout, dataSources)', required: true },
        abrir: { type: 'boolean', description: 'Se true, abre o quadro em /kpi após criar', required: false },
      },
      required: ['titulo', 'spec'],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const { board, error } = await createKpiBoard({
      userId: ctx.userId,
      title: String(args.titulo || 'Quadro KPI'),
      spec: args.spec,
      setActive: true,
      role: ctx.userRole,
    });
    if (!board) return { success: false, error: error || 'Falha ao criar' };
    const abrir = args.abrir !== false;
    const commands = abrir ? buildOpenKpiBoardCommands(board.id, board.title) : [];
    return {
      success: true,
      data: { board: { id: board.id, title: board.title }, commands },
    };
  },
};

const listarQuadrosKpiTool: IATool = {
  id: 'portal_listar_quadros_kpi',
  name: 'listar_quadros_kpi',
  description: 'Lista quadros KPI do usuário',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'listar_quadros_kpi',
    description: 'Lista quadros KPI',
    parameters: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Quantidade máxima de quadros a listar', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const boards = await listKpiBoards(ctx.userId, { limit: Number(args.limite) || 20 });
    return { success: true, data: { total: boards.length, boards } };
  },
};

const abrirQuadroKpiTool: IATool = {
  id: 'portal_abrir_quadro_kpi',
  name: 'abrir_quadro_kpi',
  description: 'Abre quadro KPI em /kpi',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'abrir_quadro_kpi',
    description: 'OPEN_KPI_BOARD + NAVIGATE /kpi',
    parameters: {
      type: 'object',
      properties: {
        board_id: { type: 'string', description: 'ID do quadro a abrir; vazio usa o quadro ativo', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    let board = null;
    const requested = String(args.board_id || '').trim();
    if (requested) {
      board = await setActiveKpiBoard(ctx.userId, requested);
      if (!board) board = await getKpiBoard(ctx.userId, requested);
    } else {
      board = await getActiveKpiBoard(ctx.userId);
    }
    if (!board) return { success: false, error: 'Nenhum quadro encontrado' };
    const commands = buildOpenKpiBoardCommands(board.id, board.title);
    return { success: true, data: { board: { id: board.id, title: board.title }, commands } };
  },
};

const atualizarQuadroKpiTool: IATool = {
  id: 'portal_atualizar_quadro_kpi',
  name: 'atualizar_quadro_kpi',
  description: 'Atualiza quadro KPI',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'atualizar_quadro_kpi',
    description: 'Atualiza quadro KPI existente',
    parameters: {
      type: 'object',
      properties: {
        board_id: { type: 'string', description: 'ID do quadro a atualizar', required: true },
        titulo: { type: 'string', description: 'Novo título do quadro', required: false },
        spec: { type: 'object', description: 'Nova especificação do quadro (widgets, layout)', required: false },
        abrir: { type: 'boolean', description: 'Se true, abre o quadro em /kpi após atualizar', required: false },
      },
      required: ['board_id'],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const { board, error } = await updateKpiBoard({
      userId: ctx.userId,
      boardId: String(args.board_id),
      title: args.titulo ? String(args.titulo) : undefined,
      spec: args.spec,
      setActive: true,
      role: ctx.userRole,
    });
    if (!board) return { success: false, error: error || 'Falha' };
    const abrir = args.abrir !== false;
    const commands = abrir ? buildOpenKpiBoardCommands(board.id, board.title) : [];
    return { success: true, data: { board: { id: board.id, title: board.title }, commands } };
  },
};

const excluirQuadroKpiTool: IATool = {
  id: 'portal_excluir_quadro_kpi',
  name: 'excluir_quadro_kpi',
  description: 'Soft-delete de um quadro KPI do usuário',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'excluir_quadro_kpi',
    description: 'Exclui quadro KPI (id e/ou titulo fuzzy). Só o dono.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do quadro a excluir', required: false },
        board_id: { type: 'string', description: 'Alias de id do quadro a excluir', required: false },
        titulo: { type: 'string', description: 'Título do quadro para busca fuzzy', required: false },
      },
      required: [],
    },
  },
  handler: async (args, ctx): Promise<IAToolResult> => {
    const id = String(args.id || args.board_id || '').trim();
    const titulo = args.titulo ? String(args.titulo).trim() : '';
    if (!id && !titulo) return { success: false, error: 'id ou titulo obrigatório' };
    const target = await findUserBoard(ctx.userId, { id, titulo });
    if (!target) return { success: false, error: 'Quadro não encontrado' };
    const result = await deleteUserBoard(ctx.userId, target.id);
    if (!result.ok) return { success: false, error: result.error };
    return {
      success: true,
      data: { deleted: { id: result.board.id, title: result.board.title } },
    };
  },
};

const excluirTodosQuadrosKpiTool: IATool = {
  id: 'portal_excluir_todos_quadros_kpi',
  name: 'excluir_todos_quadros_kpi',
  description: 'Soft-delete de todos os quadros KPI do usuário',
  module: 'portal',
  adminOnly: false,
  definition: {
    name: 'excluir_todos_quadros_kpi',
    description: 'Exclui todos os quadros KPI do usuário autenticado',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  handler: async (_args, ctx): Promise<IAToolResult> => {
    const result = await deleteAllUserBoards(ctx.userId);
    if (!result.ok) return { success: false, error: result.error };
    return {
      success: true,
      data: { deleted: result.deleted, boards: result.boards },
    };
  },
};

export async function registerTools() {
  registerTool(navegarPortalTool);
  registerTool(criarQuadroKpiTool);
  registerTool(atualizarQuadroKpiTool);
  registerTool(listarQuadrosKpiTool);
  registerTool(abrirQuadroKpiTool);
  registerTool(excluirQuadroKpiTool);
  registerTool(excluirTodosQuadrosKpiTool);
  console.log('[IA Tools] Portal/Companion loaded (7 tools)');
}
