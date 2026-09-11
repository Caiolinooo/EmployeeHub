import { supabaseAdmin } from '@/lib/supabase';
import {
  canAccessModule,
  getAccessibleUserIdsForGlobal,
  getTeamMemberIds,
  resolveUserIdByIdentifier,
  canAccessUserData,
  getEffectiveRole
} from './permissions';
import {
  generateExcelReport,
  formatReembolsosForExcel,
  formatFeriasForExcel,
  formatAvaliacoesForExcel,
  formatUsuariosForExcel,
  formatEpisForExcel,
  formatPontoForExcel,
  formatComprasForExcel,
  formatEventosForExcel,
  formatCursosForExcel,
} from './excel-generator';
import { generatePDFBase64 } from './pdf-generator';
import { sendReportEmail, sendSimpleEmail, sendEmailWithNodemailer } from './email-tool';
import { msGraphClient, resolveGraphLimit, GRAPH_HARD_CAP } from './microsoft/client';
import {
  buildEmailListPayload,
  enrichTeamsChats,
  enrichTeamsMessages,
  GRAPH_EMAIL_SELECT_LIST,
} from './graph-comms-format';
import {
  executeGlobalSearchQuery,
  fetchAssociatedUsers,
  formatGlobalResponse
} from './query-helpers';
import { collectHolisticForUser } from './holistic-aggregator';
import { createEPIRegistration, updateEPIRegistration } from '@/services/epiService';
import { getStockLevels, getLowStockAlerts } from '@/services/epiStockService';
import { overlayStatusEscalaHoje, listarColaboradoresDashboardAtivos } from '@/lib/gestao-tripulantes/dashboard-service';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { listarDocumentosAlertas } from '@/lib/gestao-tripulantes/documentos-alertas';
import {
  aliasToPath,
  buildNavCommand,
  resolvePortalNavigation,
} from './portal-navigation';
import { normalizeLeaveStatus } from '@/lib/leaveExport';

// Definição da interface das ferramentas para a OpenAI / LM Studio
export const IA_TOOLS_DEFINITION = [
  {
    type: 'function',
    function: {
      name: 'buscar_funcionario',
      description: 'Busca as informações de perfil básico de um funcionário pelo nome ou email',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome, sobrenome ou e-mail do funcionário para buscar',
          },
        },
        required: ['busca'],
      },
    },
// sem requireModule, liberado para todos (respeitando RBAC de dados)
  },
  {
    type: 'function',
    function: {
      name: 'buscar_dados_usuario',
      description: 'Busca dados de um funcionário de forma integrada (férias, reembolsos, calendário, EPIs, avaliações). Use "meu" para seus próprios dados, ou informe email/nome para outro usuário. Respeita permissões (USER vê só próprio, GERENTE vê equipe, ADMIN vê todos).',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['ferias', 'reembolsos', 'eventos', 'epis', 'avaliacoes', 'resumo', 'todos'],
            description: 'Tipo de dado a buscar: ferias, reembolsos, eventos, epis, avaliacoes, resumo (todas pendências), todos (completo)',
          },
          usuario: {
            type: 'string',
            description: 'Identificador do usuário: "meu" para próprio, email, nome, ou CPF',
          },
        },
        required: ['tipo'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_usuarios_global',
      description: 'Lista todos os usuários do sistema com filtros. Use esta ferramenta para ver todos os colaboradores. ADMIN vê todos, GERENTE vê apenas sua equipe.',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Filtrar por departamento' },
          role: { type: 'string', description: 'Filtrar por role (ADMIN, USER, GERENTE)' },
          status: { type: 'string', description: 'Filtrar por status (active, inactive, pending)' },
          busca: { type: 'string', description: 'Buscar por nome ou email' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 50, máx: 200)' },
          ordenar_por: { type: 'string', enum: ['nome', 'department', 'created_at'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'render_dashboard',
      description:
        'Renderiza e persiste um dashboard/quadro KPI (widgets metric|table|list|chart|markdown) e abre /kpi. Use para alterar o que aparece no módulo KPI. NÃO gere HTML/JS para o usuário copiar ou salvar .html fora do portal.',
      parameters: {
        type: 'object',
        properties: {
          layout: {
            type: 'object',
            properties: {
              columns: { type: 'number', description: 'Número de colunas (1-3)' },
              widgets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['metric', 'table', 'list', 'chart', 'markdown'] },
                    title: { type: 'string' },
                    data: { type: 'object', description: 'Dados específicos para o widget' }
                  },
                  required: ['id', 'type', 'data']
                }
              }
            },
            required: ['widgets']
          },
          persistir_quadro: {
            type: 'boolean',
            description: 'Se true (padrão no Companion), salva o layout como quadro KPI e abre /kpi',
          },
          titulo_quadro: { type: 'string', description: 'Título do quadro KPI ao persistir' },
        },
        required: ['layout']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'criar_quadro_kpi',
      description:
        'Cria um quadro branco KPI persistido em /kpi. Widgets: metric|table|list|chart|markdown (+ html_sandbox só ADMIN). Harness por role: USER/MANAGER só trabalho (sem jogos/HTML); ADMIN pode sandbox HTML. NÃO dump HTML nem peça salvar .html. Após criar, use abrir_quadro_kpi.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título do quadro' },
          spec: {
            type: 'object',
            description:
              'BoardSpec { version:1, columns?, widgets:[{id,type,title,data?,dataSource?}] }. html_sandbox: data.srcdoc (ADMIN).',
          },
          abrir: { type: 'boolean', description: 'Se true (padrão), emite OPEN_KPI_BOARD + NAVIGATE /kpi' },
        },
        required: ['titulo', 'spec'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_quadro_kpi',
      description: 'Atualiza título/spec de um quadro KPI existente do usuário.',
      parameters: {
        type: 'object',
        properties: {
          board_id: { type: 'string', description: 'UUID do quadro' },
          titulo: { type: 'string' },
          spec: { type: 'object', description: 'Novo BoardSpec completo' },
          abrir: { type: 'boolean', description: 'Abrir /kpi após atualizar' },
        },
        required: ['board_id'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'listar_quadros_kpi',
      description: 'Lista os quadros KPI (quadro branco) do usuário autenticado.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'number', description: 'Máximo (padrão 20)' },
        },
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'abrir_quadro_kpi',
      description:
        'Define o quadro ativo e emite OPEN_KPI_BOARD + NAVIGATE /kpi para o Companion abrir a página KPI.',
      parameters: {
        type: 'object',
        properties: {
          board_id: { type: 'string', description: 'UUID do quadro (omitir = ativo/mais recente)' },
        },
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'excluir_quadro_kpi',
      description:
        'Exclui (soft-delete) um quadro KPI do usuário. Use quando pedir apagar/remover/limpar um quadro (ex.: Pac-Man). Informe id e/ou titulo (fuzzy). Só o próprio dono. Nunca diga que exclusão é indisponível.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID do quadro (preferencial)' },
          board_id: { type: 'string', description: 'Alias de id' },
          titulo: { type: 'string', description: 'Título aproximado para fuzzy match se id omitido' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'excluir_todos_quadros_kpi',
      description:
        'Exclui (soft-delete) TODOS os quadros KPI do usuário autenticado. Use para "apague todos", "limpe os KPI", "remova todos os quadros".',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_reembolsos_global',
      description: 'Lista todos os reembolsos do sistema com filtros. ADMIN vê todos, GERENTE vê apenas da equipe.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status: PENDING, APPROVED, REJECTED' },
          data_inicio: { type: 'string', description: 'Data inicial (YYYY-MM-DD)' },
          data_fim: { type: 'string', description: 'Data final (YYYY-MM-DD)' },
          departamento: { type: 'string', description: 'Filtrar por departamento do usuário' },
          categoria: { type: 'string', description: 'Filtrar por categoria do reembolso' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 100, máx: 500)' },
          ordenar_por: { type: 'string', enum: ['data', 'valor_total', 'status'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
          agrupar_por: { type: 'string', enum: ['status', 'departamento', 'categoria'], description: 'Agrupar resultados' },
          incluir_totais: { type: 'boolean', description: 'Incluir totais por grupo' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ferias_global',
      description:
        'Lista solicitações de férias com filtros (histórico incluso por padrão). ADMIN vê todos; GERENTE/MANAGER vê equipe. Status: PENDING_LEADER|PENDING_MANAGER|APPROVED|REJECTED|CANCELLED.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'PENDING_LEADER, PENDING_MANAGER, APPROVED, REJECTED, CANCELLED (ou aliases pt)',
          },
          ano: { type: 'number', description: 'Ano do gozo (start_date), ex. 2024' },
          incluir_historico: {
            type: 'boolean',
            description: 'true (padrão) inclui passado; false só fim >= hoje',
          },
          data_inicio: { type: 'string', description: 'Data inicial start_date (YYYY-MM-DD)' },
          data_fim: { type: 'string', description: 'Data final end_date (YYYY-MM-DD)' },
          departamento: { type: 'string', description: 'Filtrar por departamento' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 100, máx: 500)' },
          ordenar_por: { type: 'string', enum: ['start_date', 'created_at', 'status'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
          agrupar_por: { type: 'string', enum: ['status', 'departamento'], description: 'Agrupar resultados' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ponto_global',
      description: 'Lista registros de ponto de todos os usuários com filtros. ADMIN vê todos, GERENTE vê apenas da equipe.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data específica (YYYY-MM-DD)' },
          data_inicio: { type: 'string', description: 'Data inicial do período' },
          data_fim: { type: 'string', description: 'Data final do período' },
          departamento: { type: 'string', description: 'Filtrar por departamento' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 100, máx: 500)' },
          ordenar_por: { type: 'string', enum: ['date', 'user_id'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_avaliacoes_global',
      description: 'Lista todas as avaliações de desempenho com filtros. ADMIN vê todos, GERENTE vê apenas da equipe.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status: pendente, pendente_autoavaliacao, aguardando_aprovacao, aprovado' },
          periodo: { type: 'string', description: 'Filtrar por período/ano' },
          departamento: { type: 'string', description: 'Filtrar por departamento' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 50, máx: 200)' },
          ordenar_por: { type: 'string', enum: ['created_at', 'nota_final', 'status'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
          agrupar_por: { type: 'string', enum: ['status', 'periodo_id', 'departamento'], description: 'Agrupar resultados' },
          incluir_totais: { type: 'boolean', description: 'Incluir totais e médias por grupo' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_epis_global',
      description: 'Lista todos os EPIs distribuídos com filtros. ADMIN vê todos, GERENTE vê apenas da equipe.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status: active, returned, expired' },
          tipo: { type: 'string', description: 'Filtrar por tipo de EPI' },
          departamento: { type: 'string', description: 'Filtrar por departamento' },
          data_inicio: { type: 'string', description: 'Data inicial de entrega' },
          data_fim: { type: 'string', description: 'Data final de entrega' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 100, máx: 500)' },
          ordenar_por: { type: 'string', enum: ['delivery_date', 'user_id', 'status'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
          agrupar_por: { type: 'string', enum: ['status', 'tipo', 'departamento'], description: 'Agrupar resultados' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_compras_global',
      description: 'Lista todas as solicitações e pedidos de compra com filtros. ADMIN vê todos, GERENTE vê apenas da equipe.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['requests', 'orders'], description: 'Tipo: requests (solicitações) ou orders (pedidos)' },
          status: { type: 'string', description: 'Filtrar por status' },
          data_inicio: { type: 'string', description: 'Data inicial' },
          data_fim: { type: 'string', description: 'Data final' },
          departamento: { type: 'string', description: 'Filtrar por departamento' },
          limite: { type: 'number', description: 'Limite de resultados (padrão: 50, máx: 200)' },
          ordenar_por: { type: 'string', enum: ['created_at', 'total_amount', 'status'], description: 'Campo para ordenação' },
          ordem: { type: 'string', enum: ['asc', 'desc'], description: 'Ordem (asc/desc)' },
          agrupar_por: { type: 'string', enum: ['status', 'departamento'], description: 'Agrupar resultados' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'gerar_planilha_excel',
      description: 'Gera uma planilha Excel com os dados filtrados. Pode enviar por email ou retornar base64.',
      parameters: {
        type: 'object',
        properties: {
          tipo_dados: {
            type: 'string',
            enum: ['reembolsos', 'ferias', 'ponto', 'avaliacoes', 'epis', 'compras', 'usuarios', 'eventos', 'cursos'],
            description: 'Tipo de dados para a planilha',
          },
          filtros: { type: 'object', description: 'Filtros para os dados (mesmos filtros das ferramentas *_global)' },
          titulo: { type: 'string', description: 'Título da planilha' },
          destino: { type: 'string', enum: ['download', 'email'], description: 'Destination: download (base64) ou email' },
          email_destino: { type: 'string', description: 'Email para enviar a planilha (se destino=email)' },
        },
        required: ['tipo_dados', 'destino'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'gerar_relatorio_pdf',
      description: 'Gera um relatório em PDF com os dados filtrados, formatado com o padrão ABZ Group.',
      parameters: {
        type: 'object',
        properties: {
          tipo_dados: {
            type: 'string',
            enum: ['reembolsos', 'ferias', 'ponto', 'avaliacoes', 'epis', 'compras', 'usuarios', 'resumo'],
            description: 'Tipo de dados para o relatório',
          },
          filtros: { type: 'object', description: 'Filtros para os dados' },
          titulo: { type: 'string', description: 'Título do relatório' },
          periodo: { type: 'object', properties: { inicio: { type: 'string' }, fim: { type: 'string' } }, description: 'Período do relatório' },
          incluir_graficos: { type: 'boolean', description: 'Incluir gráficos no PDF' },
          destino: { type: 'string', enum: ['download', 'email'], description: 'Destination: download (base64) ou email' },
          email_destino: { type: 'string', description: 'Email para enviar o relatório (se destino=email)' },
        },
        required: ['tipo_dados', 'destino'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'enviar_email_relatorio',
      description: 'Envia um email com relatório ou dados anexados. Suporta enviar por Microsoft Graph.',
      parameters: {
        type: 'object',
        properties: {
          para: { type: 'string', description: 'Email do destinatário' },
          assunto: { type: 'string', description: 'Assunto do email' },
          corpo: { type: 'string', description: 'Corpo do email (pode ser HTML)' },
          anexo_tipo: { type: 'string', enum: ['xlsx', 'pdf', 'csv', 'json'], description: 'Tipo do anexo' },
          dados_anexo: { type: 'object', description: 'Dados a incluir no anexo (será gerado automaticamente)' },
          titulo_anexo: { type: 'string', description: 'Nome do arquivo anexo' },
        },
        required: ['para', 'assunto', 'corpo'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'analisar_tendencias',
      description: 'Analisa tendências e gera insights sobre os dados. Identifica padrões e sugere ações.',
      parameters: {
        type: 'object',
        properties: {
          tipo_analise: {
            type: 'string',
            enum: ['reembolsos', 'ferias', 'avaliacoes', 'epis', 'geral'],
            description: 'Tipo de análise a realizar',
          },
          periodo: { type: 'string', description: 'Período para análise (últimos 30 dias, último mês, etc)' },
          grupo: { type: 'string', enum: ['departamento', 'status', 'categoria'], description: 'Agrupar análise por' },
        },
        required: ['tipo_analise'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ferias',
      description:
        'Busca solicitações de férias (inclui histórico/passado por padrão). Sem funcionario_id usa o usuário logado. Use ano / status / incluir_historico para filtrar.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: {
            type: 'string',
            description: 'UUID do funcionário (opcional — padrão = usuário autenticado)',
          },
          status: {
            type: 'string',
            description:
              'Filtro: PENDING_LEADER, PENDING_MANAGER, APPROVED, REJECTED, CANCELLED (aliases: aprovado, pendente)',
          },
          ano: {
            type: 'number',
            description: 'Ano do gozo (start_date), ex. 2025 para férias do ano passado',
          },
          incluir_historico: {
            type: 'boolean',
            description:
              'true (padrão) = inclui passadas/aprovadas/concluídas; false = só períodos com fim >= hoje',
          },
          limite: { type: 'number', description: 'Máximo de registros (padrão 50, máx 100)' },
        },
        required: [],
      },
    },
    requireModule: 'ferias',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_reembolsos',
      description:
        'Busca reembolsos. Sem identificador usa o usuário logado ("meus reembolsos"). Aceita funcionario_id, cpf ou email.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: {
            type: 'string',
            description: 'UUID do funcionário (opcional — padrão = usuário autenticado)',
          },
          cpf: { type: 'string', description: 'CPF alternativo para resolver o usuário' },
          email: { type: 'string', description: 'E-mail alternativo para resolver o usuário' },
          status: {
            type: 'string',
            description: 'Filtro opcional: pendente, aprovado, rejeitado, pago',
          },
          limite: { type: 'number', description: 'Máximo de registros (padrão 50)' },
        },
        required: [],
      },
    },
    requireModule: 'reembolso',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_escala_mio',
      description: 'Busca a escala/embarques de um funcionário no banco local (gt_historico_embarques). Não consulta a API MIO.',
      parameters: {
        type: 'object',
        properties: {
          cpf: {
            type: 'string',
            description: 'CPF do funcionário para buscar a escala (apenas números)',
          },
        },
        required: ['cpf'],
      },
    },
    requireModule: 'man-schedule',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_treinamentos_mio',
      description: 'Busca treinamentos e vencimentos de um funcionário no banco local (gt_documentos). Não consulta a API MIO.',
      parameters: {
        type: 'object',
        properties: {
          cpf: {
            type: 'string',
            description: 'CPF do funcionário (apenas números)',
          },
        },
        required: ['cpf'],
      },
    },
    requireModule: 'man-schedule',
  },
  {
    type: 'function',
    function: {
      name: 'ler_email_funcionario',
      description: 'Lê e-mails da caixa corporativa de um funcionário via Microsoft Graph. Aplica filtros conforme a solicitação (remetente, assunto, período, pasta, anexos, lidos). Use limite=0 para trazer o máximo disponível (até 1000). Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {
          email_corporativo: {
            type: 'string',
            description: 'E-mail corporativo completo do funcionário (@groupabz.com)',
          },
          consulta: { type: 'string', description: 'Texto livre para busca (assunto/corpo)' },
          de: { type: 'string', description: 'Filtrar por e-mail do remetente' },
          para: { type: 'string', description: 'Filtrar por destinatário' },
          assunto: { type: 'string', description: 'Filtrar por assunto (contém)' },
          data_inicio: { type: 'string', description: 'Data início YYYY-MM-DD' },
          data_fim: { type: 'string', description: 'Data fim YYYY-MM-DD' },
          pasta: { type: 'string', description: 'Pasta: inbox, sentitems, drafts, deleteditems' },
          apenas_nao_lidos: { type: 'boolean', description: 'Se true, só não lidos' },
          com_anexos: { type: 'boolean', description: 'Se true, só com anexos' },
          incluir_corpo: { type: 'boolean', description: 'Se true, inclui trecho do corpo completo' },
          limite: { type: 'number', description: 'Qtd. máxima. Padrão 50. Use 0 para máximo (1000).' },
        },
        required: ['email_corporativo'],
      },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_epis',
      description: 'Busca a lista de Equipamentos de Proteção Individual (EPIs) vinculados a um funcionário.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: {
            type: 'string',
            description: 'ID (UUID) do funcionário',
          },
        },
        required: ['funcionario_id'],
      },
    },
    requireModule: 'epi',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_avaliacoes_desempenho',
      description: 'Busca o histórico de avaliações de desempenho de um funcionário.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: {
            type: 'string',
            description: 'ID (UUID) do funcionário',
          },
        },
        required: ['funcionario_id'],
      },
    },
    requireModule: 'avaliacao',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_documento_corporativo',
      description: 'Busca documentos corporativos (manuais, políticas, procedimentos) pela biblioteca do portal por título ou categoria.',
      parameters: {
        type: 'object',
        properties: {
          termo_pesquisa: {
            type: 'string',
            description: 'Termo de busca para o título ou descrição do documento',
          },
          categoria: {
            type: 'string',
            description: 'Categoria opcional para filtrar (ex: "politica", "manual", "procedimento")',
          },
        },
        required: ['termo_pesquisa'],
      },
    },
    requireModule: 'biblioteca',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_noticias_recentes',
      description: 'Busca as últimas notícias corporativas publicadas no portal da ABZ Group.',
      parameters: {
        type: 'object',
        properties: {
          limite: {
            type: 'number',
            description: 'Número máximo de notícias a retornar (padrão: 5)',
          },
        },
        required: [],
      },
    },
    // sem requireModule — notícias são visíveis para todos
  },
  {
    type: 'function',
    function: {
      name: 'buscar_eventos_calendario',
      description: 'Busca os próximos eventos do calendário corporativo. Pode usar email ou ID do usuário.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email corporativo do usuário (ex: nome@groupabz.com). Use em vez do ID.',
          },
          dias_futuros: {
            type: 'number',
            description: 'Quantidade de dias a frente para buscar eventos (padrão: 7)',
          },
        },
        required: ['email'],
      },
    },
    // sem requireModule — calendário é geral
  },
  {
    type: 'function',
    function: {
      name: 'buscar_kpis_sistema',
      description:
        'KPIs do portal: ADMIN vê totais globais + opcional scan e-mail/Teams; MANAGER/USER recebem escopo pessoal/equipe (pendências acessíveis). Preferir buscar_dados_usuario(tipo=resumo) para "minhas pendências".',
      parameters: {
        type: 'object',
        properties: {
          incluir_comunicacao: {
            type: 'boolean',
            description: 'Se true (padrão quando há pendências), pesquisa e-mails e conversas Teams relacionados (ADMIN)',
          },
          email_monitoramento: {
            type: 'string',
            description: 'Mailbox a monitorar no Graph (padrão: e-mail do usuário logado)',
          },
          dias: { type: 'number', description: 'Janela de dias para scan de comunicação (padrão: 14)' },
          limite_sinais: { type: 'number', description: 'Máx. sinais por fonte (padrão: 25)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'verificar_falhas_integracao_erp',
      description: 'Verifica falhas recentes nas integrações do portal (MIO, Poliweb, etc). Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_solicitacoes_compra',
      description: 'Busca solicitações de compra do usuário ou gerais se for administrador.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filtrar por status (ex: "pending", "approved", "rejected")',
          },
          limite: {
            type: 'number',
            description: 'Limite de resultados (padrão: 5)',
          },
        },
        required: [],
      },
    },
    requireModule: 'compras',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_pedidos_compra',
      description: 'Busca pedidos de compra realizados.',
      parameters: {
        type: 'object',
        properties: {
          limite: {
            type: 'number',
            description: 'Limite de resultados (padrão: 5)',
          },
        },
        required: [],
      },
    },
    requireModule: 'compras',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_fornecedores',
      description: 'Pesquisa fornecedores cadastrados no sistema por nome ou categoria.',
      parameters: {
        type: 'object',
        properties: {
          termo: {
            type: 'string',
            description: 'Nome ou categoria do fornecedor',
          },
        },
        required: ['termo'],
      },
    },
    requireModule: 'compras',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_cursos_disponiveis',
      description: 'Lista os cursos disponíveis na Academy.',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Filtrar por categoria de curso',
          },
        },
        required: [],
      },
    },
    requireModule: 'academy',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_progresso_academy',
      description: 'Busca o progresso do usuário logado nos cursos da Academy.',
      parameters: {
        type: 'object',
        properties: {
          curso_id: {
            type: 'string',
            description: 'ID opcional de um curso específico para ver o detalhe do progresso',
          },
        },
        required: [],
      },
    },
    requireModule: 'academy',
  },
  // =====================================================
  // Microsoft Graph - Novas Ferramentas por Categoria
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'listar_contatos_outlook',
      description: 'Lista contatos do Outlook de um usuário. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        email: { type: 'string', description: 'Email corporativo do usuário' },
        limite: { type: 'number', description: 'Limite de resultados (padrão: 20)' },
      }, required: ['email'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_grupos_365',
      description: 'Lista grupos do Microsoft 365 da organização. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        limite: { type: 'number', description: 'Limite de resultados (padrão: 50)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_membros_grupo',
      description: 'Lista membros de um grupo do Microsoft 365. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        grupo_id: { type: 'string', description: 'ID do grupo' },
      }, required: ['grupo_id'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_info_organizacao',
      description: 'Busca informações da organização (domínios, país, etc). Apenas ADMIN.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_alertas_seguranca',
      description: 'Lista alertas de segurança do Microsoft 365. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        limite: { type: 'number', description: 'Limite de alertas (padrão: 20)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_incidentes_seguranca',
      description: 'Lista incidentes de segurança. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        limite: { type: 'number', description: 'Limite (padrão: 10)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_logs_auditoria',
      description: 'Busca logs de auditoria e sign-ins do Azure AD. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        tipo: { type: 'string', enum: ['audit', 'signin'], description: 'Tipo: audit (auditoria) ou signin (logins)' },
        limite: { type: 'number', description: 'Limite (padrão: 20)' },
      }, required: ['tipo'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'listar_aplicacoes_azure',
      description: 'Lista aplicações registradas no Azure AD. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        limite: { type: 'number', description: 'Limite (padrão: 50)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'listar_dispositivos',
      description: 'Lista dispositivos gerenciados pelo Azure AD. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        limite: { type: 'number', description: 'Limite (padrão: 50)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_sites_sharepoint',
      description: 'Busca/lista sites do SharePoint. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        busca: { type: 'string', description: 'Termo de busca (opcional)' },
      }, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'listar_cadernos_onenote',
      description: 'Lista cadernos do OneNote de um usuário. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        email: { type: 'string', description: 'Email do usuário' },
      }, required: ['email'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_tarefas_todo',
      description: 'Lista listas de tarefas do Microsoft To Do de um usuário. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        email: { type: 'string', description: 'Email do usuário' },
      }, required: ['email'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_reunioes_online',
      description: 'Lista reuniões online (Teams meetings) de um usuário. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        email: { type: 'string', description: 'Email do usuário' },
      }, required: ['email'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_canais_teams',
      description: 'Lista canais de uma equipe do Teams. Apenas ADMIN.',
      parameters: { type: 'object', properties: {
        team_id: { type: 'string', description: 'ID da equipe (team)' },
      }, required: ['team_id'] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_status_servicos_365',
      description: 'Verifica o status de saúde dos serviços Microsoft 365 e incidentes ativos. Apenas ADMIN.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_reviews_acesso',
      description: 'Lista access reviews de governança de identidade. Apenas ADMIN.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    adminOnly: true,
  },
  // =====================================================
  // AGENTE PROATIVO — Novas ferramentas
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'pesquisar_emails_outlook',
      description: 'Busca avançada de e-mails no Outlook via Microsoft Graph. Filtra por remetente, destinatário, assunto, data, pasta, anexos e texto livre. Extraia conforme o pedido do usuário: se pedir "tudo" use limite=0 (até 1000); se pedir de um remetente específico, use o filtro "de".',
      parameters: {
        type: 'object',
        properties: {
          email_usuario: { type: 'string', description: 'E-mail do usuário cujos e-mails serão pesquisados' },
          consulta: { type: 'string', description: 'Texto livre para busca nos e-mails (assunto e corpo)' },
          de: { type: 'string', description: 'Filtrar por remetente (e-mail)' },
          para: { type: 'string', description: 'Filtrar por destinatário (e-mail)' },
          assunto: { type: 'string', description: 'Filtrar por assunto (contém)' },
          data_inicio: { type: 'string', description: 'Data início (YYYY-MM-DD)' },
          data_fim: { type: 'string', description: 'Data fim (YYYY-MM-DD)' },
          pasta: { type: 'string', description: 'Pasta específica (inbox, sentitems, drafts)' },
          apenas_nao_lidos: { type: 'boolean', description: 'Se true, apenas não lidos' },
          com_anexos: { type: 'boolean', description: 'Se true, apenas com anexos' },
          incluir_corpo: { type: 'boolean', description: 'Se true, inclui trecho do corpo' },
          limite: { type: 'number', description: 'Quantidade máxima (padrão: 50, máx: 1000). Use 0 para máximo.' },
        },
        required: ['email_usuario'],
      },
    },
    adminOnly: true,
    featureToggle: 'email_search',
  },
  {
    type: 'function',
    function: {
      name: 'enviar_email_outlook',
      description: 'Envia um e-mail via conta corporativa do Microsoft 365 (Outlook). Permite enviar e-mails em nome do usuário usando a API Graph.',
      parameters: {
        type: 'object',
        properties: {
          email_remetente: { type: 'string', description: 'E-mail do remetente (quem envia)' },
          destinatarios: { type: 'string', description: 'E-mails dos destinatários separados por vírgula' },
          assunto: { type: 'string', description: 'Assunto do e-mail' },
          corpo: { type: 'string', description: 'Corpo do e-mail em HTML' },
          copia: { type: 'string', description: 'E-mails em cópia (CC) separados por vírgula' },
        },
        required: ['email_remetente', 'destinatarios', 'assunto', 'corpo'],
      },
    },
    adminOnly: true,
    featureToggle: 'email_send',
  },
  {
    type: 'function',
    function: {
      name: 'criar_nota_corporativa',
      description: 'Cria uma nota no OneNote corporativo ou uma tarefa no Microsoft To Do do usuário.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['onenote', 'todo'], description: 'Tipo: onenote (criar página) ou todo (criar tarefa)' },
          email_usuario: { type: 'string', description: 'E-mail do usuário no Microsoft 365' },
          titulo: { type: 'string', description: 'Título da nota ou tarefa' },
          conteudo: { type: 'string', description: 'Conteúdo da nota (HTML) ou descrição da tarefa' },
          data_vencimento: { type: 'string', description: 'Data de vencimento para tarefas To Do (YYYY-MM-DD)' },
          importancia: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Importância da tarefa' },
        },
        required: ['tipo', 'email_usuario', 'titulo'],
      },
    },
    adminOnly: false,
    featureToggle: 'onenote_create',
  },
  {
    type: 'function',
    function: {
      name: 'agendar_tarefa_agente',
      description: 'Agenda uma tarefa de monitoramento periódico para o agente IA. Pode ser verificação de KPIs, lembretes ou prompts customizados. Use expressões cron para definir a frequência.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome descritivo da tarefa' },
          tipo: { type: 'string', enum: ['kpi_check', 'reminder', 'report', 'custom'], description: 'Tipo: kpi_check (monitorar KPIs), reminder (lembrete), report (gerar relatório), custom (prompt livre)' },
          prompt: { type: 'string', description: 'Instrução/mensagem do que o agente deve fazer ou enviar' },
          cron: { type: 'string', description: 'Expressão cron (ex: "50 7 * * 1-5" para 7:50 seg-sex, "0 14 * * 1-5" para 14:00 seg-sex)' },
          usuarios_alvo: { type: 'string', description: 'IDs ou e-mails dos usuários alvo separados por vírgula (opcional)' },
          roles_alvo: { type: 'string', description: 'Roles dos usuários alvo: ADMIN, GERENTE, USER (separados por vírgula)' },
          canais: { type: 'string', description: 'Canais de notificação: push, email, portal (separados por vírgula). Padrão: push,email' },
          max_execucoes: { type: 'number', description: 'Número máximo de execuções (opcional, sem limite se omitido)' },
        },
        required: ['nome', 'tipo', 'prompt', 'cron'],
      },
    },
    adminOnly: true,
    featureToggle: 'scheduled_tasks',
  },
  {
    type: 'function',
    function: {
      name: 'analisar_kpis_negocio',
      description: 'Analisa KPIs vs metas e, se houver anomalias/pendências, pesquisa e-mails e Teams por sinais de aprovação, conclusão ou cobrança. Use incluir_comunicacao=true para forçar o scan Graph.',
      parameters: {
        type: 'object',
        properties: {
          departamento: { type: 'string', description: 'Filtrar análise por departamento específico (opcional)' },
          tipo_kpi: { type: 'string', enum: ['performance', 'solucoes', 'todos'], description: 'Tipo de KPI: performance (avaliações), solucoes (ações/entregas), todos' },
          incluir_comunicacao: { type: 'boolean', description: 'Incluir scan de e-mail/Teams (padrão: true se houver anomalias)' },
          email_monitoramento: { type: 'string', description: 'Mailbox Graph a monitorar (padrão: e-mail do usuário)' },
          dias: { type: 'number', description: 'Janela de dias para comunicação (padrão: 14)' },
        },
        required: [],
      },
    },
    adminOnly: false,
    featureToggle: 'kpi_analysis',
  },
  {
    type: 'function',
    function: {
      name: 'enviar_notificacao_proativa',
      description: 'Envia uma notificação proativa para um ou mais usuários via push, e-mail e/ou popup do portal. Use para lembretes, alertas e acompanhamento de tarefas.',
      parameters: {
        type: 'object',
        properties: {
          usuarios: { type: 'string', description: 'IDs dos usuários alvo separados por vírgula' },
          titulo: { type: 'string', description: 'Título da notificação' },
          mensagem: { type: 'string', description: 'Corpo da mensagem' },
          canais: { type: 'string', description: 'Canais: push, email, portal (separados por vírgula). Padrão: push,portal' },
          prioridade: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Prioridade da notificação' },
          url_acao: { type: 'string', description: 'URL para redirecionar o usuário ao clicar (opcional)' },
        },
        required: ['usuarios', 'titulo', 'mensagem'],
      },
    },
    adminOnly: false,
    featureToggle: 'proactive_notifications',
  },
   {
      type: 'function',
      function: {
        name: 'gerenciar_base_conhecimento',
        description: 'Gerencia a base de conhecimento persistente da IA. Permite adicionar, buscar, atualizar e remover informações que a IA deve lembrar sobre o usuário, a empresa ou os processos.',
        parameters: {
          type: 'object',
          properties: {
            acao: { type: 'string', enum: ['adicionar', 'buscar', 'listar', 'atualizar', 'remover'], description: 'Ação a executar na base de conhecimento' },
            titulo: { type: 'string', description: 'Título da entrada (para adicionar/atualizar)' },
            conteudo: { type: 'string', description: 'Conteúdo da informação (para adicionar/atualizar)' },
            categoria: { type: 'string', description: 'Categoria: preferencias, processos, regras, notas, geral (para adicionar)' },
            escopo: { type: 'string', enum: ['global', 'user', 'department'], description: 'Escopo: global (todos), user (só este usuário), department (departamento)' },
            tags: { type: 'string', description: 'Tags separadas por vírgula (para adicionar/buscar)' },
            busca: { type: 'string', description: 'Termo para buscar na base (para buscar)' },
            id: { type: 'string', description: 'ID da entrada (para atualizar/remover)' },
          },
          required: ['acao'],
        },
      },
      adminOnly: false,
      featureToggle: 'knowledge_base',
    },
    {
      type: 'function',
      function: {
        name: 'salvar_memoria_usuario',
        description:
          'Salva um fato importante de longo prazo sobre o usuário (preferência, meta, correção). Persiste entre sessões e logins. Use quando o usuário pedir para lembrar algo ou revelar preferências duráveis.',
        parameters: {
          type: 'object',
          properties: {
            conteudo: { type: 'string', description: 'Fato a lembrar (curto e objetivo)' },
            tipo: {
              type: 'string',
              enum: ['preference', 'fact', 'goal', 'correction', 'context', 'skill'],
              description: 'Categoria da memória',
            },
            importancia: { type: 'number', description: '1–10 (padrão 5)' },
          },
          required: ['conteudo'],
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'listar_memorias_usuario',
        description: 'Lista as memórias de longo prazo ativas do usuário autenticado.',
        parameters: {
          type: 'object',
          properties: {
            limite: { type: 'number', description: 'Máximo de itens (padrão 20)' },
          },
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'criar_skill_usuario',
        description:
          'Cria/atualiza uma skill procedural reutilizável (Hermes Agent–like). Use quando o usuário ensinar um fluxo OU você descobrir um procedimento multi-passos útil no portal. Não armazene senhas/tokens. Persiste entre logins.',
        parameters: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'Nome curto da skill (slug)' },
            descricao: { type: 'string', description: 'Quando usar esta skill (1 frase)' },
            procedimento: {
              type: 'string',
              description: 'Passos/procedimento (markdown). Inclua When to use + Steps.',
            },
            tags: { type: 'string', description: 'Tags separadas por vírgula' },
          },
          required: ['nome', 'procedimento'],
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'listar_skills_usuario',
        description: 'Lista skills procedurais ativas do usuário (persistentes entre sessões).',
        parameters: {
          type: 'object',
          properties: {
            busca: { type: 'string', description: 'Filtro opcional por nome/descrição/tag' },
            limite: { type: 'number', description: 'Máximo de itens (padrão 20)' },
          },
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'usar_skill',
        description:
          'Carrega o procedimento completo de uma skill pelo nome ou id e incrementa use_count. Use quando a tarefa bater com uma skill listada no contexto.',
        parameters: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'Nome ou UUID da skill' },
          },
          required: ['skill'],
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'esquecer_skill',
        description: 'Desativa (esquece) uma skill do usuário pelo nome ou id.',
        parameters: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'Nome ou UUID da skill' },
          },
          required: ['skill'],
        },
      },
      adminOnly: false,
    },
    {
      type: 'function',
      function: {
        name: 'iniciar_agente_autonomo',
        description: 'Inicia o agente IA autônomo para monitoramento e otimização contínua de KPIs. O agente executa ciclos periódicos para analisar KPIs, identificar gaps, gerar planos de ação e executar intervenções automaticamente.',
        parameters: {
          type: 'object',
          properties: {
            usuario_id: { type: 'string', description: 'ID do usuário para iniciar o agente autônomo' },
            setor_id: { type: 'string', description: 'ID do setor/departamento para escopo do agente' },
            config: {
              type: 'object',
              description: 'Configurações do agente autônomo',
              properties: {
                intervalo: { type: 'number', description: 'Intervalo entre ciclos em milissegundos (padrão: 30000 = 30s)', 'default': 30000},
                nivel_autonomia: { type: 'string', enum: ['baixo', 'medio', 'alto', 'total'], description: 'Nível de autonomia do agente', 'default': 'medio'},
                acoes_automaticas: { type: 'boolean', description: 'Permitir execução automática de ações', 'default': true},
                max_acoes_por_ciclo: { type: 'number', description: 'Máximo de ações por ciclo', 'default': 3},
                alertas_ativos: { type: 'boolean', description: 'Enviar alertas para anomalias detectadas', 'default': true},
              },
            },
          },
          required: ['usuario_id', 'setor_id'],
        },
      },
      adminOnly: false,
      featureToggle: 'autonomous_agent',
    },
    {
      type: 'function',
      function: {
        name: 'parar_agente_autonomo',
        description: 'Para a execução do agente IA autônomo para um usuário específico.',
        parameters: {
          type: 'object',
          properties: {
            usuario_id: { type: 'string', description: 'ID do usuário para parar o agente autônomo' },
          },
          required: ['usuario_id'],
        },
      },
      adminOnly: false,
      featureToggle: 'autonomous_agent',
    },
    {
      type: 'function',
      function: {
        name: 'status_agente_autonomo',
        description: 'Retorna o status atual e estatísticas do agente IA autônomo para um usuário.',
        parameters: {
          type: 'object',
          properties: {
            usuario_id: { type: 'string', description: 'ID do usuário para consultar status do agente' },
          },
          required: ['usuario_id'],
        },
      },
      adminOnly: false,
      featureToggle: 'autonomous_agent',
    },
    {
      type: 'function',
      function: {
        name: 'sobrescrever_acao_autonomo',
        description: 'Executa uma ação manual que sobrescreve a decisão do agente autônomo. Útil para intervenções humanas imediatas.',
        parameters: {
          type: 'object',
          properties: {
            usuario_id: { type: 'string', description: 'ID do usuário que está sobrescrevendo' },
            acao: { type: 'string', description: 'Tipo de ação manual a ser executada' },
            parametros: { type: 'object', description: 'Parâmetros específicos da ação' },
            justificativa: { type: 'string', description: 'Justificativa para a intervenção manual' },
          },
          required: ['usuario_id', 'acao', 'parametros', 'justificativa'],
        },
      },
      adminOnly: false,
      featureToggle: 'autonomous_agent',
    },

  {
    type: 'function',
    function: {
      name: 'coletar_dados_holisticos',
      description: 'Coleta dados de TODAS as fontes disponíveis para um usuário: portal (reembolsos, férias, avaliações, EPIs, ponto), Microsoft 365 (emails, calendário, tarefas, OneDrive, Teams), KPIs e equipe. Respeita hierarquia: ADMIN vê tudo de todos, GERENTE vê dados da equipe + M365, USER vê só próprios dados do portal. Use para ter visão completa antes de qualquer análise ou decisão.',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'Email, nome ou "meu" para dados do próprio usuário. Se omitido, usa o usuário logado.' },
          incluir_emails: { type: 'boolean', description: 'Incluir leitura de emails do Outlook (apenas ADMIN/GERENTE)' },
          incluir_calendario: { type: 'boolean', description: 'Incluir eventos do calendário Outlook' },
          incluir_tarefas: { type: 'boolean', description: 'Incluir tarefas do Microsoft To Do' },
          incluir_arquivos: { type: 'boolean', description: 'Incluir arquivos recentes do OneDrive' },
          incluir_equipe: { type: 'boolean', description: 'Incluir dados da equipe subordinada (apenas GERENTE/ADMIN)' },
          incluir_kpis: { type: 'boolean', description: 'Incluir análise de KPIs e metas' },
          incluir_m365: { type: 'boolean', description: 'Incluir dados do Microsoft 365 (Teams, presença, etc)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'editar_kpi',
      description: 'Cria ou atualiza um KPI no sistema. Permite definir metas, valores atuais e alertas. ADMIN edita qualquer KPI, GERENTE apenas do seu departamento.',
      parameters: {
        type: 'object',
        properties: {
          kpi_key: { type: 'string', description: 'Identificador único do KPI (ex: evaluation_completion)' },
          label: { type: 'string', description: 'Nome legível do KPI' },
          target_value: { type: 'number', description: 'Valor meta do KPI' },
          current_value: { type: 'number', description: 'Valor atual do KPI' },
          unit: { type: 'string', description: 'Unidade (%, R$, un, etc)' },
          department: { type: 'string', description: 'Departamento associado' },
          alert_threshold: { type: 'number', description: 'Percentual mínimo para alerta (padrão: 80)' },
        },
        required: ['kpi_key', 'label', 'target_value'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'listar_kpis',
      description: 'Lista todos os KPIs ativos com valores atuais e metas. ADMIN vê todos, GERENTE vê do departamento, USER vê gerais.',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Filtrar por departamento' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'configurar_alerta_kpi',
      description: 'Configura alertas automáticos para quando um KPI fica abaixo do threshold. Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {
          kpi_key: { type: 'string', description: 'Chave do KPI' },
          threshold: { type: 'number', description: 'Percentual mínimo (ex: 80 = alerta abaixo de 80% da meta)' },
          channels: { type: 'string', description: 'Canais: push, email, portal (separados por vírgula)' },
        },
        required: ['kpi_key', 'threshold'],
      },
    },
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'buscar_feedbacks',
      description: 'Busca feedbacks enviados pelos usuários do portal. Permite filtrar por tipo, status e período. Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['doubt', 'bug', 'suggestion', 'other'], description: 'Tipo de feedback' },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'dismissed'], description: 'Status do feedback' },
          limite: { type: 'number', description: 'Quantidade máxima de resultados (padrão: 20)' },
        },
        required: [],
      },
    },
    adminOnly: true,
    requireModule: 'feedback',
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_status_feedback',
      description: 'Atualiza o status de um feedback do usuário. Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {
          feedback_id: { type: 'string', description: 'ID do feedback (UUID)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'dismissed'], description: 'Novo status' },
        },
        required: ['feedback_id', 'status'],
      },
    },
    adminOnly: true,
    requireModule: 'feedback',
  },
  {
    type: 'function',
    function: {
      name: 'excluir_feedback',
      description: 'Exclui um feedback do usuário do portal. Apenas ADMIN.',
      parameters: {
        type: 'object',
        properties: {
          feedback_id: { type: 'string', description: 'ID do feedback (UUID) a ser excluído' },
        },
        required: ['feedback_id'],
      },
    },
    adminOnly: true,
    requireModule: 'feedback',
  },
  {
    type: 'function',
    function: {
      name: 'obter_link_contracheque',
      description: 'Obtém as instruções e o link de acesso para o sistema externo de contracheques.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    adminOnly: false,
    requireModule: 'contracheque',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_contratos',
      description: 'Busca os documentos/contratos trabalhistas e solicitações de assinatura. ADMIN/GERENTE vêem todos os envelopes e status de assinatura. USER vê apenas suas próprias solicitações de assinatura pendentes ou assinadas.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'SIGNED', 'RETRIEVED', 'DELETED'], description: 'Status da assinatura/envelope' },
          busca: { type: 'string', description: 'Termo de busca para título ou colaborador' },
          limite: { type: 'number', description: 'Limite de resultados' }
        },
        required: [],
      },
    },
    adminOnly: false,
    requireModule: 'contratos',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ponto',
      description: 'Busca os registros de ponto (presenças em listas corporativas) de um funcionário específico. USER vê os próprios, ADMIN/GERENTE vêem os de qualquer funcionário.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: { type: 'string', description: 'ID (UUID) do funcionário' },
          data_inicio: { type: 'string', description: 'Data de início (YYYY-MM-DD)' },
          data_fim: { type: 'string', description: 'Data de fim (YYYY-MM-DD)' },
          limite: { type: 'number', description: 'Limite de resultados' }
        },
        required: [],
      },
    },
    adminOnly: false,
    requireModule: 'ponto',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_lista_presenca',
      description: 'Busca listas de presença disponíveis e seus detalhes (status, data, local, etc.).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['aberta', 'fechada'], description: 'Status da lista' },
          busca: { type: 'string', description: 'Termo de busca para título ou local' },
          limite: { type: 'number', description: 'Limite de resultados' }
        },
        required: [],
      },
    },
    adminOnly: false,
    requireModule: 'lista-presenca',
  },
  // =====================================================
  // Gestão Tripulantes / e-Social / Escala / EPI / Academy
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'buscar_tripulantes',
      description: 'Lista tripulantes (gt_vw_colaboradores_completo) com filtros por busca, empresa, embarcação, cargo, status de embarque, ASO vencido.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Nome, matrícula, CPF ou email' },
          empresa: { type: 'string' },
          embarcacao: { type: 'string' },
          cargo: { type: 'string' },
          status: { type: 'string', description: 'Status de embarque vivo (célula de hoje): embarcado|standby|folga|desembarcado|afastado|ferias|treinamento' },
          apenas_docs_vencidos: { type: 'boolean' },
          limite: { type: 'number', description: 'Padrão 50, máx 200' },
        },
        required: [],
      },
    },
    requireModule: 'gestao-tripulantes',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_documentos_vencidos',
      description:
        'Lista documentos vigentes vencidos ou vencendo da Matriz de Conformidade (gt_documentos). Use quando o KPI mostrar N vencidos e for preciso saber QUAL documento, de quem, validade e em qual aba abrir.',
      parameters: {
        type: 'object',
        properties: {
          colaborador_id: { type: 'string', description: 'UUID do colaborador (opcional)' },
          incluir_historico: { type: 'boolean', description: 'Incluir cópias antigas que não entram no KPI' },
        },
        required: [],
      },
    },
    requireModule: 'gestao-tripulantes',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_afastamentos',
      description: 'Lista afastamentos de tripulantes (ativos ou histórico). Informe colaborador_id ou busca por nome/CPF.',
      parameters: {
        type: 'object',
        properties: {
          colaborador_id: { type: 'string' },
          busca: { type: 'string', description: 'Nome ou CPF do colaborador' },
          apenas_ativos: { type: 'boolean', description: 'Se true, só afastamentos sem data_fim ou data_fim futura' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'gestao-tripulantes',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_acidentes',
      description: 'Lista acidentes de trabalho (CAT) registrados na Gestão de Tripulantes.',
      parameters: {
        type: 'object',
        properties: {
          colaborador_id: { type: 'string' },
          busca: { type: 'string' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'gestao-tripulantes',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_fatores_risco_esocial',
      description: 'Lista fatores de risco e-Social (tabela esocial_fatores_risco), filtráveis por cargo.',
      parameters: {
        type: 'object',
        properties: {
          cargo: { type: 'string' },
          busca: { type: 'string' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'e-social',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_escalas',
      description: 'Busca escalas/embarques (gt_historico_embarques) por CPF, colaborador_id ou período. Inclui origem MIO e local.',
      parameters: {
        type: 'object',
        properties: {
          cpf: { type: 'string' },
          colaborador_id: { type: 'string' },
          data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
          data_fim: { type: 'string', description: 'YYYY-MM-DD' },
          origem: { type: 'string', enum: ['local', 'mio'] },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'man-schedule',
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_escala',
      description: 'Atualiza evento de escala LOCAL (tipo, datas, observações). Não edita eventos origem=mio.',
      parameters: {
        type: 'object',
        properties: {
          evento_id: { type: 'string', description: 'UUID do gt_historico_embarques' },
          tipo: { type: 'string', description: 'Código: normal, fi, dba, stb, offc ou custom' },
          data_embarque: { type: 'string' },
          data_desembarque: { type: 'string' },
          observacoes: { type: 'string' },
          local_embarque: { type: 'string' },
          local_desembarque: { type: 'string' },
        },
        required: ['evento_id'],
      },
    },
    requireModule: 'man-schedule',
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'registrar_entrega_epi',
      description: 'Registra solicitação/entrega de EPI para um funcionário. ADMIN/GERENTE pode marcar como delivered.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: { type: 'string', description: 'UUID do usuário' },
          tipo_equipamento: { type: 'string', description: 'Nome/tipo do EPI' },
          quantidade: { type: 'number' },
          motivo: { type: 'string' },
          marcar_entregue: { type: 'boolean', description: 'Se true (ADMIN/GERENTE), já marca como delivered' },
        },
        required: ['funcionario_id', 'tipo_equipamento', 'quantidade', 'motivo'],
      },
    },
    requireModule: 'epi',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_estoque_epi',
      description: 'Consulta estoque atual de EPIs, com opção de apenas itens em estoque baixo.',
      parameters: {
        type: 'object',
        properties: {
          apenas_baixo: { type: 'boolean' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'epi',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_vencimentos_epi',
      description: 'Lista tipos de EPI com CA próximo do vencimento (ou já vencido).',
      parameters: {
        type: 'object',
        properties: {
          dias: { type: 'number', description: 'Janela de dias para vencimento (padrão 90)' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'epi',
  },
  {
    type: 'function',
    function: {
      name: 'resumo_ponto_funcionario',
      description: 'Resumo de presenças/ponto do funcionário no período: total de registros, por evento/local, dias distintos.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: { type: 'string' },
          data_inicio: { type: 'string' },
          data_fim: { type: 'string' },
        },
        required: [],
      },
    },
    requireModule: 'ponto',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_inconsistencias_ponto',
      description: 'Detecta possíveis inconsistências de ponto: dias sem registro em listas abertas do período, ou registros duplicados no mesmo dia/evento.',
      parameters: {
        type: 'object',
        properties: {
          funcionario_id: { type: 'string' },
          data_inicio: { type: 'string' },
          data_fim: { type: 'string' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'ponto',
  },
  {
    type: 'function',
    function: {
      name: 'matricular_usuario_curso',
      description: 'Matricula um usuário em um curso da Academy. ADMIN pode matricular qualquer um; USER só a si mesmo.',
      parameters: {
        type: 'object',
        properties: {
          curso_id: { type: 'string' },
          usuario_id: { type: 'string', description: 'Opcional; padrão = usuário atual' },
        },
        required: ['curso_id'],
      },
    },
    requireModule: 'academy',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_certificados',
      description: 'Lista certificados emitidos (matrículas concluídas com certificate_url).',
      parameters: {
        type: 'object',
        properties: {
          usuario_id: { type: 'string' },
          curso_id: { type: 'string' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'academy',
  },
  {
    type: 'function',
    function: {
      name: 'buscar_quizzes_pendentes',
      description: 'Lista quizzes da Academy pendentes de correção (needs_grading) ou tentativas não aprovadas do usuário.',
      parameters: {
        type: 'object',
        properties: {
          curso_id: { type: 'string' },
          usuario_id: { type: 'string' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    requireModule: 'academy',
  },
  // =====================================================
  // Fase 3 — Graph non-admin, Calendário write, Companion, KPI comms
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'buscar_sinais_kpi_comunicacao',
      description: 'Pesquisa e-mails e conversas Teams por sinais de pendência, aprovação ou conclusão ligados a KPIs (férias, reembolso, compras, etc.). Use quando o usuário pedir contexto de comunicação sobre pendências.',
      parameters: {
        type: 'object',
        properties: {
          email_usuario: { type: 'string', description: 'Mailbox a pesquisar (padrão: próprio usuário; ADMIN pode informar outro)' },
          dominios: {
            type: 'string',
            description: 'Domínios separados por vírgula: ferias,reembolso,compras,avaliacao,epi,pendencia,conclusao',
          },
          dias: { type: 'number', description: 'Janela em dias (padrão 14)' },
          limite: { type: 'number', description: 'Máx. resultados por fonte (padrão 30, 0=máximo)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'meus_emails',
      description: 'Lista/pesquisa e-mails da própria caixa do usuário logado (non-admin). Retorna detalhe completo (datas ISO+pt-BR, remetente/destinatários, preview, pasta, webLink, status). Extrai conforme filtros; limite=0 para máximo; incluir_corpo=true para texto truncado.',
      parameters: {
        type: 'object',
        properties: {
          consulta: { type: 'string' },
          de: { type: 'string' },
          assunto: { type: 'string' },
          data_inicio: { type: 'string' },
          data_fim: { type: 'string' },
          pasta: { type: 'string' },
          apenas_nao_lidos: { type: 'boolean' },
          com_anexos: { type: 'boolean' },
          incluir_corpo: { type: 'boolean', description: 'Se true, inclui corpo em texto plano truncado (~2000 chars)' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'meu_calendario',
      description: 'Lista eventos do calendário do usuário (portal + Microsoft Graph) no período solicitado.',
      parameters: {
        type: 'object',
        properties: {
          dias_futuros: { type: 'number', description: 'Dias à frente (padrão 14)' },
          dias_passados: { type: 'number', description: 'Dias para trás (padrão 0)' },
          limite: { type: 'number' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'criar_evento_calendario',
      description: 'Cria evento no calendário do portal e opcionalmente no Outlook (Graph) do usuário.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          inicio: { type: 'string', description: 'ISO ou YYYY-MM-DDTHH:mm' },
          fim: { type: 'string' },
          local: { type: 'string' },
          descricao: { type: 'string' },
          tambem_outlook: { type: 'boolean', description: 'Se true, cria também no calendário Outlook' },
        },
        required: ['titulo', 'inicio', 'fim'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'minhas_conversas_teams',
      description: 'Lista chats do Teams do usuário e/ou pesquisa mensagens por texto.',
      parameters: {
        type: 'object',
        properties: {
          consulta: { type: 'string', description: 'Filtrar mensagens contendo este texto' },
          limite: { type: 'number' },
          listar_chats: { type: 'boolean', description: 'Se true, também lista os chats (padrão true se sem consulta)' },
        },
        required: [],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'pesquisar_mensagens_teams',
      description: 'Pesquisa mensagens em conversas Teams. ADMIN pode informar email de outro usuário; demais usam a própria conta.',
      parameters: {
        type: 'object',
        properties: {
          email_usuario: { type: 'string' },
          consulta: { type: 'string', description: 'Texto a buscar nas mensagens' },
          limite: { type: 'number' },
        },
        required: ['consulta'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'navegar_portal',
      description: 'Navega o usuário para um módulo do portal. Aceita typos e sinônimos (ex: feririas→férias, reemboso→reembolso, tripulantes, e-social). Use quando o usuário pedir para abrir/ir a uma tela.',
      parameters: {
        type: 'object',
        properties: {
          destino: {
            type: 'string',
            description: 'Nome do módulo, frase ou path: ferias, reembolso, tripulantes, academy, epi, ponto, compras, calendario, esocial, kpi, /kpi, dashboard, admin, ou /path',
          },
          highlight: { type: 'string', description: 'CSS selector opcional para destacar após navegar' },
        },
        required: ['destino'],
      },
    },
    adminOnly: false,
  },
  {
    type: 'function',
    function: {
      name: 'aprovar_ferias',
      description:
        'Aprova solicitação de férias (ADMIN/GERENTE). PENDING_LEADER→PENDING_MANAGER; PENDING_MANAGER→APPROVED. Use IDs de buscar_ferias / buscar_ferias_global.',
      parameters: {
        type: 'object',
        properties: {
          solicitacao_id: { type: 'string', description: 'UUID da leave_request' },
          comentario: { type: 'string', description: 'Comentário opcional' },
        },
        required: ['solicitacao_id'],
      },
    },
    requireModule: 'ferias',
    requireTeamAccess: true,
  },
  {
    type: 'function',
    function: {
      name: 'reprovar_ferias',
      description: 'Reprova solicitação de férias (ADMIN/GERENTE). Status → REJECTED. Motivo obrigatório.',
      parameters: {
        type: 'object',
        properties: {
          solicitacao_id: { type: 'string' },
          motivo: { type: 'string', description: 'Motivo da reprovação' },
        },
        required: ['solicitacao_id', 'motivo'],
      },
    },
    requireModule: 'ferias',
    requireTeamAccess: true,
  },
  {
    type: 'function',
    function: {
      name: 'aprovar_reembolso',
      description: 'Aprova reembolso pendente (ADMIN). Status → aprovado. Use ID de buscar_reembolsos / buscar_reembolsos_global.',
      parameters: {
        type: 'object',
        properties: {
          reembolso_id: { type: 'string' },
          comentario: { type: 'string' },
        },
        required: ['reembolso_id'],
      },
    },
    requireModule: 'reembolso',
    adminOnly: true,
  },
  {
    type: 'function',
    function: {
      name: 'reprovar_reembolso',
      description: 'Reprova reembolso pendente (ADMIN). Status → rejeitado. Motivo obrigatório.',
      parameters: {
        type: 'object',
        properties: {
          reembolso_id: { type: 'string' },
          motivo: { type: 'string' },
        },
        required: ['reembolso_id', 'motivo'],
      },
    },
    requireModule: 'reembolso',
    adminOnly: true,
  },
];

/**
 * Obtém a lista de ferramentas disponíveis para um usuário com base em suas permissões
 */
export async function getAvailableTools(userId: string, role: string) {
  const availableTools = [];
  const effectiveRole =
    role === 'ADMIN'
      ? 'ADMIN'
      : role === 'GERENTE' || role === 'MANAGER'
        ? 'GERENTE'
        : 'USER';

  // Cache de feature toggles para esta chamada
  let featureTogglesCache: Record<string, { is_enabled: boolean; allowed_roles: string[] }> | null = null;

  async function checkFeatureToggle(featureKey: string): Promise<boolean> {
    if (!featureTogglesCache) {
      try {
        const { data } = await supabaseAdmin
          .from('ia_feature_toggles')
          .select('feature_key, is_enabled, allowed_roles');
        featureTogglesCache = {};
        for (const toggle of (data || [])) {
          featureTogglesCache[toggle.feature_key] = {
            is_enabled: toggle.is_enabled,
            allowed_roles: toggle.allowed_roles || [],
          };
        }
      } catch {
        featureTogglesCache = {};
      }
    }

    const toggle = featureTogglesCache[featureKey];
    if (!toggle) return true; // Se não existe toggle, liberar
    if (!toggle.is_enabled) return false;
    if (toggle.allowed_roles.length > 0 && !toggle.allowed_roles.includes(effectiveRole)) return false;
    return true;
  }

  for (const tool of IA_TOOLS_DEFINITION) {
    // Se ferramenta é adminOnly, só ADMIN pode usar
    if (tool.adminOnly && role !== 'ADMIN') {
      continue;
    }

    // Se ferramenta requer TeamAccess (dados da equipe), precisa ser ADMIN ou GERENTE
    if ((tool as any).requireTeamAccess && effectiveRole === 'USER') {
      continue;
    }

    // Verificar feature toggle
    if ((tool as any).featureToggle) {
      const enabled = await checkFeatureToggle((tool as any).featureToggle);
      if (!enabled) continue;
    }

    if (tool.requireModule) {
      const hasAccess = await canAccessModule(userId, tool.requireModule);
      if (!hasAccess) continue;
    }

    // Remove propriedades customizadas antes de enviar para o modelo
    const { requireModule, adminOnly, requireTeamAccess, featureToggle, ...cleanTool } = tool as any;
    availableTools.push(cleanTool);
  }

  return availableTools;
}

/**
 * Executa a ferramenta solicitada pelo modelo
 */
export async function executeToolCall(name: string, args: any, userRole: string, userId: string): Promise<string> {
  console.log(`[IA Tools] Executando ferramenta: ${name} com args:`, args);

  try {
    switch (name) {
      case 'render_dashboard': {
        const layout = args?.layout;
        const persist =
          args?.persistir_quadro !== false && args?.persistir_quadro !== 'false';
        let boardMeta: Record<string, unknown> = {};
        let portalCommands: Array<{ action: string; target: string; label: string; value?: unknown }> = [];
        let boardId: string | undefined;

        if (persist && layout && userId) {
          try {
            const {
              upsertBoardFromDashboardLayout,
              buildOpenKpiBoardCommands,
            } = await import('./kpi-board');
            const board = await upsertBoardFromDashboardLayout({
              userId,
              layout,
              title: args?.titulo_quadro ? String(args.titulo_quadro) : undefined,
              role: userRole,
            });
            if (board) {
              boardId = board.id;
              boardMeta = { kpiBoard: { id: board.id, title: board.title, revision: board.revision } };
              portalCommands = buildOpenKpiBoardCommands(board.id, board.title);
            }
          } catch (persistErr) {
            console.warn('[IA Tools] render_dashboard persist board skip:', persistErr);
          }
        }

        return JSON.stringify({
          success: true,
          message: boardId
            ? `Dashboard renderizado e salvo como quadro KPI (${boardId}). Abrindo /kpi.`
            : 'Dashboard renderizado com sucesso. O usuário verá os componentes logo abaixo desta resposta.',
          board_id: boardId,
          _metadata: {
            dashboard: layout,
            ...boardMeta,
            ...(portalCommands.length ? { portalCommands } : {}),
          },
        });
      }

      case 'criar_quadro_kpi': {
        const { createKpiBoard, buildOpenKpiBoardCommands } = await import('./kpi-board');
        const titulo = String(args?.titulo || 'Quadro KPI').trim();
        const { board, error } = await createKpiBoard({
          userId,
          title: titulo,
          spec: args?.spec,
          setActive: true,
          role: userRole,
        });
        if (!board) {
          return error || 'Falha ao criar quadro (verifique harness/spec Zod / tabela ia_kpi_boards).';
        }
        const abrir = args?.abrir !== false && args?.abrir !== 'false';
        const commands = abrir ? buildOpenKpiBoardCommands(board.id, board.title) : [];
        return JSON.stringify({
          success: true,
          board: { id: board.id, title: board.title, revision: board.revision },
          message: abrir
            ? `Quadro "${board.title}" criado. Abrindo /kpi.`
            : `Quadro "${board.title}" criado.`,
          _metadata: {
            kpiBoard: { id: board.id, title: board.title },
            ...(commands.length ? { portalCommands: commands } : {}),
          },
        });
      }

      case 'atualizar_quadro_kpi': {
        const { updateKpiBoard, buildOpenKpiBoardCommands } = await import('./kpi-board');
        const boardId = String(args?.board_id || '').trim();
        if (!boardId) return 'board_id é obrigatório.';
        const { board, error } = await updateKpiBoard({
          userId,
          boardId,
          title: args?.titulo ? String(args.titulo) : undefined,
          spec: args?.spec,
          setActive: true,
          role: userRole,
        });
        if (!board) return error || 'Falha ao atualizar quadro.';
        const abrir = args?.abrir !== false && args?.abrir !== 'false';
        const commands = abrir ? buildOpenKpiBoardCommands(board.id, board.title) : [];
        return JSON.stringify({
          success: true,
          board: { id: board.id, title: board.title, revision: board.revision },
          _metadata: {
            kpiBoard: { id: board.id, title: board.title },
            ...(commands.length ? { portalCommands: commands } : {}),
          },
        });
      }

      case 'listar_quadros_kpi': {
        const { listKpiBoards } = await import('./kpi-board');
        const boards = await listKpiBoards(userId, {
          limit: Number(args?.limite) || 20,
        });
        return JSON.stringify({
          total: boards.length,
          boards: boards.map((b) => ({
            id: b.id,
            title: b.title,
            revision: b.revision,
            is_active: b.is_active,
            widgets: Array.isArray(b.spec?.widgets) ? b.spec.widgets.length : 0,
            updated_at: b.updated_at,
          })),
        });
      }

      case 'abrir_quadro_kpi': {
        const {
          getActiveKpiBoard,
          getKpiBoard,
          setActiveKpiBoard,
          buildOpenKpiBoardCommands,
        } = await import('./kpi-board');
        let board = null;
        const requested = String(args?.board_id || '').trim();
        if (requested) {
          board = await setActiveKpiBoard(userId, requested);
          if (!board) board = await getKpiBoard(userId, requested);
        } else {
          board = await getActiveKpiBoard(userId);
        }
        if (!board) {
          return 'Nenhum quadro KPI encontrado. Use criar_quadro_kpi ou render_dashboard primeiro.';
        }
        const commands = buildOpenKpiBoardCommands(board.id, board.title);
        return JSON.stringify({
          success: true,
          board: { id: board.id, title: board.title },
          message: `Abrindo quadro "${board.title}" em /kpi.`,
          _metadata: {
            kpiBoard: { id: board.id, title: board.title },
            portalCommands: commands,
          },
        });
      }

      case 'excluir_quadro_kpi': {
        const { findUserBoard, deleteUserBoard } = await import('./kpi-board');
        const id = String(args?.id || args?.board_id || '').trim();
        const titulo = args?.titulo ? String(args.titulo).trim() : '';
        if (!id && !titulo) {
          return 'Informe id (UUID) ou titulo do quadro a excluir.';
        }
        const target = await findUserBoard(userId, { id, titulo });
        if (!target) {
          return JSON.stringify({
            success: false,
            error: 'Quadro não encontrado (só seus quadros ativos podem ser excluídos).',
          });
        }
        const result = await deleteUserBoard(userId, target.id);
        if (!result.ok) {
          return JSON.stringify({ success: false, error: result.error });
        }
        return JSON.stringify({
          success: true,
          deleted: { id: result.board.id, title: result.board.title },
          message: `Quadro "${result.board.title}" excluído.`,
        });
      }

      case 'excluir_todos_quadros_kpi': {
        const { deleteAllUserBoards } = await import('./kpi-board');
        const result = await deleteAllUserBoards(userId);
        if (!result.ok) {
          return JSON.stringify({ success: false, error: result.error });
        }
        return JSON.stringify({
          success: true,
          deleted: result.deleted,
          boards: result.boards,
          message:
            result.deleted === 0
              ? 'Nenhum quadro para excluir.'
              : `${result.deleted} quadro(s) excluído(s).`,
        });
      }

      case 'buscar_funcionario': {
        const { busca } = args;
        const baseSelect = 'id, first_name, last_name, email, role, department, position';
        // Construção de query com suporte a múltiplos tokens (p.ex. "Caio Correia")
        let queryBuilder = supabaseAdmin.from('users_unified').select(baseSelect);

        if (busca && busca.trim()) {
          const tokens = busca.trim().split(/\s+/);
          if (tokens.length >= 2) {
            const t1 = tokens[0];
            const t2 = tokens.slice(1).join(' ');
            queryBuilder = queryBuilder
              .or(`first_name.ilike.%${t1}%,last_name.ilike.%${t2}%`)
              .or(`first_name.ilike.%${t2}%,last_name.ilike.%${t1}%`)
              .or(`email.ilike.%${busca}%,first_name.ilike.%${busca}%,last_name.ilike.%${busca}%`);
          } else {
            queryBuilder = queryBuilder
              .or(`first_name.ilike.%${busca}%,last_name.ilike.%${busca}%,email.ilike.%${busca}%`);
          }
        }

        const { data, error } = await queryBuilder;
        if (error) return `Erro ao buscar funcionário: ${error.message}`;
        if (!data || data.length === 0) {
          // Fallback: tente localizar o usuário via Microsoft Graph com base no displayName (busca)
          try {
            const MS_CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || '';
            const MS_CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || '';
            const MS_TENANT_ID = process.env.MS_GRAPH_TENANT_ID || 'common';

            if (MS_CLIENT_ID && MS_CLIENT_SECRET) {
              const params = new URLSearchParams({
                client_id: MS_CLIENT_ID,
                client_secret: MS_CLIENT_SECRET,
                scope: 'https://graph.microsoft.com/.default',
                grant_type: 'client_credentials',
              });

              const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
              });

              const tokenText = await tokenRes.text();
              let tokenData: any = {};
              try {
                tokenData = JSON.parse(tokenText);
              } catch {
                console.warn('[IA Tools] Token Graph retornou não-JSON');
              }
              if (tokenData.access_token) {
                const displayNameQuery = encodeURIComponent(busca);
                const graphRes = await fetch(`https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${busca}')&$top=5&$select=id,displayName,mail,userPrincipalName`, {
                  headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
                });

                if (graphRes.ok) {
                  const graphData = await graphRes.json();
                  const value = graphData.value || [];
                  if (value.length > 0) {
                    const gUser = value[0];
                    const candidateEmail = gUser.mail || gUser.userPrincipalName;
                    if (candidateEmail) {
                      const internal = await supabaseAdmin
                        .from('users_unified')
                        .select('id, first_name, last_name, email, role, department, position')
                        .eq('email', candidateEmail)
                        .maybeSingle();
                      if (internal && internal.data) {
                        return JSON.stringify([internal.data]);
                      }
                      // fallback: retornar dados do Graph quando não houver correspondência interna
                      return JSON.stringify(value.map((u: any) => ({ id: u.id, email: u.mail || u.userPrincipalName, displayName: u.displayName })));
                    }
                  }
                }
              }
            }
          } catch {
            // ignore e cai no retorno padrão abaixo
          }
          return `Nenhum funcionário encontrado com o termo "${busca}".`;
        }
return JSON.stringify(data);
      }

      case 'buscar_dados_usuario': {
        const { tipo, usuario } = args;
        const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' ? 'GERENTE' : 'USER');



        let targetUserId: string;
        if (!usuario || usuario === 'meu' || usuario === 'minhas' || usuario === 'meus') {
          targetUserId = userId;
        } else {
          const resolvedId = await resolveUserIdByIdentifier(usuario);
          targetUserId = resolvedId || '';
          if (!targetUserId) {
            return `Usuário não encontrado: "${usuario}". Use "meu" para seus próprios dados ou informe email/nome/CPF válido.`;
          }
        }

        const hasAccess = await canAccessUserData(userId, effectiveRole, targetUserId);
        if (!hasAccess) {
          return `Você não tem permissão para ver dados deste usuário.`;
        }

        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users_unified')
          .select('first_name, last_name, email, role, department, position')
          .eq('id', targetUserId)
          .single();

        if (userError || !targetUser) {
          return `Usuário não encontrado. Verifique o identificador informado.`;
        }

        const userName = targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Desconhecido';
        const userEmail = targetUser?.email || '';
        const userRoleTarget = targetUser?.role || '';

        const result: any = {
          usuario: {
            nome: userName,
            email: userEmail,
            cargo: targetUser?.position || 'N/A',
            departamento: targetUser?.department || 'N/A',
            role: userRoleTarget,
          }
        };

        if (tipo === 'ferias' || tipo === 'resumo' || tipo === 'todos') {
          const { data: ferias } = await supabaseAdmin
            .from('leave_requests')
            .select('id, start_date, end_date, status, reason, created_at')
            .eq('user_id', targetUserId)
            .order('start_date', { ascending: false })
            .limit(20);

          const pendentes = ferias?.filter(f => f.status === 'PENDING_LEADER' || f.status === 'PENDING_MANAGER') || [];
          const aprovadas = ferias?.filter(f => f.status === 'APPROVED') || [];
          const canceladas = ferias?.filter(f => f.status === 'CANCELLED') || [];

          result.ferias = {
            pendentes: pendentes.map(f => ({
              id: f.id,
              inicio: f.start_date,
              fim: f.end_date,
              motivo: f.reason,
              solicitacao: f.created_at ? new Date(f.created_at).toLocaleDateString('pt-BR') : null
            })),
            aprovadas: aprovadas.map(f => ({
              id: f.id,
              inicio: f.start_date,
              fim: f.end_date,
              motivo: f.reason
            })),
            canceladas: canceladas.length,
            total: ferias?.length || 0
          };
        }

        if (tipo === 'reembolsos' || tipo === 'resumo' || tipo === 'todos') {
          const { data: userData } = await supabaseAdmin
            .from('users_unified')
            .select('email')
            .eq('id', targetUserId)
            .single();
          
          const userEmail = userData?.email;
          
          const { data: reembolsos } = userEmail 
            ? await supabaseAdmin
                .from('Reimbursement')
                .select('id, status, valorTotal, descricao, data, tipo_reembolso')
                .eq('email', userEmail)
                .order('data', { ascending: false })
                .limit(20)
            : { data: null };

          const pendentes = reembolsos?.filter(r => r.status === 'pendente') || [];
          const aprovados = reembolsos?.filter(r => r.status === 'aprovado') || [];
          const rejeitados = reembolsos?.filter(r => r.status === 'rejeitado') || [];

          const totalPendente = pendentes.reduce((sum, r) => sum + (parseFloat(r.valorTotal) || 0), 0);
          const totalAprovado = aprovados.reduce((sum, r) => sum + (parseFloat(r.valorTotal) || 0), 0);

          result.reembolsos = {
            pendentes: pendentes.map(r => ({
              id: r.id,
              descricao: r.descricao,
              valor: r.valorTotal,
              data: r.data,
              tipo_reembolso: r.tipo_reembolso
            })),
            aprovados: aprovados.map(r => ({
              id: r.id,
              descricao: r.descricao,
              valor: r.valorTotal,
              data: r.data,
              tipo_reembolso: r.tipo_reembolso
            })),
            rejeitados: rejeitados.length,
            total_pendente: totalPendente,
            total_aprovado: totalAprovado
          };
        }

        if (tipo === 'eventos' || tipo === 'resumo' || tipo === 'todos') {
          const hoje = new Date().toISOString();
          const futuro30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const { data: eventos } = await supabaseAdmin
            .from('calendar_events')
            .select('id, summary, description, start_time, end_time, location, attendees')
            .eq('user_id', targetUserId)
            .gte('start_time', hoje)
            .lte('start_time', futuro30)
            .order('start_time', { ascending: true })
            .limit(20);

          const proximos7 = eventos?.filter(e => new Date(e.start_time) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) || [];

          result.eventos = {
            proximos_7_dias: proximos7.map(e => ({
              id: e.id,
              titulo: e.summary,
              descricao: e.description,
              inicio: e.start_time,
              fim: e.end_time,
              local: e.location,
              participantes: e.attendees?.length || 0
            })),
            proximos_30_dias: eventos?.map(e => ({
              id: e.id,
              titulo: e.summary,
              inicio: e.start_time,
              fim: e.end_time,
              local: e.location
            })) || [],
            total: eventos?.length || 0
          };
        }

        if (tipo === 'epis' || tipo === 'resumo' || tipo === 'todos') {
          const { data: epis } = await supabaseAdmin
            .from('epi_registrations')
            .select('id, delivery_date, status, return_date, justification, epi_types(name, ca_number)')
            .eq('user_id', targetUserId)
            .order('delivery_date', { ascending: false })
            .limit(20);

          const ativos = epis?.filter(e => e.status === 'active' || e.status === 'delivered') || [];
          const devolvidos = epis?.filter(e => e.status === 'returned') || [];

           result.epis = {
             ativos: ativos.map(e => ({
               id: e.id,
               tipo: Array.isArray((e as any).epi_types) ? (e as any).epi_types[0]?.name : (e as any).epi_types?.name || 'N/A',
               ca: Array.isArray((e as any).epi_types) ? (e as any).epi_types[0]?.ca_number : (e as any).epi_types?.ca_number || 'N/A',
               entrega: e.delivery_date,
               status: e.status
            })),
             devolvidos: devolvidos.map(e => ({
               id: e.id,
               tipo: Array.isArray((e as any).epi_types) ? (e as any).epi_types[0]?.name : (e as any).epi_types?.name || 'N/A',
               entrega: e.delivery_date,
               devolucao: e.return_date
            })),
            total: epis?.length || 0
          };
        }

        if (tipo === 'avaliacoes' || tipo === 'resumo' || tipo === 'todos') {
          const { data: avaliacoes } = await supabaseAdmin
            .from('avaliacoes_desempenho')
            .select('id, nota_final, status, periodo_id, created_at')
            .eq('colaborador_id', targetUserId)
            .order('created_at', { ascending: false })
            .limit(10);

          const pendentes = avaliacoes?.filter(a => a.status === 'pendente' || a.status === 'pending' || a.status === 'pendente_autoavaliacao') || [];
          const concluidas = avaliacoes?.filter(a => a.status === 'aprovado' || a.status === 'completed' || a.status === 'aprovada') || [];

          const mediaNota = avaliacoes?.filter(a => a.nota_final != null)
            .reduce((sum, a, _, arr) => sum + (a.nota_final || 0) / arr.length, 0) || null;

          result.avaliacoes = {
            pendentes: pendentes.map(a => ({
              id: a.id,
              periodo: a.periodo_id,
              nota: a.nota_final,
              status: a.status,
              data: a.created_at
            })),
            concluidas: concluidas.map(a => ({
              id: a.id,
              periodo: a.periodo_id,
              nota: a.nota_final,
              status: a.status,
              data: a.created_at
            })),
            media_nota: mediaNota ? Math.round(mediaNota * 100) / 100 : null,
            total: avaliacoes?.length || 0
          };
        }

        if (tipo === 'resumo') {
          const pendencias: string[] = [];
          if (result.ferias?.pendentes?.length > 0) {
            pendencias.push(`${result.ferias.pendentes.length} férias pendente(s)`);
          }
          if (result.reembolsos?.pendentes?.length > 0) {
            pendencias.push(`${result.reembolsos.pendentes.length} reembolso(s) pendente(s) - R$ ${result.reembolsos.total_pendente.toLocaleString('pt-BR')}`);
          }
          if (result.eventos?.proximos_7_dias?.length > 0) {
            pendencias.push(`${result.eventos.proximos_7_dias.length} evento(s) nos próximos 7 dias`);
          }
          if (result.avaliacoes?.pendentes?.length > 0) {
            pendencias.push(`${result.avaliacoes.pendentes.length} avaliação(ões) pendente(s)`);
          }

          result.resumo_geral = {
            total_pendencias: pendencias.length,
            pendencias: pendencias,
            mensagem: pendencias.length > 0
              ? `Você tem ${pendencias.length} pendência(s): ${pendencias.join(', ')}.`
              : 'Nenhuma pendência encontrada. Tudo em dia!'
          };
        }

        return JSON.stringify(result);
      }

      case 'buscar_usuarios_global': {
        const { department, role, status, busca, limite = 50, ordenar_por = 'first_name', ordem = 'asc' } = args;
        
        const result = await executeGlobalSearchQuery({
          table: 'users_unified',
          select: 'id, first_name, last_name, email, role, department, position, status, created_at',
          userId,
          userRole,
          userColumn: 'id',
          filters: { department, role, status, busca },
          limit: Math.min(limite, 200),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const formattedData = result.data.map((u: any) => ({
          id: u.id,
          nome: `${u.first_name} ${u.last_name}`.trim(),
          email: u.email,
          role: u.role,
          department: u.department,
          position: u.position,
          status: u.status,
          created_at: u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : null,
        }));

        return JSON.stringify({
          total: formattedData.length,
          usuarios: formattedData,
          filtros_aplicados: { department, role, status, busca },
        });
      }

      case 'buscar_reembolsos_global': {
        const { status, data_inicio, data_fim, departamento, categoria, limite = 100, ordenar_por = 'data', ordem = 'desc', agrupar_por, incluir_totais, busca } = args;
        
        const result = await executeGlobalSearchQuery({
          table: 'Reimbursement',
          select: 'id, user_id, status, valorTotal, descricao, data, tipo_reembolso, created_at',
          userId,
          userRole,
          filters: { status, data_inicio, data_fim, departamento, categoria, busca },
          limit: Math.min(limite, 500),
          orderBy: { column: (ordenar_por === 'valor_total' ? 'valorTotal' : ordenar_por), ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const userMap = await fetchAssociatedUsers(result.data);

        const formattedData = result.data.map((r: any) => {
          const u = userMap.get(r.user_id);
          return {
            id: r.id,
            usuario: u ? `${u.first_name} ${u.last_name}`.trim() : 'N/A',
            email: u?.email || 'N/A',
            departamento: u?.department || 'N/A',
            descricao: r.descricao,
            tipo_reembolso: r.tipo_reembolso,
            valor: r.valorTotal || 0,
            status: r.status,
            data: r.data,
          };
        });

        let output: any = { total: formattedData.length, reembolsos: formattedData };

        if (agrupar_por && incluir_totais) {
          const grouped: Record<string, { count: number; total: number }> = {};
          for (const r of formattedData) {
            const key = (r as any)[agrupar_por] || 'Sem grupo';
            if (!grouped[key]) grouped[key] = { count: 0, total: 0 };
            grouped[key].count++;
            grouped[key].total += Number(r.valor || 0);
          }
          output.totais_por_grupo = Object.entries(grouped).map(([k, v]) => ({ grupo: k, quantidade: v.count, total: v.total }));
        }

        return JSON.stringify(output);
      }

      case 'buscar_ferias_global': {
        const {
          status: statusRaw,
          ano,
          incluir_historico = true,
          data_inicio,
          data_fim,
          departamento,
          limite = 100,
          ordenar_por = 'start_date',
          ordem = 'desc',
          agrupar_por,
        } = args;

        const statusNorm = normalizeLeaveStatus(statusRaw) || statusRaw;

        let effectiveDataInicio = data_inicio;
        let effectiveDataFim = data_fim;
        if (ano && Number(ano) >= 2000 && Number(ano) <= 2100) {
          effectiveDataInicio = effectiveDataInicio || `${ano}-01-01`;
          effectiveDataFim = effectiveDataFim || `${ano}-12-31`;
        }

        const result = await executeGlobalSearchQuery({
          table: 'leave_requests',
          select: 'id, user_id, start_date, end_date, status, justification, created_at, updated_at, pecuniary_allowance, advance_13th_salary',
          userId,
          userRole,
          filters: {
            status: statusNorm,
            data_inicio: effectiveDataInicio,
            data_fim: effectiveDataFim,
            departamento,
          },
          limit: Math.min(limite, 500),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        let rows = result.data;
        if (incluir_historico === false) {
          const today = new Date().toISOString().slice(0, 10);
          rows = rows.filter((f: any) => f.end_date >= today);
        }

        const userMap = await fetchAssociatedUsers(rows);

        const formattedData = rows.map((f: any) => {
          const u = userMap.get(f.user_id);
          const start = new Date(f.start_date);
          const end = new Date(f.end_date);
          const dias = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return {
            id: f.id,
            usuario: u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u as any).name || 'N/A' : 'N/A',
            email: u?.email || 'N/A',
            departamento: u?.department || 'N/A',
            start_date: f.start_date,
            end_date: f.end_date,
            dias,
            status: f.status,
            justification: f.justification,
            created_at: f.created_at,
            updated_at: f.updated_at,
          };
        });

        let output: any = {
          total: formattedData.length,
          ferias: formattedData,
          filtros: { status: statusNorm || null, ano: ano || null, incluir_historico },
          _summary: `buscar_ferias_global: ${formattedData.length} registro(s)`,
        };

        if (agrupar_por) {
          const grouped: Record<string, number> = {};
          for (const f of formattedData) {
            const key = (f as any)[agrupar_por] || 'Sem grupo';
            grouped[key] = (grouped[key] || 0) + 1;
          }
          output.agrupado_por = grouped;
        }

        return JSON.stringify(output);
      }

      case 'buscar_avaliacoes_global': {
        const { status, periodo, departamento, limite = 50, ordenar_por = 'created_at', ordem = 'desc', agrupar_por, incluir_totais } = args;
        
        const result = await executeGlobalSearchQuery({
          table: 'avaliacoes_desempenho',
          select: 'id, colaborador_id, nota_final, status, periodo_id, created_at',
          userId,
          userRole,
          userColumn: 'colaborador_id',
          filters: { status, periodo_id: periodo, departamento },
          limit: Math.min(limite, 200),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const userMap = await fetchAssociatedUsers(result.data, 'colaborador_id');

        const formattedData = result.data.map((a: any) => {
          const u = userMap.get(a.colaborador_id);
          return {
            id: a.id,
            usuario: u ? `${u.first_name} ${u.last_name}`.trim() : 'N/A',
            email: u?.email || 'N/A',
            departamento: u?.department || 'N/A',
            periodo: a.periodo_id,
            nota: a.nota_final,
            status: a.status,
            created_at: a.created_at,
          };
        });

        let output: any = { total: formattedData.length, avaliacoes: formattedData };

        if (incluir_totais) {
          const notasValidas = formattedData.filter((a: any) => a.nota != null).map((a: any) => a.nota);
          const media = notasValidas.length > 0 ? notasValidas.reduce((a: number, b: number) => a + b, 0) / notasValidas.length : null;
          output.media_nota = media ? Math.round(media * 100) / 100 : null;
        }

        if (agrupar_por) {
          const grouped: Record<string, number> = {};
          for (const a of formattedData) {
            const key = (a as any)[agrupar_por] || 'Sem grupo';
            grouped[key] = (grouped[key] || 0) + 1;
          }
          output.agrupado_por = grouped;
        }

        return JSON.stringify(output);
      }

      case 'buscar_epis_global': {
        const { status, departamento, data_inicio, data_fim, limite = 100, ordenar_por = 'delivery_date', ordem = 'desc', agrupar_por, busca } = args;
        
        const result = await executeGlobalSearchQuery({
          table: 'epi_registrations',
          select: 'id, user_id, delivery_date, status, return_date, epi_types(name, ca_number), justification',
          userId,
          userRole,
          filters: { status, data_inicio, data_fim, departamento, busca },
          limit: Math.min(limite, 500),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const userMap = await fetchAssociatedUsers(result.data);

        const formattedData = result.data.map((e: any) => {
          const u = userMap.get(e.user_id);
          return {
            id: e.id,
            usuario: u ? `${u.first_name} ${u.last_name}`.trim() : 'N/A',
            email: u?.email || 'N/A',
            departamento: u?.department || 'N/A',
            tipo_epi: e.epi_types?.name || 'N/A',
            ca: e.epi_types?.ca_number || 'N/A',
            delivery_date: e.delivery_date,
            return_date: e.return_date,
            status: e.status,
            justification: e.justification,
          };
        });

        let output: any = { total: formattedData.length, epis: formattedData };

        if (agrupar_por) {
          const grouped: Record<string, number> = {};
          for (const e of formattedData) {
            const key = (e as any)[agrupar_por] || 'Sem grupo';
            grouped[key] = (grouped[key] || 0) + 1;
          }
          output.agrupado_por = grouped;
        }

        return JSON.stringify(output);
      }

      case 'buscar_compras_global': {
        const { tipo = 'requests', status, data_inicio, data_fim, departamento, limite = 50, ordenar_por = 'created_at', ordem = 'desc', agrupar_por, busca } = args;
        
        const table = tipo === 'orders' ? 'purchase_orders' : 'purchase_requests';
        const userColumn = tipo === 'orders' ? 'user_id' : 'created_by';

        const result = await executeGlobalSearchQuery({
          table,
          select: '*',
          userId,
          userRole,
          userColumn,
          filters: { status, data_inicio, data_fim, departamento, busca },
          limit: Math.min(limite, 200),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const formattedData = result.data.map((c: any) => ({
          id: c.id,
          numero: c.rqf_number || c.po_number || c.id,
          tipo: tipo === 'orders' ? 'Pedido' : 'Solicitação',
          status: c.status,
          valor: c.total_value || c.total_amount || c.valor_total || 0,
          descricao: c.description || c.descricao || c.provider_name || '-',
          created_at: c.created_at,
          created_by: c.created_by || c.user_id,
        }));

        let output: any = { total: formattedData.length, compras: formattedData };

        if (agrupar_por && agrupar_por !== 'created_by') {
          const grouped: Record<string, number> = {};
          for (const c of formattedData) {
            const key = (c as any)[agrupar_por] || 'Sem grupo';
            grouped[key] = (grouped[key] || 0) + 1;
          }
          output.agrupado_por = grouped;
        }

        return JSON.stringify(output);
      }

      case 'buscar_ponto_global': {
        const { status, data_inicio, data_fim, departamento, limite = 100, ordenar_por = 'created_at', ordem = 'desc', agrupar_por, busca } = args;
        
        const result = await executeGlobalSearchQuery({
          table: 'registros_presenca',
          select: 'id, user_id, nome_completo, funcao, empresa, created_at, lista_presenca(titulo, local, data_evento)',
          userId,
          userRole,
          filters: { data_inicio, data_fim, departamento, busca },
          limit: Math.min(limite, 500),
          orderBy: { column: ordenar_por, ascending: ordem === 'asc' }
        });

        if (!result.success) return result.error!;

        const formattedData = result.data.map((r: any) => ({
          id: r.id,
          usuario: r.nome_completo || 'N/A',
          funcao: r.funcao || 'N/A',
          empresa: r.empresa || 'N/A',
          evento: r.lista_presenca?.titulo || 'Presença Manual',
          local: r.lista_presenca?.local || '-',
          data_evento: r.lista_presenca?.data_evento || r.created_at,
          registrado_em: r.created_at,
        }));

        let output: any = { total: formattedData.length, registros: formattedData };

        if (agrupar_por) {
          const grouped: Record<string, number> = {};
          for (const r of formattedData) {
            const key = (r as any)[agrupar_por] || 'Sem grupo';
            grouped[key] = (grouped[key] || 0) + 1;
          }
          output.agrupado_por = grouped;
        }

        return JSON.stringify(output);
      }

      case 'gerar_planilha_excel': {
        const { tipo_dados, filtros = {}, titulo, destino, email_destino } = args;
        
        let data: any[] = [];
        let columns: any[] = [];
        let periodo = { inicio: filtros.data_inicio || 'Início', fim: filtros.data_fim || 'Atual' };

        // Configuration for different data types
        const configMap: Record<string, any> = {
          'reembolsos': {
            table: 'Reimbursement',
            select: 'id, user_id, status, valorTotal, descricao, data, categoria',
            userColumn: 'user_id',
            formatter: formatReembolsosForExcel,
            dateColumn: 'data'
          },
          'ferias': {
            table: 'leave_requests',
            select: 'id, user_id, start_date, end_date, status, reason',
            userColumn: 'user_id',
            formatter: formatFeriasForExcel,
            dateColumn: 'start_date'
          },
          'avaliacoes': {
            table: 'avaliacoes_desempenho',
            select: 'id, colaborador_id, nota_final, status, periodo_id, created_at',
            userColumn: 'colaborador_id',
            formatter: formatAvaliacoesForExcel,
            dateColumn: 'created_at'
          },
          'usuarios': {
            table: 'users_unified',
            select: 'id, first_name, last_name, email, role, department, position, status, created_at',
            userColumn: 'id',
            formatter: formatUsuariosForExcel,
            dateColumn: 'created_at'
          },
          'epis': {
            table: 'epi_registrations',
            select: 'id, user_id, delivery_date, status, epi_types(name, ca_number)',
            userColumn: 'user_id',
            formatter: formatEpisForExcel,
            dateColumn: 'delivery_date'
          },
          'ponto': {
            table: 'registros_presenca',
            select: 'id, user_id, nome_completo, funcao, empresa, created_at, lista_presenca(titulo, local, data_evento)',
            userColumn: 'user_id',
            formatter: formatPontoForExcel,
            dateColumn: 'created_at'
          },
          'compras': {
            table: 'purchase_requests',
            select: 'id, created_by, status, total_value, description, provider_name, buyer_name, rqf_number, created_at',
            userColumn: 'created_by',
            formatter: formatComprasForExcel,
            dateColumn: 'created_at'
          },
          'eventos': {
            table: 'calendar_events',
            select: 'id, user_id, summary, description, start_time, end_time, location, created_at',
            userColumn: 'user_id',
            formatter: formatEventosForExcel,
            dateColumn: 'start_time'
          },
          'cursos': {
            table: 'academy_courses',
            select: 'id, title, description, level, is_active, created_at, academy_categories(name)',
            userColumn: 'id',
            formatter: formatCursosForExcel,
            dateColumn: 'created_at',
            skipUserEnrichment: true
          }
        };

        const config = configMap[tipo_dados];
        if (!config) return `Tipo de dados não suportado para planilha: ${tipo_dados}`;

        // Cursos Academy: catálogo global (não filtra por user_id)
        let result: { success: boolean; error?: string; data: any[] };
        if (tipo_dados === 'cursos') {
          let q = supabaseAdmin
            .from('academy_courses')
            .select(config.select)
            .order(config.dateColumn, { ascending: false })
            .limit(1000);
          if (filtros.busca) q = q.ilike('title', `%${filtros.busca}%`);
          if (filtros.status === 'active' || filtros.status === true) q = q.eq('is_active', true);
          const { data: cursosData, error: cursosErr } = await q;
          if (cursosErr) return `Erro ao buscar cursos: ${cursosErr.message}`;
          result = { success: true, data: cursosData || [] };
        } else {
          result = await executeGlobalSearchQuery({
            table: config.table,
            select: config.select,
            userId,
            userRole,
            userColumn: config.userColumn,
            filters: { 
              status: filtros.status, 
              data_inicio: filtros.data_inicio, 
              data_fim: filtros.data_fim, 
              departamento: filtros.departamento || filtros.department,
              busca: filtros.busca 
            },
            limit: 1000,
            orderBy: { column: config.dateColumn, ascending: false }
          });
        }

        if (!result.success) return result.error!;

        // Enrichment
        const userMap = config.skipUserEnrichment
          ? new Map()
          : await fetchAssociatedUsers(result.data, config.userColumn);

        // Transform for spreadsheet
        data = result.data.map((item: any) => {
          const u = userMap.get(item[config.userColumn]);
          const base = {
            usuario: u ? `${u.first_name} ${u.last_name}`.trim() : (item.nome_completo || 'N/A'),
            email: u?.email || '-',
            departamento: u?.department || '-',
            ...item
          };

          // Specific adjustments
          if (tipo_dados === 'reembolsos') base.valor = item.valorTotal;
          if (tipo_dados === 'avaliacoes') {
            base.colaborador_id = item.colaborador_id;
            base.nota = item.nota_final;
            base.periodo = item.periodo_id;
          }
          if (tipo_dados === 'ferias') {
            const start = new Date(item.start_date);
            const end = new Date(item.end_date);
            base.dias = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }
          if (tipo_dados === 'epis') {
            base.tipo_epi = item.epi_types?.name || 'N/A';
            base.ca = item.epi_types?.ca_number || 'N/A';
          }
          if (tipo_dados === 'usuarios') {
            base.nome = base.usuario;
          }
          if (tipo_dados === 'ponto') {
            base.evento = item.lista_presenca?.titulo || 'Presença Manual';
            base.local = item.lista_presenca?.local || '-';
            base.data_evento = item.lista_presenca?.data_evento || item.created_at;
            base.registrado_em = item.created_at;
          }
          if (tipo_dados === 'compras') {
            base.numero = item.rqf_number || item.id;
            base.valor = item.total_value || 0;
          }
          if (tipo_dados === 'cursos') {
            base.categoria = item.academy_categories?.name || '-';
          }

          return base;
        });

        const formatted = config.formatter(data);
        columns = formatted.columns;

        const buffer = generateExcelReport(data, columns, {
          titulo: titulo || `Relatório de ${tipo_dados}`,
          periodo,
          gerarPor: userId,
        });

        const base64 = buffer.toString('base64');
        const filename = `${(titulo || tipo_dados).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        const totalValor = data.reduce((sum: number, r: any) => sum + (parseFloat(r.valor || r.valorTotal || 0)), 0);

        if (destino === 'email' && email_destino) {
          const summary = `Total de ${data.length} registros${totalValor > 0 ? ` | Valor Total: R$ ${totalValor.toFixed(2)}` : ''}`;
          const emailResult = await sendReportEmail(
            email_destino,
            titulo || `Relatório de ${tipo_dados}`,
            tipo_dados,
            base64,
            filename,
            summary
          );

          if (emailResult.success) {
            return JSON.stringify({
              success: true,
              message: `✅ Planilha gerada com ${data.length} registros e enviada para ${email_destino}!`,
              formato: 'xlsx',
              registros: data.length,
              valor_total: totalValor,
              destino: 'email',
              email_enviado: email_destino,
              message_id: emailResult.messageId,
              base64_preview: base64.substring(0, 100) + '...',
            });
          } else {
            return JSON.stringify({
              success: false,
              message: `Planilha gerada mas falha ao enviar email: ${emailResult.error}`,
              formato: 'xlsx',
              base64: base64,
              filename: filename,
              registros: data.length,
              erro_email: emailResult.error,
            });
          }
        }

        return JSON.stringify({
          success: true,
          message: `✅ Planilha gerada com ${data.length} registros`,
          formato: 'xlsx',
          base64: base64,
          filename: filename,
          registros: data.length,
          valor_total: totalValor,
          tamanho_bytes: buffer.length,
          instrucao: 'O base64 abaixo pode ser decodificado para obter o arquivo Excel',
        });
      }

      case 'gerar_relatorio_pdf': {
        const { tipo_dados, filtros = {}, titulo, periodo, destino, email_destino } = args;
        
        console.log('[IA Tools] Gerando relatório PDF real:', { tipo_dados, destino, email_destino });

        let dados: any[] = [];
        let pdfBase64 = '';
        let totalValor = 0;

        try {
          const configMap: Record<string, any> = {
            'resumo': { table: 'Reimbursement', select: 'id, user_id, status, valorTotal, data, descricao, tipo_reembolso', userColumn: 'user_id', dateColumn: 'data' },
            'reembolsos': { table: 'Reimbursement', select: 'id, user_id, status, valorTotal, data, descricao, tipo_reembolso', userColumn: 'user_id', dateColumn: 'data' },
            'ferias': { table: 'leave_requests', select: 'id, user_id, start_date, end_date, status', userColumn: 'user_id', dateColumn: 'start_date' },
            'avaliacoes': { table: 'avaliacoes_desempenho', select: 'id, colaborador_id, nota_final, status, periodo_id, data_inicio, data_fim', userColumn: 'colaborador_id', dateColumn: 'created_at' },
            'usuarios': { table: 'users_unified', select: 'id, first_name, last_name, email, department, position, status', userColumn: 'id', dateColumn: 'created_at' },
            'ponto': { table: 'registros_presenca', select: 'id, user_id, nome_completo, funcao, empresa, created_at, lista_presenca(titulo, local, data_evento)', userColumn: 'user_id', dateColumn: 'created_at' },
            'epis': { table: 'epi_registrations', select: 'id, user_id, delivery_date, status, epi_types(name, ca_number)', userColumn: 'user_id', dateColumn: 'delivery_date' },
            'compras': { table: 'purchase_requests', select: 'id, created_by, status, total_value, description, provider_name, buyer_name, rqf_number, created_at', userColumn: 'created_by', dateColumn: 'created_at' },
          };

          const config = configMap[tipo_dados];
          if (!config) return `Tipo de relatório não suportado: ${tipo_dados}`;

          if (tipo_dados === 'usuarios' && userRole !== 'ADMIN') {
            return 'Acesso negado. Apenas administradores podem gerar relatórios de usuários.';
          }

          const result = await executeGlobalSearchQuery({
            table: config.table,
            select: config.select,
            userId,
            userRole,
            userColumn: config.userColumn,
            filters: { 
              status: filtros.status, 
              data_inicio: filtros.data_inicio, 
              data_fim: filtros.data_fim, 
              departamento: filtros.departamento || filtros.department,
              busca: filtros.busca 
            },
            limit: 500,
            orderBy: { column: config.dateColumn, ascending: false }
          });

          if (!result.success) return result.error!;

          const userMap = await fetchAssociatedUsers(result.data, config.userColumn);

          dados = result.data.map((item: any) => {
            const u = userMap.get(item[config.userColumn]);
            const base: any = {
              usuario: u ? u.first_name : 'Unknown',
              departamento: u?.department || 'Geral',
              ...item
            };

            if (tipo_dados === 'reembolsos' || tipo_dados === 'resumo') {
              base.valor = item.valorTotal || 0;
              totalValor += parseFloat(base.valor);
            }

            if (tipo_dados === 'ferias') {
              base.dias = item.start_date && item.end_date ? Math.ceil((new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            }

            if (tipo_dados === 'avaliacoes') {
              base.nota = item.nota_final || '-';
              base.periodo = item.periodo_id || '-';
            }

            if (tipo_dados === 'usuarios') {
              base.nome = `${item.first_name || ''} ${item.last_name || ''}`.trim();
              base.cargo = item.position || '-';
            }

            if (tipo_dados === 'ponto') {
              base.evento = item.lista_presenca?.titulo || 'Presença Manual';
              base.local = item.lista_presenca?.local || '-';
              base.usuario = item.nome_completo || base.usuario;
            }

            if (tipo_dados === 'epis') {
              base.tipo_epi = item.epi_types?.name || 'N/A';
              base.ca = item.epi_types?.ca_number || 'N/A';
            }

            if (tipo_dados === 'compras') {
              base.numero = item.rqf_number || item.id;
              base.valor = item.total_value || 0;
              totalValor += parseFloat(String(base.valor)) || 0;
            }

            return base;
          });

          const reportTitulo = titulo || `Relatório de ${tipo_dados}`;
          pdfBase64 = generatePDFBase64(dados, tipo_dados as any, {
            titulo: reportTitulo,
            periodo: periodo,
            gerarPor: userId,
            incluirGraficos: false,
          });

          if (destino === 'email' && email_destino) {
            const summary = tipo_dados === 'reembolsos' || tipo_dados === 'resumo' 
              ? `Total de registros: ${dados.length} | Valor Total: R$ ${totalValor.toFixed(2).replace('.', ',')}`
              : `Total de registros: ${dados.length}`;

            const emailResult = await sendReportEmail(
              email_destino,
              reportTitulo,
              tipo_dados,
              pdfBase64,
              `${reportTitulo.replace(/\s+/g, '_')}.pdf`,
              summary
            );

            if (emailResult.success) {
              return JSON.stringify({
                success: true,
                message: `✅ Relatório PDF enviado com sucesso para ${email_destino}!`,
                tipo: tipo_dados,
                registros: dados.length,
                valor_total: totalValor,
                destino: 'email',
                destinatario: email_destino,
                message_id: emailResult.messageId,
              });
            } else {
              return JSON.stringify({
                success: false,
                error: `Falha ao enviar email: ${emailResult.error}`,
                tipo: tipo_dados,
                registros: dados.length,
                pdf_base64: pdfBase64.substring(0, 100) + '...',
              });
            }
          }

          return JSON.stringify({
            success: true,
            message: `✅ Relatório PDF gerado com sucesso!`,
            tipo: tipo_dados,
            registros: dados.length,
            valor_total: totalValor,
            destino: 'download',
            pdf_base64: pdfBase64,
            tamanho_bytes: Math.ceil(pdfBase64.length * 0.75),
            instrucao: 'O base64 pode ser decodificado para obter o arquivo PDF.',
          });

        } catch (err) {
          console.error('[IA Tools] Erro ao gerar relatório:', err);
          return JSON.stringify({
            success: false,
            error: `Erro ao gerar relatório: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      case 'enviar_email_relatorio': {
        const { para, assunto, corpo, dados_anexo, titulo_anexo, anexo_tipo } = args;
        const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' ? 'GERENTE' : 'USER');

        if (effectiveRole !== 'ADMIN') {
          return 'Acesso negado. Apenas administradores podem enviar emails.';
        }

        console.log('[IA Tools] Enviando email real para:', para);

        try {
          let attachments: any[] = [];

          // Se tem dados de anexo, gerar o arquivo
          if (dados_anexo && titulo_anexo) {
            if (anexo_tipo === 'xlsx' || titulo_anexo.endsWith('.xlsx')) {
               // Gerar Excel
               const excelBase64 = generateExcelReport(dados_anexo, 'resumo' as any, { titulo: titulo_anexo });
              attachments.push({
                filename: titulo_anexo,
                content: excelBase64,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });
            } else if (anexo_tipo === 'pdf' || titulo_anexo.endsWith('.pdf')) {
              // Gerar PDF
              const pdfBase64 = generatePDFBase64(dados_anexo, 'resumo' as any, {
                titulo: titulo_anexo.replace('.pdf', ''),
                gerarPor: userId,
              });
              attachments.push({
                filename: titulo_anexo,
                content: pdfBase64,
                contentType: 'application/pdf',
              });
            }
          }

          // Enviar email usando nodemailer diretamente
          const result = await sendEmailWithNodemailer({
            to: para,
            subject: assunto,
            html: corpo,
            attachments: attachments.length > 0 ? attachments : undefined,
          });

          if (result.success) {
            return JSON.stringify({
              success: true,
              message: `✅ Email enviado com sucesso para ${para}!`,
              destinatario: para,
              assunto,
              message_id: result.messageId,
              has_attachments: attachments.length > 0,
            });
          } else {
            return JSON.stringify({
              success: false,
              error: `Falha ao enviar email: ${result.error}`,
              destinatario: para,
              assunto,
            });
          }
        } catch (err) {
          console.error('[IA Tools] Erro ao enviar email:', err);
          return `Erro ao enviar email: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      case 'analisar_tendencias': {
        const { tipo_analise, periodo, grupo } = args;
        const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' ? 'GERENTE' : 'USER');

        const accessInfo = await getAccessibleUserIdsForGlobal(userId, effectiveRole);
        if (!accessInfo.hasAccess) {
          return accessInfo.error || 'Acesso negado';
        }

        const insights: string[] = [];

        if (tipo_analise === 'reembolsos' || tipo_analise === 'geral') {
          const { data: reemb } = await supabaseAdmin
            .from('Reimbursement')
            .select('status, valorTotal')
            .in('user_id', accessInfo.ids || [])
            .limit(500);

          const pendentes = (reemb || []).filter((r: any) => r.status === 'pendente');
          const totalPendente = pendentes.reduce((sum: number, r: any) => sum + (parseFloat(r.valorTotal) || 0), 0);
          const aprovados = (reemb || []).filter((r: any) => r.status === 'aprovado');

          if (pendentes.length > 10) {
            insights.push(`⚠️ Há ${pendentes.length} reembolsos pendentes totalizando R$ ${totalPendente.toLocaleString('pt-BR')}. Considere verificar com os aprovadores.`);
          }
          if (aprovados.length > 0) {
            insights.push(`✅ ${aprovados.length} reembolsos foram aprovados recentemente.`);
          }
        }

        if (tipo_analise === 'ferias' || tipo_analise === 'geral') {
          const { data: ferias } = await supabaseAdmin
            .from('leave_requests')
            .select('status')
            .in('user_id', accessInfo.ids || [])
            .limit(500);

          const pendentes = (ferias || []).filter((f: any) => f.status === 'pending');
          if (pendentes.length > 5) {
            insights.push(`📅 ${pendentes.length} solicitações de férias aguardando aprovação.`);
          }
        }

        if (tipo_analise === 'avaliacoes' || tipo_analise === 'geral') {
          const { data: avals } = await supabaseAdmin
            .from('avaliacoes_desempenho')
            .select('status, nota_final')
            .in('colaborador_id', accessInfo.ids || [])
            .limit(200);

          const pendentes = (avals || []).filter((a: any) => a.status === 'pendente' || a.status === 'pendente_autoavaliacao');
          if (pendentes.length > 0) {
            insights.push(`📊 ${pendentes.length} avaliações de desempenho pendentes.`);
          }

          const notas = (avals || []).filter((a: any) => a.nota_final != null).map((a: any) => a.nota_final);
          if (notas.length > 0) {
            const media = notas.reduce((a: number, b: number) => a + b, 0) / notas.length;
            insights.push(`📈 Média de notas das avaliações: ${media.toFixed(2)}`);
          }
        }

        if (insights.length === 0) {
          insights.push('📊 Não foram detectados padrões significativos no período analisado.');
        }

        return JSON.stringify({
          tipo_analise,
          periodo: periodo || 'Últimos 30 dias',
          insights,
          gerado_em: new Date().toLocaleString('pt-BR'),
          sugerir_relatorio: insights.length > 0,
        });
      }

      case 'buscar_ferias': {
        const {
          funcionario_id,
          status: statusRaw,
          ano,
          incluir_historico = true,
          limite = 50,
        } = args || {};
        const targetId = (funcionario_id && String(funcionario_id).trim()) || userId;
        const effectiveRole =
          userRole === 'ADMIN' ? 'ADMIN' : userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER';
        const hasAccess = await canAccessUserData(userId, effectiveRole as any, targetId);
        if (!hasAccess) {
          return JSON.stringify({
            success: false,
            error: 'Sem permissão para ver férias deste usuário.',
            _summary: 'buscar_ferias: acesso negado',
          });
        }

        const statusNorm = normalizeLeaveStatus(statusRaw) || statusRaw;
        let query = supabaseAdmin
          .from('leave_requests')
          .select(
            'id, start_date, end_date, status, justification, created_at, updated_at, user_id, pecuniary_allowance, advance_13th_salary, periods'
          )
          .eq('user_id', targetId)
          .order('start_date', { ascending: false })
          .limit(Math.min(Number(limite) || 50, 100));

        if (statusNorm) {
          query = query.eq('status', statusNorm);
        }
        if (ano && Number(ano) >= 2000 && Number(ano) <= 2100) {
          query = query.gte('start_date', `${ano}-01-01`).lte('start_date', `${ano}-12-31`);
        }
        if (incluir_historico === false) {
          const today = new Date().toISOString().slice(0, 10);
          query = query.gte('end_date', today);
        }

        const { data, error } = await query;
        if (error) {
          return JSON.stringify({ success: false, error: error.message, _summary: `buscar_ferias: erro ${error.message}` });
        }
        if (!data || data.length === 0) {
          return JSON.stringify({
            success: true,
            total: 0,
            ferias: [],
            escopo: targetId === userId ? 'proprio' : 'outro',
            filtros: { status: statusNorm || null, ano: ano || null, incluir_historico },
            _summary: 'buscar_ferias: nenhuma solicitação encontrada',
          });
        }

        const pendentes = data.filter(
          (f) => f.status === 'PENDING_LEADER' || f.status === 'PENDING_MANAGER'
        );
        const passadas = data.filter((f) => f.end_date < new Date().toISOString().slice(0, 10));
        return JSON.stringify({
          success: true,
          total: data.length,
          pendentes_count: pendentes.length,
          historico_count: passadas.length,
          ferias: data,
          escopo: targetId === userId ? 'proprio' : 'outro',
          filtros: { status: statusNorm || null, ano: ano || null, incluir_historico },
          _summary: `buscar_ferias: ${data.length} registro(s), ${pendentes.length} pendente(s), ${passadas.length} no passado`,
        });
      }

      case 'buscar_reembolsos': {
        // Suporte a múltiplos identificadores: funcionario_id (UUID), cpf ou email; default = usuário logado
        const { funcionario_id, cpf, email, status, limite = 50 } = args || {};

        let resolvedUserId = funcionario_id;
        let resolvedEmail: string | null = email || null;

        if (!resolvedUserId && !cpf && !email) {
          resolvedUserId = userId;
        }

        if (!resolvedUserId) {
          if (cpf) {
            const { data, error } = await supabaseAdmin
              .from('users_unified')
              .select('id, email')
              .eq('cpf', cpf)
              .maybeSingle();
            if (error || !data) {
              return JSON.stringify({
                success: false,
                error: 'Usuário com CPF não encontrado.',
                _summary: 'buscar_reembolsos: CPF não encontrado',
              });
            }
            resolvedUserId = data.id;
            resolvedEmail = data.email;
          } else if (email) {
            const { data, error } = await supabaseAdmin
              .from('users_unified')
              .select('id, email')
              .eq('email', email)
              .maybeSingle();
            if (error || !data) {
              return JSON.stringify({
                success: false,
                error: 'Usuário com email não encontrado.',
                _summary: 'buscar_reembolsos: email não encontrado',
              });
            }
            resolvedUserId = data.id;
            resolvedEmail = data.email;
          }
        } else if (!resolvedEmail) {
          const { data } = await supabaseAdmin
            .from('users_unified')
            .select('email')
            .eq('id', resolvedUserId)
            .maybeSingle();
          resolvedEmail = data?.email || null;
        }

        if (!resolvedUserId && !resolvedEmail) {
          return JSON.stringify({
            success: false,
            error: 'Informe funcionario_id, CPF ou email (ou omita para seus próprios reembolsos).',
            _summary: 'buscar_reembolsos: identificador ausente',
          });
        }

        if (resolvedUserId) {
          const effectiveRole =
            userRole === 'ADMIN' ? 'ADMIN' : userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER';
          const hasAccess = await canAccessUserData(userId, effectiveRole as any, resolvedUserId);
          if (!hasAccess) {
            return JSON.stringify({
              success: false,
              error: 'Sem permissão para ver reembolsos deste usuário.',
              _summary: 'buscar_reembolsos: acesso negado',
            });
          }
        }

        let data: any[] | null = null;
        let error: any = null;
        const lim = Math.min(Number(limite) || 50, 100);

        if (resolvedUserId) {
          let byUser = supabaseAdmin
            .from('Reimbursement')
            .select('id, status, valorTotal, descricao, data, email, user_id, tipo_reembolso')
            .eq('user_id', resolvedUserId)
            .order('data', { ascending: false })
            .limit(lim);
          if (status) byUser = byUser.eq('status', status);
          const res = await byUser;
          data = res.data;
          error = res.error;
        }

        if ((!data || data.length === 0) && resolvedEmail) {
          let byEmail = supabaseAdmin
            .from('Reimbursement')
            .select('id, status, valorTotal, descricao, data, email, user_id, tipo_reembolso')
            .eq('email', resolvedEmail)
            .order('data', { ascending: false })
            .limit(lim);
          if (status) byEmail = byEmail.eq('status', status);
          const res = await byEmail;
          data = res.data;
          error = res.error || error;
        }

        if (error) {
          return JSON.stringify({
            success: false,
            error: error.message,
            _summary: `buscar_reembolsos: erro ${error.message}`,
          });
        }
        if (!data || data.length === 0) {
          return JSON.stringify({
            success: true,
            total: 0,
            reembolsos: [],
            escopo: resolvedUserId === userId ? 'proprio' : 'outro',
            _summary: 'buscar_reembolsos: nenhum encontrado',
          });
        }

        const pendentes = data.filter((r) => String(r.status).toLowerCase() === 'pendente');
        const totalPendente = pendentes.reduce((sum, r) => sum + (parseFloat(r.valorTotal) || 0), 0);
        return JSON.stringify({
          success: true,
          total: data.length,
          pendentes_count: pendentes.length,
          total_pendente: totalPendente,
          reembolsos: data,
          escopo: resolvedUserId === userId ? 'proprio' : 'outro',
          _summary: `buscar_reembolsos: ${data.length} registro(s), ${pendentes.length} pendente(s), R$ ${totalPendente}`,
        });
      }
      
      case 'buscar_escala_mio': {
        const { cpf } = args;
        const cleanCpf = String(cpf || '').replace(/\D/g, '');
        const { data: cols } = await supabaseAdmin
          .from('gt_colaboradores')
          .select('id, cpf')
          .is('deleted_at', null);
        const ids = (cols || [])
          .filter((c) => String(c.cpf || '').replace(/\D/g, '') === cleanCpf)
          .map((c) => c.id);
        if (ids.length === 0) {
          return JSON.stringify({ success: true, embarques: [], _summary: 'buscar_escala_mio: colaborador não encontrado no banco local' });
        }
        const { data: embarques } = await supabaseAdmin
          .from('gt_historico_embarques')
          .select('id, data_embarque, data_desembarque, data_prevista_desembarque, local_embarque, local_desembarque, tipo, origem')
          .in('colaborador_id', ids)
          .is('deleted_at', null)
          .order('data_embarque', { ascending: false })
          .limit(10);
        if (!embarques || embarques.length === 0) {
          return `Nenhuma escala ou embarque encontrado no banco local para o CPF fornecido.`;
        }
        return JSON.stringify({ success: true, embarques, _summary: `buscar_escala_mio: ${embarques.length} embarque(s) locais` });
      }

      case 'buscar_treinamentos_mio': {
        const { cpf } = args;
        const cleanCpf = String(cpf || '').replace(/\D/g, '');
        const { data: cols } = await supabaseAdmin
          .from('gt_colaboradores')
          .select('id, cpf')
          .is('deleted_at', null);
        const ids = (cols || [])
          .filter((c) => String(c.cpf || '').replace(/\D/g, '') === cleanCpf)
          .map((c) => c.id);
        if (ids.length === 0) {
          return JSON.stringify({ success: true, treinamentos: [], _summary: 'buscar_treinamentos_mio: colaborador não encontrado no banco local' });
        }
        const { data: treinamentos } = await supabaseAdmin
          .from('gt_documentos')
          .select('id, titulo, subtipo, numero_documento, data_emissao, data_validade, status_validacao, origem')
          .in('colaborador_id', ids)
          .eq('tipo_documento', 'treinamento')
          .is('deleted_at', null)
          .order('data_validade', { ascending: false, nullsFirst: false })
          .limit(20);
        if (!treinamentos || treinamentos.length === 0) {
          return `Nenhum treinamento encontrado no banco local para o CPF fornecido.`;
        }
        return JSON.stringify({ success: true, treinamentos, _summary: `buscar_treinamentos_mio: ${treinamentos.length} treinamento(s) locais` });
      }

      case 'ler_email_funcionario': {
        if (userRole !== 'ADMIN') {
          return `Acesso negado. Apenas administradores podem ler e-mails de outros funcionários.`;
        }
        
        const {
          email_corporativo,
          consulta,
          de,
          para,
          assunto,
          data_inicio,
          data_fim,
          pasta,
          apenas_nao_lidos,
          com_anexos,
          incluir_corpo,
          limite,
        } = args;

        try {
          const emails = await msGraphClient.searchEmails(email_corporativo, consulta, {
            from: de,
            to: para,
            subject: assunto,
            dateFrom: data_inicio,
            dateTo: data_fim,
            folder: pasta,
            isRead: apenas_nao_lidos === true ? false : undefined,
            hasAttachments: com_anexos === true ? true : undefined,
            includeBody: !!incluir_corpo,
            top: resolveGraphLimit(limite, 50),
          });
          if (emails.length === 0) {
            return await getGlobalUserEmails(email_corporativo, {
              limite: resolveGraphLimit(limite, 50),
              de,
              assunto,
              data_inicio,
              data_fim,
              pasta,
              incluir_corpo: !!incluir_corpo,
            });
          }
          return JSON.stringify(
            buildEmailListPayload(emails, {
              includeBody: !!incluir_corpo,
              folderHint: pasta,
              limiteAplicado: resolveGraphLimit(limite, 50),
              hardCap: GRAPH_HARD_CAP,
              maxItems: resolveGraphLimit(limite, 50),
            })
          );
        } catch (err) {
          return await getGlobalUserEmails(email_corporativo, {
            limite: resolveGraphLimit(limite, 50),
            de,
            assunto,
            data_inicio,
            data_fim,
            pasta,
            incluir_corpo: !!incluir_corpo,
          });
        }
      }

      case 'buscar_epis': {
        const { funcionario_id } = args;
        const { data, error } = await supabaseAdmin
          .from('epi_registrations')
          .select('id, delivery_date, status, return_date, epi_types(name, ca_number), justification')
          .eq('user_id', funcionario_id)
          .order('delivery_date', { ascending: false })
          .limit(10);
          
        if (error) return `Erro ao buscar EPIs: ${error.message}`;
        if (!data || data.length === 0) return `Nenhum EPI encontrado para este funcionário.`;
        return JSON.stringify(data);
      }

      case 'buscar_avaliacoes_desempenho': {
        const { funcionario_id } = args;
        const { data, error } = await supabaseAdmin
          .from('avaliacoes_desempenho')
          .select('id, nota_final, status, periodo_id, created_at')
          .eq('colaborador_id', funcionario_id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) return `Erro ao buscar avaliações: ${error.message}`;
        if (!data || data.length === 0) return `Nenhuma avaliação de desempenho encontrada para este funcionário.`;
        return JSON.stringify(data);
      }

      case 'buscar_documento_corporativo': {
         const { termo_pesquisa, categoria } = args;
         const termoStr = String(termo_pesquisa);
         
         // 1. Buscar no Portal ABZ
         let query = supabaseAdmin
           .from('documents')
           .select('id, title, description, category, subcategory, file_url, created_at')
           .or(`title.ilike.%${termoStr}%,description.ilike.%${termoStr}%`)
           .order('created_at', { ascending: false })
           .limit(10);
         
         if (categoria) {
           query = query.ilike('category', `%${categoria}%`);
         }

        const { data: portalDocs } = await query;
        const portalResults = (portalDocs || []).map((d: any) => ({
          fonte: 'Portal ABZ',
          título: d.title,
          descrição: d.description,
          categoria: d.category,
          subcategoria: d.subcategory,
          link: d.file_url,
          publicado_em: new Date(d.created_at).toLocaleDateString('pt-BR'),
        }));

        // 2. Buscar no SharePoint via Graph (fallback)
        let spResults: any[] = [];
        try {
           const spFiles = await msGraphClient.searchOneDriveFiles(userId, termoStr);
          spResults = spFiles.slice(0, 5).map((f: any) => ({
            fonte: 'SharePoint / OneDrive',
            título: f.name,
            descrição: f.description || '',
            link: f.webUrl,
            tamanho: f.size ? `${(f.size / 1024).toFixed(1)} KB` : '',
          }));
        } catch { /* SharePoint indisponível, continuar com portal */ }

        const allResults = [...portalResults, ...spResults];
        if (allResults.length === 0) return `Nenhum documento encontrado com o termo "${termo_pesquisa}".`;
        return JSON.stringify(allResults);
      }

      case 'buscar_noticias_recentes': {
        const limite = Math.min(args.limite || 5, 10);
        const { data, error } = await supabaseAdmin
          .from('news')
          .select('id, title, summary, published_at, created_at')
          .eq('published', true)
          .order('published_at', { ascending: false })
          .limit(limite);

        if (error) return `Erro ao buscar notícias: ${error.message}`;
        if (!data || data.length === 0) return `Nenhuma notícia publicada encontrada.`;
        return JSON.stringify(data.map((n: any) => ({
          título: n.title,
          resumo: n.summary,
          publicado_em: n.published_at
            ? new Date(n.published_at).toLocaleDateString('pt-BR')
            : new Date(n.created_at).toLocaleDateString('pt-BR'),
        })));
      }

      case 'buscar_eventos_calendario': {
        const { email, dias_futuros } = args;
        
        // ABORDAGEM HÍBRIDA: Tenta Graph primeiro, fallback para portal
        const days = dias_futuros || 7;
        let graphEvents: any[] = [];
        let portalEvents: any[] = [];

        // 1. Tentar Microsoft Graph (calendário corporativo)
        try {
          const graphData = await msGraphClient.listCalendarEvents(email, days);
          graphEvents = graphData.map((e: any) => ({
            fonte: 'Microsoft 365',
            título: e.subject,
            descrição: e.bodyPreview || '',
            início: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleString('pt-BR') : '',
            fim: e.end?.dateTime ? new Date(e.end.dateTime).toLocaleString('pt-BR') : '',
            local: e.location?.displayName || '',
            organizador: e.organizer?.emailAddress?.name || '',
            online: !!e.isOnlineMeeting,
          }));
        } catch { /* Graph indisponível */ }

        // 2. Buscar no portal ABZ (calendário interno)
        try {
          let resolvedUserId = null;
          if (email) {
            const { data: userData } = await supabaseAdmin
              .from('users_unified')
              .select('id')
              .eq('email', email.toLowerCase())
              .limit(1);
            if (userData && userData.length > 0) resolvedUserId = userData[0].id;
          }
          
          if (resolvedUserId) {
            const hoje = new Date().toISOString();
            const futuro = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

            const { data } = await supabaseAdmin
              .from('calendar_events')
              .select('id, summary, description, start_time, end_time, location')
              .eq('user_id', resolvedUserId)
              .gte('start_time', hoje)
              .lte('start_time', futuro)
              .order('start_time', { ascending: true })
              .limit(15);

            portalEvents = (data || []).map((e: any) => ({
              fonte: 'Portal ABZ',
              título: e.summary,
              descrição: e.description,
              início: new Date(e.start_time).toLocaleString('pt-BR'),
              fim: e.end_time ? new Date(e.end_time).toLocaleString('pt-BR') : null,
              local: e.location,
            }));
          }
        } catch { /* Portal indisponível */ }

        const allEvents = [...graphEvents, ...portalEvents];
        if (allEvents.length === 0) return `Nenhum evento encontrado nos próximos ${days} dias.`;
        return JSON.stringify(allEvents);
      }

      case 'buscar_kpis_sistema': {
        const {
          incluir_comunicacao,
          email_monitoramento,
          dias = 14,
          limite_sinais = 25,
        } = args || {};

        const isAdmin = userRole === 'ADMIN';
        const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER');

        // Non-admin: escopo pessoal/equipe via IDs acessíveis
        if (!isAdmin) {
          const access = await getAccessibleUserIdsForGlobal(userId, effectiveRole);
          const ids = access.ids; // null = sem restrição (não deve acontecer para USER), [] = sem acesso

          if (!access.hasAccess) {
            return JSON.stringify({
              success: false,
              error: access.error || 'Acesso negado.',
              _summary: 'buscar_kpis_sistema: acesso negado',
            });
          }

          let feriasQ = supabaseAdmin
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .in('status', ['PENDING_LEADER', 'PENDING_MANAGER']);
          let reembQ = supabaseAdmin
            .from('Reimbursement')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente');
          let avalQ = supabaseAdmin
            .from('avaliacoes_desempenho')
            .select('*', { count: 'exact', head: true })
            .in('status', ['pendente', 'pending', 'pendente_autoavaliacao', 'aguardando_aprovacao']);

          if (ids) {
            feriasQ = feriasQ.in('user_id', ids);
            reembQ = reembQ.in('user_id', ids);
            avalQ = avalQ.in('colaborador_id', ids);
          }

          const [
            { count: feriaspen },
            { count: reembolsopen },
            { count: avaliacoesp },
          ] = await Promise.all([feriasQ, reembQ, avalQ]);

          const pendencias = {
            ferias_pendentes: feriaspen || 0,
            reembolsos_pendentes: reembolsopen || 0,
            avaliacoes_pendentes: avaliacoesp || 0,
          };
          const totalPendencias =
            (feriaspen || 0) + (reembolsopen || 0) + (avaliacoesp || 0);

          return JSON.stringify({
            success: true,
            escopo: effectiveRole === 'GERENTE' ? 'equipe' : 'pessoal',
            ...pendencias,
            total_pendencias: totalPendencias,
            nota: 'KPIs de sistema globais são exclusivos de ADMIN. Este resultado é filtrado pelo seu RBAC. Para detalhe use buscar_dados_usuario(tipo=resumo).',
            gerado_em: new Date().toLocaleString('pt-BR'),
            _summary: `buscar_kpis_sistema (${effectiveRole}): ${totalPendencias} pendência(s) no escopo`,
          });
        }

        const [
          { count: totalUsuarios },
          { count: totalSessoes },
          { count: feriaspen },
          { count: reembolsopen },
          { count: comprasp },
          { count: avaliacoesp },
          { count: episp },
        ] = await Promise.all([
          supabaseAdmin.from('users_unified').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('ia_chat_sessions').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('leave_requests').select('*', { count: 'exact', head: true }).in('status', ['PENDING_LEADER', 'PENDING_MANAGER']),
          supabaseAdmin.from('Reimbursement').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
          supabaseAdmin.from('purchase_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'PENDING', 'aguardando', 'em_aprovacao']),
          supabaseAdmin.from('avaliacoes_desempenho').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'pending', 'pendente_autoavaliacao', 'aguardando_aprovacao']),
          supabaseAdmin.from('epi_registrations').select('*', { count: 'exact', head: true }).in('status', ['pending', 'approved']),
        ]);

        const pendencias = {
          ferias_pendentes: feriaspen,
          reembolsos_pendentes: reembolsopen,
          compras_pendentes: comprasp,
          avaliacoes_pendentes: avaliacoesp,
          epis_pendentes: episp,
        };

        const totalPendencias =
          (feriaspen || 0) + (reembolsopen || 0) + (comprasp || 0) + (avaliacoesp || 0) + (episp || 0);

        const shouldScanComms =
          incluir_comunicacao === true ||
          (incluir_comunicacao !== false && totalPendencias > 0);

        let comunicacao: any = null;
        if (shouldScanComms) {
          try {
            const { collectKpiCommunicationSignals } = await import('./kpi-comms-signals');
            let mailbox = email_monitoramento as string | undefined;
            if (!mailbox) {
              const { data: me } = await supabaseAdmin
                .from('users_unified')
                .select('email')
                .eq('id', userId)
                .maybeSingle();
              mailbox = me?.email || process.env.EMAIL_FROM || undefined;
            }
            if (mailbox) {
              comunicacao = await collectKpiCommunicationSignals({
                emailUsuario: mailbox,
                pendencias,
                dias: Number(dias) || 14,
                limite: Number(limite_sinais) || 25,
              });
            } else {
              comunicacao = { resumo: 'Mailbox de monitoramento não configurada.', email_sinais: [], teams_sinais: [] };
            }
          } catch (e) {
            comunicacao = {
              resumo: `Falha ao escanear comunicação: ${e instanceof Error ? e.message : String(e)}`,
              email_sinais: [],
              teams_sinais: [],
              erro: true,
            };
          }
        }

        return JSON.stringify({
          success: true,
          escopo: 'global',
          total_usuarios: totalUsuarios,
          total_sessoes_ia: totalSessoes,
          ...pendencias,
          total_pendencias: totalPendencias,
          comunicacao,
          gerado_em: new Date().toLocaleString('pt-BR'),
          _summary: `buscar_kpis_sistema: ${totalPendencias} pendência(s) globais`,
        });
      }

      case 'verificar_falhas_integracao_erp': {
        if (userRole !== 'ADMIN') return `Acesso negado. Apenas administradores podem verificar falhas de integração.`;

        // Verifica usuários sem CPF (não conseguem usar MIO)
        const { count: semCpf } = await supabaseAdmin
          .from('users_unified')
          .select('*', { count: 'exact', head: true })
          .is('cpf', null);

        // Verifica credenciais do Poliweb sem login_url configurado
        const { count: poliwebSemUrl } = await supabaseAdmin
          .from('poliweb_credentials')
          .select('*', { count: 'exact', head: true })
          .is('login_url', null);

        // Verifica integrações Microsoft expiradas
        const { count: msExpiradas } = await supabaseAdmin
          .from('user_integrations')
          .select('*', { count: 'exact', head: true })
          .eq('provider', 'microsoft_exchange')
          .lt('expires_at', new Date().toISOString());

        return JSON.stringify({
          usuarios_sem_cpf_mio: semCpf,
          poliweb_sem_url: poliwebSemUrl,
          integracoes_microsoft_expiradas: msExpiradas,
          verificado_em: new Date().toLocaleString('pt-BR'),
          recomendacao: semCpf && semCpf > 0
            ? `${semCpf} usuário(s) sem CPF cadastrado — eles não conseguem consultar dados no MIO.`
            : 'Nenhuma falha crítica detectada.',
        });
      }

      case 'buscar_solicitacoes_compra': {
        const { status, limite = 5 } = args;
        let query = supabaseAdmin
          .from('purchase_requests')
          .select('id, rqf_number, provider_name, buyer_name, total_value, status, created_at')
          .order('created_at', { ascending: false })
          .limit(limite);

        if (userRole !== 'ADMIN') {
          query = query.eq('created_by', userId);
        }

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) return `Erro ao buscar solicitações de compra: ${error.message}`;
        if (!data || data.length === 0) return `Nenhuma solicitação de compra encontrada.`;
        return JSON.stringify(data);
      }

      case 'buscar_pedidos_compra': {
        const { limite = 5 } = args;
        let query = supabaseAdmin
          .from('purchase_orders')
          .select('id, po_number, provider_name, buyer_name, total_value, status, created_at')
          .order('created_at', { ascending: false })
          .limit(limite);

        if (userRole !== 'ADMIN') {
          // No purchase_orders, o usuário pode ser o user_id (requisitante) ou estar em approver_ids
          query = query.or(`user_id.eq.${userId},approver_ids.cs.{${userId}}`);
        }

        const { data, error } = await query;
        if (error) return `Erro ao buscar pedidos de compra: ${error.message}`;
        if (!data || data.length === 0) return `Nenhum pedido de compra encontrado.`;
        return JSON.stringify(data);
      }

      case 'buscar_fornecedores': {
        const { termo } = args;
        const { data, error } = await supabaseAdmin
          .from('suppliers')
          .select('id, trade_name, legal_name, document_number, category')
          .or(`trade_name.ilike.%${termo}%,legal_name.ilike.%${termo}%,document_number.ilike.%${termo}%`)
          .limit(10);
        
        if (error) return `Erro ao buscar fornecedores: ${error.message}`;
        if (!data || data.length === 0) return `Nenhum fornecedor encontrado com o termo "${termo}".`;
        return JSON.stringify(data);
      }

      case 'buscar_cursos_disponiveis': {
        const { categoria } = args;
        let query = supabaseAdmin
          .from('academy_courses')
          .select('id, title, description, level, is_active, academy_categories!inner(name)')
          .eq('is_active', true);

        if (categoria) {
          query = query.ilike('academy_categories.name', `%${categoria}%`);
        }

        query = query.order('title');

        const { data, error } = await query;
        if (error) return `Erro ao buscar cursos: ${error.message}`;
        if (!data || data.length === 0) return `Nenhum curso disponível encontrado na Academy.`;
        return JSON.stringify(data);
      }

      case 'buscar_progresso_academy': {
        const { curso_id } = args;
        let query = supabaseAdmin
          .from('academy_enrollments')
          .select('id, enrolled_at, completed_at, course:academy_courses(id, title)')
          .eq('user_id', userId);

        if (curso_id) {
          query = query.eq('course_id', curso_id);
        }

        const { data, error } = await query;
        if (error) return `Erro ao buscar progresso na Academy: ${error.message}`;
        if (!data || data.length === 0) return `Nenhum progresso de curso encontrado para o seu usuário.`;
        return JSON.stringify(data);
      }

      // =====================================================
      // Microsoft Graph - Handlers das novas ferramentas
      // =====================================================

      case 'listar_contatos_outlook': {
        const { email, limite = 20 } = args;
        const contacts = await msGraphClient.listContacts(email, limite);
        if (!contacts.length) return `Nenhum contato encontrado para ${email}.`;
        return JSON.stringify(contacts);
      }

      case 'buscar_grupos_365': {
        const { limite = 50 } = args;
        const groups = await msGraphClient.listGroups(limite);
        if (!groups.length) return 'Nenhum grupo encontrado.';
        return JSON.stringify(groups);
      }

      case 'buscar_membros_grupo': {
        const { grupo_id } = args;
        const members = await msGraphClient.getGroupMembers(grupo_id);
        if (!members.length) return 'Nenhum membro encontrado neste grupo.';
        return JSON.stringify(members);
      }

      case 'buscar_info_organizacao': {
        const org = await msGraphClient.getOrganization();
        const domains = await msGraphClient.listDomains();
        return JSON.stringify({ organizacao: org, dominios: domains });
      }

      case 'buscar_alertas_seguranca': {
        const { limite = 20 } = args;
        const alerts = await msGraphClient.listSecurityAlerts(limite);
        if (!alerts.length) return 'Nenhum alerta de segurança ativo.';
        return JSON.stringify(alerts);
      }

      case 'buscar_incidentes_seguranca': {
        const { limite = 10 } = args;
        const incidents = await msGraphClient.getSecurityIncidents(limite);
        if (!incidents.length) return 'Nenhum incidente de segurança encontrado.';
        return JSON.stringify(incidents);
      }

      case 'buscar_logs_auditoria': {
        const { tipo, limite = 20 } = args;
        if (tipo === 'signin') {
          const signins = await msGraphClient.getSignInLogs(limite);
          if (!signins.length) return 'Nenhum log de sign-in encontrado.';
          return JSON.stringify(signins);
        }
        const audits = await msGraphClient.getAuditLogs(limite);
        if (!audits.length) return 'Nenhum log de auditoria encontrado.';
        return JSON.stringify(audits);
      }

      case 'listar_aplicacoes_azure': {
        const { limite = 50 } = args;
        const apps = await msGraphClient.listApplications(limite);
        if (!apps.length) return 'Nenhuma aplicação encontrada.';
        return JSON.stringify(apps);
      }

      case 'listar_dispositivos': {
        const { limite = 50 } = args;
        const devices = await msGraphClient.listDevices(limite);
        if (!devices.length) return 'Nenhum dispositivo encontrado.';
        return JSON.stringify(devices);
      }

      case 'buscar_sites_sharepoint': {
        const { busca } = args;
        const sites = await msGraphClient.listSites(busca);
        if (!sites.length) return 'Nenhum site do SharePoint encontrado.';
        return JSON.stringify(sites);
      }

      case 'listar_cadernos_onenote': {
        const { email } = args;
        const notebooks = await msGraphClient.listNotebooks(email);
        if (!notebooks.length) return `Nenhum caderno OneNote encontrado para ${email}.`;
        return JSON.stringify(notebooks);
      }

      case 'buscar_tarefas_todo': {
        const { email } = args;
        const lists = await msGraphClient.listTaskLists(email);
        if (!lists.length) return `Nenhuma lista de tarefas encontrada para ${email}.`;
        return JSON.stringify(lists);
      }

      case 'buscar_reunioes_online': {
        const { email } = args;
        const meetings = await msGraphClient.listOnlineMeetings(email);
        if (!meetings.length) return `Nenhuma reunião online encontrada para ${email}.`;
        return JSON.stringify(meetings);
      }

      case 'buscar_canais_teams': {
        const { team_id } = args;
        const channels = await msGraphClient.listTeamChannels(team_id);
        if (!channels.length) return 'Nenhum canal encontrado nesta equipe.';
        return JSON.stringify(channels);
      }

      case 'buscar_status_servicos_365': {
        const health = await msGraphClient.getServiceHealth();
        const issues = await msGraphClient.getServiceIssues();
        return JSON.stringify({ servicos: health, incidentes: issues });
      }

      case 'buscar_reviews_acesso': {
        const reviews = await msGraphClient.listAccessReviews();
        if (!reviews.length) return 'Nenhum access review encontrado.';
        return JSON.stringify(reviews);
      }

      // =====================================================
      // AGENTE PROATIVO — Novas ferramentas
      // =====================================================

      case 'pesquisar_emails_outlook':
        return await executePesquisarEmailsOutlook(args);

      case 'enviar_email_outlook':
        return await executeEnviarEmailOutlook(args);

      case 'criar_nota_corporativa':
        return await executeCriarNotaCorporativa(args);

      case 'agendar_tarefa_agente':
        return await executeAgendarTarefaAgente(args, userId);

      case 'analisar_kpis_negocio':
        return await executeAnalisarKPIs(args, userId, userRole);

      case 'enviar_notificacao_proativa':
        return await executeEnviarNotificacaoProativa(args, userId);

      case 'gerenciar_base_conhecimento':
        return await executeGerenciarBaseConhecimento(args, userId);

      case 'salvar_memoria_usuario': {
        const { saveUserMemory } = await import('./user-memory');
        const conteudo = String(args?.conteudo || '').trim();
        if (!conteudo) return 'conteudo é obrigatório.';
        const saved = await saveUserMemory({
          userId,
          content: conteudo,
          kind: (args?.tipo as any) || 'fact',
          importance: Number(args?.importancia) || 5,
          source: 'tool',
        });
        if (!saved) return 'Não foi possível salvar a memória (verifique se a tabela ia_user_memory existe).';
        return JSON.stringify({ success: true, memory: saved });
      }

      case 'listar_memorias_usuario': {
        const { listUserMemories } = await import('./user-memory');
        const mems = await listUserMemories(userId, {
          limit: Number(args?.limite) || 20,
        });
        return JSON.stringify({ total: mems.length, memorias: mems });
      }

      case 'criar_skill_usuario': {
        const { createUserSkill } = await import('./user-skills');
        const nome = String(args?.nome || '').trim();
        const procedimento = String(args?.procedimento || '').trim();
        if (!nome || !procedimento) return 'nome e procedimento são obrigatórios.';
        const { skill, error } = await createUserSkill({
          userId,
          name: nome,
          description: String(args?.descricao || ''),
          procedure: procedimento,
          tags: args?.tags,
          source: 'tool',
        });
        if (!skill) {
          return error || 'Não foi possível criar a skill (verifique se ia_user_skills existe).';
        }
        return JSON.stringify({ success: true, skill });
      }

      case 'listar_skills_usuario': {
        const { listUserSkills } = await import('./user-skills');
        const skills = await listUserSkills(userId, {
          limit: Number(args?.limite) || 20,
          query: args?.busca ? String(args.busca) : undefined,
        });
        return JSON.stringify({
          total: skills.length,
          skills: skills.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            tags: s.tags,
            use_count: s.use_count,
            updated_at: s.updated_at,
          })),
        });
      }

      case 'usar_skill': {
        const { useUserSkill } = await import('./user-skills');
        const key = String(args?.skill || '').trim();
        if (!key) return 'skill (nome ou id) é obrigatório.';
        const { skill, promptBlock, error } = await useUserSkill(userId, key);
        if (!skill) return error || 'Skill não encontrada.';
        return JSON.stringify({
          success: true,
          skill: {
            id: skill.id,
            name: skill.name,
            description: skill.description,
            tags: skill.tags,
            use_count: (skill.use_count || 0) + 1,
          },
          procedimento: skill.procedure,
          instrucao: 'Siga o procedimento abaixo para esta tarefa.',
          prompt_block: promptBlock,
        });
      }

      case 'esquecer_skill': {
        const { forgetUserSkill } = await import('./user-skills');
        const key = String(args?.skill || '').trim();
        if (!key) return 'skill (nome ou id) é obrigatório.';
        const ok = await forgetUserSkill(userId, key);
        if (!ok) return 'Não foi possível esquecer a skill.';
        return JSON.stringify({ success: true, forgotten: key });
      }

      case 'iniciar_agente_autonomo': {
          const { usuario_id, setor_id, config } = args;
          
          const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' ? 'GERENTE' : 'USER');
          const hasAccess = await canAccessUserData(userId, effectiveRole, usuario_id);
         if (!hasAccess) {
           return 'Você não tem permissão para iniciar o agente para este usuário.';
         }
         
         const { data: existing } = await supabaseAdmin
           .from('autonomous_agents')
           .select('*')
           .eq('user_id', usuario_id)
           .eq('is_active', true)
           .single();
         
         if (existing) {
           return `Agente já está ativo para este usuário desde ${existing.started_at}.`;
         }
         
         const agentConfig = {
           interval: config?.intervalo || 30000,
           autonomy_level: config?.nivel_autonomia || 'medio',
           auto_actions: config?.acoes_automaticas !== false,
           max_actions_per_cycle: config?.max_acoes_por_ciclo || 3,
           alerts_enabled: config?.alertas_ativos !== false,
         };
         
         const { data, error } = await supabaseAdmin
           .from('autonomous_agents')
           .insert({
             user_id: usuario_id,
             sector_id: setor_id,
             config: agentConfig,
             is_active: true,
             started_at: new Date().toISOString(),
             last_cycle_at: new Date().toISOString(),
             cycles_completed: 0,
             actions_executed: 0,
             created_by: userId,
           })
           .select()
           .single();
         
         if (error) {
           return `Erro ao iniciar agente: ${error.message}`;
         }
         
         return `Agente autônomo iniciado com sucesso para o usuário ${usuario_id}. Configuração: intervalo=${agentConfig.interval}ms, autonomia=${agentConfig.autonomy_level}, ações automáticas=${agentConfig.auto_actions}.`;
       }

       case 'parar_agente_autonomo': {
         const { usuario_id } = args;
         
         const { data, error } = await supabaseAdmin
           .from('autonomous_agents')
           .update({
             is_active: false,
             stopped_at: new Date().toISOString(),
             updated_at: new Date().toISOString(),
           })
           .eq('user_id', usuario_id)
           .eq('is_active', true)
           .select()
           .single();
         
         if (error || !data) {
           return `Agente não está ativo para o usuário ${usuario_id}.`;
         }
         
         return `Agente autônomo parado com sucesso. Total de ciclos: ${data.cycles_completed}, ações executadas: ${data.actions_executed}.`;
       }

       case 'status_agente_autonomo': {
         const { usuario_id } = args;
         
         const { data, error } = await supabaseAdmin
           .from('autonomous_agents')
           .select('*')
           .eq('user_id', usuario_id)
           .order('created_at', { ascending: false })
           .limit(1)
           .single();
         
         if (error || !data) {
           return `Nenhum agente encontrado para o usuário ${usuario_id}.`;
         }
         
         const status = {
           ativo: data.is_active,
           usuario_id: data.user_id,
           setor_id: data.sector_id,
           configuracao: data.config,
           ciclos_completados: data.cycles_completed || 0,
           acoes_executadas: data.actions_executed || 0,
           iniciado_em: data.started_at,
           ultimo_ciclo: data.last_cycle_at,
           parado_em: data.stopped_at || null,
         };
         
         return JSON.stringify(status, null, 2);
       }

       case 'sobrescrever_acao_autonomo': {
         const { usuario_id, acao, parametros, justificativa } = args;
         
         const { error } = await supabaseAdmin
           .from('agent_action_log')
           .insert({
             user_id: usuario_id,
             action_type: 'manual_override',
             action_description: `Sobrescrita manual: ${acao}`,
             details: {
               acao,
               parametros,
               justificativa,
               sobrescrito_por: userId,
             },
             channels_used: ['manual'],
             success: true,
           });
         
         if (error) {
           return `Erro ao registrar sobrescrita: ${error.message}`;
         }
         
         return `Ação manual "${acao}" executada com sucesso. Justificativa: ${justificativa}`;
       }

case 'coletar_dados_holisticos': {
         const { usuario, incluir_emails, incluir_calendario, incluir_tarefas, incluir_arquivos, incluir_equipe, incluir_kpis, incluir_m365 } = args;

         const effectiveRole = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' ? 'GERENTE' : 'USER');

         if (effectiveRole !== 'ADMIN' && effectiveRole !== 'GERENTE') {
           const selfResult = await collectHolisticForUser(userId, userId);
           if (selfResult.error) return `Erro ao coletar dados: ${selfResult.error}`;
           return selfResult.aiContext || JSON.stringify(selfResult.data);
         }

         let targetUserId = userId;
         if (usuario && usuario !== 'meu' && usuario !== 'minhas') {
           const resolved = await resolveUserIdByIdentifier(usuario as string);
           if (resolved) targetUserId = resolved;
           else if (usuario.includes('@')) {
             if (effectiveRole !== 'ADMIN') return 'Apenas ADMIN pode buscar por email de outros usuários.';
             targetUserId = usuario as string;
           }
         }

         const result = await collectHolisticForUser(userId, targetUserId);
         if (result.error) return `Erro ao coletar dados holísticos: ${result.error}`;
         return result.aiContext || JSON.stringify(result.data);
       }

       case 'editar_kpi': {
         const { kpi_key, label, target_value, current_value, unit, department, alert_threshold } = args;

         if (!kpi_key || !label || target_value === undefined) {
           return 'Erro: kpi_key, label e target_value são obrigatórios.';
         }

         const { data: existing } = await supabaseAdmin
           .from('kpi_targets')
           .select('id')
           .eq('kpi_key', kpi_key as string)
           .maybeSingle();

         const kpiData: Record<string, unknown> = {
           kpi_label: label,
           target_value,
           unit: unit || '%',
           alert_threshold: alert_threshold || 80,
           is_active: true,
           updated_at: new Date().toISOString(),
         };

         if (current_value !== undefined) kpiData.current_value = current_value;
         if (department) kpiData.department = department;

         if (existing) {
           const { error } = await supabaseAdmin
             .from('kpi_targets')
             .update(kpiData)
             .eq('id', existing.id);

           return error
             ? `Erro ao atualizar KPI: ${error.message}`
             : `KPI "${label}" atualizado com sucesso.`;
         }

         kpiData.kpi_key = kpi_key;
         kpiData.created_at = new Date().toISOString();

         const { error } = await supabaseAdmin
           .from('kpi_targets')
           .insert([kpiData]);

         return error
           ? `Erro ao criar KPI: ${error.message}`
           : `KPI "${label}" criado com sucesso.`;
       }

       case 'listar_kpis': {
         const { department } = args;

         let query = supabaseAdmin
           .from('kpi_targets')
           .select('*')
           .eq('is_active', true)
           .order('kpi_label');

         if (department) {
           query = query.or(`department.eq.${department},department.is.null`);
         }

         const { data, error } = await query;
         if (error) return `Erro ao buscar KPIs: ${error.message}`;
         if (!data || data.length === 0) return 'Nenhum KPI ativo encontrado.';

         const kpis = data.map((k: any) => ({
           key: k.kpi_key,
           label: k.kpi_label,
           current: k.current_value,
           target: k.target_value,
           unit: k.unit,
           department: k.department,
           gap: k.target_value && k.current_value ? `${((k.target_value - k.current_value) / k.target_value * 100).toFixed(1)}%` : null,
           status: k.current_value >= k.target_value ? 'acima_meta' : 'abaixo_meta',
         }));

         return JSON.stringify(kpis);
       }

       case 'configurar_alerta_kpi': {
         if (userRole !== 'ADMIN') return 'Acesso negado. Apenas ADMIN pode configurar alertas de KPI.';
         const { kpi_key, threshold, channels } = args;

         const { error } = await supabaseAdmin
           .from('kpi_targets')
           .update({
             alert_threshold: threshold,
             updated_at: new Date().toISOString(),
           })
           .eq('kpi_key', kpi_key as string);

         return error
           ? `Erro ao configurar alerta: ${error.message}`
           : `Alerta configurado para KPI "${kpi_key}": notificar quando abaixo de ${threshold}% da meta. Canais: ${channels || 'push,portal'}.`;
       }

      case 'buscar_feedbacks': {
        const { tipo, status, limite = 20 } = args;
        
        let query = supabaseAdmin
          .from('user_feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limite);
          
        if (tipo) query = query.eq('type', tipo);
        if (status) query = query.eq('status', status);
        
        const { data, error } = await query;
        if (error) return `Erro ao buscar feedbacks: ${error.message}`;
        if (!data || data.length === 0) return 'Nenhum feedback encontrado.';
        
        return JSON.stringify(data);
      }

      case 'atualizar_status_feedback': {
        const { feedback_id, status } = args;
        if (!feedback_id || !status) return 'ID e status são obrigatórios.';
        
        const { error } = await supabaseAdmin
          .from('user_feedback')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', feedback_id);
          
        if (error) return `Erro ao atualizar feedback: ${error.message}`;
        return `Status do feedback ${feedback_id} atualizado para ${status} com sucesso.`;
      }

      case 'excluir_feedback': {
        const { feedback_id } = args;
        if (!feedback_id) return 'ID do feedback é obrigatório.';
        
        const { error } = await supabaseAdmin
          .from('user_feedback')
          .delete()
          .eq('id', feedback_id);
          
        if (error) return `Erro ao excluir feedback: ${error.message}`;
        return `Feedback ${feedback_id} excluído com sucesso.`;
      }

      case 'obter_link_contracheque': {
        return JSON.stringify({
          sistema: 'WK Radar WebNet',
          url: 'http://wk.groupabz.com/radarwebnet',
          instrucoes: 'Os contracheques e holerites do ABZ Group são gerenciados no sistema externo WK Radar. Acesse o sistema pelo link acima usando suas credenciais.'
        });
      }

      case 'buscar_contratos': {
        const { status, busca, limite = 20 } = args;
        
        const isManager = userRole === 'ADMIN' || userRole === 'GERENTE';
        
        if (isManager) {
          let query = supabaseAdmin
            .from('vw_envelopes_completo')
            .select('*')
            .neq('status', 'DELETED')
            .order('data_criacao', { ascending: false })
            .limit(limite);
            
          if (status) query = query.eq('status', status);
          if (busca) query = query.ilike('titulo', `%${busca}%`);
          
          const { data, error } = await query;
          if (error) return `Erro ao buscar envelopes de contratos: ${error.message}`;
          return JSON.stringify(data || []);
        } else {
          let query = supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
              id,
              status,
              created_at,
              documento:documentos_trabalhistas!documento_id (
                id,
                titulo,
                descricao,
                arquivo_nome,
                data_criacao
              )
            `)
            .eq('colaborador_id', userId)
            .order('created_at', { ascending: false })
            .limit(limite);
            
          if (status) query = query.eq('status', status);
          
          const { data, error } = await query;
          if (error) return `Erro ao buscar suas solicitações de contrato: ${error.message}`;
          return JSON.stringify(data || []);
        }
      }

      case 'buscar_ponto': {
        const { funcionario_id, data_inicio, data_fim, limite = 100 } = args;
        
        let targetUserId = funcionario_id || userId;
        if (userRole !== 'ADMIN' && userRole !== 'GERENTE' && targetUserId !== userId) {
          return 'Acesso negado: Você só pode buscar seus próprios registros de ponto.';
        }
        
        let query = supabaseAdmin
          .from('registros_presenca')
          .select('id, user_id, nome_completo, funcao, empresa, created_at, lista_presenca(titulo, local, data_evento)')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(limite);
          
        if (data_inicio) query = query.gte('created_at', data_inicio);
        if (data_fim) query = query.lte('created_at', data_fim);
        
        const { data, error } = await query;
        if (error) return `Erro ao buscar registros de ponto: ${error.message}`;
        if (!data || data.length === 0) return 'Nenhum registro de ponto encontrado para este período.';
        
        const formattedData = data.map((r: any) => ({
          id: r.id,
          usuario: r.nome_completo || 'N/A',
          funcao: r.funcao || 'N/A',
          empresa: r.empresa || 'N/A',
          evento: r.lista_presenca?.titulo || 'Presença Manual',
          local: r.lista_presenca?.local || '-',
          data_evento: r.lista_presenca?.data_evento || r.created_at,
          registrado_em: r.created_at,
        }));
        
        return JSON.stringify(formattedData);
      }

      case 'buscar_lista_presenca': {
        const { status, busca, limite = 50 } = args;
        
        let query = supabaseAdmin
          .from('vw_listas_presenca_completo')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limite);
          
        if (status) query = query.eq('status', status);
        if (busca) query = query.or(`titulo.ilike.%${busca}%,local.ilike.%${busca}%`);
        
        const { data, error } = await query;
        if (error) return `Erro ao buscar listas de presença: ${error.message}`;
        return JSON.stringify(data || []);
      }

      case 'buscar_tripulantes': {
        const { busca, empresa, embarcacao, cargo, status, apenas_docs_vencidos, limite = 50 } = args;
        let query = supabaseAdmin
          .from('gt_vw_colaboradores_completo')
          .select('*')
          .order('nome_completo', { ascending: true })
          .limit(Math.min(limite || 50, 200));

        if (busca) {
          query = query.or(`nome_completo.ilike.%${busca}%,matricula.ilike.%${busca}%,cpf.ilike.%${busca}%,email.ilike.%${busca}%`);
        }
        if (empresa) query = query.eq('empresa_nome', empresa);
        if (embarcacao) query = query.eq('embarcacao_nome', embarcacao);
        if (cargo) query = query.eq('cargo_nome', cargo);
        if (apenas_docs_vencidos) query = query.gt('qtd_docs_vencidos', 0);

        const { data, error } = await query;
        if (error) return `Erro ao buscar tripulantes: ${error.message}`;
        const rows = ((data || []) as Array<{ id: string }>).map((row) => ({ ...row, id: row.id }));
        const overlay = await overlayStatusEscalaHoje(rows);
        const tripulantes = overlay.error ? rows : overlay.rows;
        const filtered = status
          ? tripulantes.filter((c) => String((c as { status_embarque?: string }).status_embarque || '') === String(status))
          : tripulantes;
        return JSON.stringify({ total: filtered.length, tripulantes: filtered });
      }

      case 'buscar_documentos_vencidos': {
        const { colaborador_id, incluir_historico } = args as {
          colaborador_id?: string;
          incluir_historico?: boolean;
        };
        const ids = colaborador_id
          ? [colaborador_id]
          : (await listarColaboradoresDashboardAtivos()).ids;
        const alertas = await listarDocumentosAlertas({ colaboradorIds: ids });
        return JSON.stringify({
          hoje: alertas.hoje,
          totais: alertas.totais,
          vencidos_vigentes: alertas.vencidos_vigentes,
          vencendo_vigentes: alertas.vencendo_vigentes,
          vencidos_historico: incluir_historico ? alertas.vencidos_historico : undefined,
        });
      }

      case 'buscar_afastamentos': {
        const { colaborador_id, busca, apenas_ativos, limite = 50 } = args;
        let colabId = colaborador_id;

        if (!colabId && busca) {
          const { data: colab } = await supabaseAdmin
            .from('gt_colaboradores')
            .select('id')
            .or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%`)
            .limit(1)
            .maybeSingle();
          colabId = colab?.id;
        }

        let query = supabaseAdmin
          .from('gt_afastamentos')
          .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula)')
          .is('deleted_at', null)
          .order('data_inicio', { ascending: false })
          .limit(Math.min(limite || 50, 200));

        if (colabId) query = query.eq('colaborador_id', colabId);
        if (apenas_ativos) {
          const today = new Date().toISOString().slice(0, 10);
          query = query.or(`data_fim.is.null,data_fim.gte.${today}`);
        }

        const { data, error } = await query;
        if (error) return `Erro ao buscar afastamentos: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, afastamentos: data || [] });
      }

      case 'buscar_acidentes': {
        const { colaborador_id, busca, limite = 50 } = args;
        let colabId = colaborador_id;

        if (!colabId && busca) {
          const { data: colab } = await supabaseAdmin
            .from('gt_colaboradores')
            .select('id')
            .or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%`)
            .limit(1)
            .maybeSingle();
          colabId = colab?.id;
        }

        let query = supabaseAdmin
          .from('gt_acidentes')
          .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula)')
          .order('created_at', { ascending: false })
          .limit(Math.min(limite || 50, 200));

        if (colabId) query = query.eq('colaborador_id', colabId);

        const { data, error } = await query;
        if (error) return `Erro ao buscar acidentes: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, acidentes: data || [] });
      }

      case 'buscar_fatores_risco_esocial': {
        const { cargo, busca, limite = 100 } = args;
        let query = supabaseAdmin
          .from('esocial_fatores_risco')
          .select('*')
          .order('cargo', { ascending: true })
          .limit(Math.min(limite || 100, 500));

        if (cargo) query = query.ilike('cargo', cargo);
        else if (busca) query = query.ilike('cargo', `%${busca}%`);

        const { data, error } = await query;
        if (error) return `Erro ao buscar fatores de risco: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, fatores: data || [] });
      }

      case 'buscar_escalas': {
        const { cpf, colaborador_id, data_inicio, data_fim, origem, limite = 50 } = args;
        let colabId = colaborador_id;

        if (!colabId && cpf) {
          const clean = String(cpf).replace(/\D/g, '');
          const { data: colab } = await supabaseAdmin
            .from('gt_colaboradores')
            .select('id')
            .or(`cpf.eq.${clean},cpf.ilike.%${clean}%`)
            .limit(1)
            .maybeSingle();
          colabId = colab?.id;
        }

        let query = supabaseAdmin
          .from('gt_historico_embarques')
          .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula)')
          .is('deleted_at', null)
          .order('data_embarque', { ascending: false })
          .limit(Math.min(limite || 50, 200));

        if (colabId) query = query.eq('colaborador_id', colabId);
        if (origem) query = query.eq('origem', origem);
        if (data_inicio) query = query.gte('data_embarque', data_inicio);
        if (data_fim) query = query.lte('data_desembarque', data_fim);

        const { data, error } = await query;
        if (error) return `Erro ao buscar escalas: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, escalas: data || [] });
      }

      case 'atualizar_escala': {
        if (userRole !== 'ADMIN' && userRole !== 'GERENTE' && userRole !== 'MANAGER') {
          return 'Acesso negado. Apenas ADMIN/GERENTE podem editar escalas.';
        }
        const { evento_id, tipo, data_embarque, data_desembarque, observacoes, local_embarque, local_desembarque } = args;
        if (!evento_id) return 'evento_id é obrigatório.';

        const { data: existing, error: findErr } = await supabaseAdmin
          .from('gt_historico_embarques')
          .select('id, origem, deleted_at')
          .eq('id', evento_id)
          .maybeSingle();

        if (findErr || !existing || existing.deleted_at) {
          return 'Evento de escala não encontrado.';
        }

        const updates: Record<string, unknown> = {
          origem: 'local',
          updated_at: new Date().toISOString(),
        };
        if (tipo !== undefined) updates.tipo = mapCodigoToDbTipo(String(tipo));
        if (data_embarque !== undefined) updates.data_embarque = data_embarque;
        if (data_desembarque !== undefined) updates.data_desembarque = data_desembarque;
        if (observacoes !== undefined) updates.observacoes = observacoes;
        if (local_embarque !== undefined) updates.local_embarque = local_embarque;
        if (local_desembarque !== undefined) updates.local_desembarque = local_desembarque;

        const { data, error } = await supabaseAdmin
          .from('gt_historico_embarques')
          .update(updates)
          .eq('id', evento_id)
          .select('*')
          .single();

        if (error) return `Erro ao atualizar escala: ${error.message}`;
        return JSON.stringify({ success: true, escala: data });
      }

      case 'registrar_entrega_epi': {
        const { funcionario_id, tipo_equipamento, quantidade, motivo, marcar_entregue } = args;
        if (!funcionario_id || !tipo_equipamento || !quantidade || !motivo) {
          return 'funcionario_id, tipo_equipamento, quantidade e motivo são obrigatórios.';
        }

        try {
          const reg = await createEPIRegistration(funcionario_id, {
            equipment_type: tipo_equipamento,
            quantity: Number(quantidade),
            reason: motivo,
          });

          if (marcar_entregue && (userRole === 'ADMIN' || userRole === 'GERENTE' || userRole === 'MANAGER')) {
            await updateEPIRegistration(reg.id, { status: 'delivered' });
            return JSON.stringify({ success: true, message: 'EPI registrado e marcado como entregue.', registration_id: reg.id });
          }

          return JSON.stringify({ success: true, message: 'Solicitação de EPI criada.', registration: reg });
        } catch (e) {
          return `Erro ao registrar EPI: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      case 'buscar_estoque_epi': {
        try {
          const { apenas_baixo, limite = 100 } = args;
          const stock = apenas_baixo ? await getLowStockAlerts() : await getStockLevels();
          const sliced = (stock || []).slice(0, Math.min(limite || 100, 500));
          return JSON.stringify({
            total: sliced.length,
            estoque: sliced.map((s: any) => ({
              id: s.id,
              epi: s.epi_type?.name || s.epi_types?.name,
              ca: s.epi_type?.ca_number || s.epi_types?.ca_number,
              quantidade: s.current_quantity,
              minimo: s.minimum_quantity,
              baixo: s.is_low_stock ?? (s.current_quantity <= s.minimum_quantity),
            })),
          });
        } catch (e) {
          return `Erro ao buscar estoque EPI: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      case 'buscar_vencimentos_epi': {
        const { dias = 90, limite = 100 } = args;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + Number(dias || 90));
        const cutoffIso = cutoff.toISOString().slice(0, 10);

        const { data, error } = await supabaseAdmin
          .from('epi_types')
          .select('id, name, ca_number, ca_validity_date, ca_status, category')
          .not('ca_validity_date', 'is', null)
          .lte('ca_validity_date', cutoffIso)
          .order('ca_validity_date', { ascending: true })
          .limit(Math.min(limite || 100, 500));

        if (error) return `Erro ao buscar vencimentos de CA: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, ate: cutoffIso, itens: data || [] });
      }

      case 'resumo_ponto_funcionario': {
        const { funcionario_id, data_inicio, data_fim } = args;
        const target = funcionario_id || userId;
        if (userRole !== 'ADMIN' && userRole !== 'GERENTE' && userRole !== 'MANAGER' && target !== userId) {
          return 'Acesso negado: você só pode ver o próprio resumo de ponto.';
        }

        let query = supabaseAdmin
          .from('registros_presenca')
          .select('id, created_at, lista_presenca(titulo, local, data_evento)')
          .eq('user_id', target)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (data_inicio) query = query.gte('created_at', data_inicio);
        if (data_fim) query = query.lte('created_at', `${data_fim}T23:59:59`);

        const { data, error } = await query;
        if (error) return `Erro ao gerar resumo de ponto: ${error.message}`;

        const porEvento: Record<string, number> = {};
        const dias = new Set<string>();
        for (const r of data || []) {
          const ev = (r as any).lista_presenca?.titulo || 'Presença Manual';
          porEvento[ev] = (porEvento[ev] || 0) + 1;
          dias.add(String(r.created_at).slice(0, 10));
        }

        return JSON.stringify({
          funcionario_id: target,
          total_registros: data?.length || 0,
          dias_distintos: dias.size,
          por_evento: porEvento,
          periodo: { inicio: data_inicio || null, fim: data_fim || null },
        });
      }

      case 'buscar_inconsistencias_ponto': {
        const { funcionario_id, data_inicio, data_fim, limite = 50 } = args;
        const target = funcionario_id || userId;
        if (userRole !== 'ADMIN' && userRole !== 'GERENTE' && userRole !== 'MANAGER' && target !== userId) {
          return 'Acesso negado.';
        }

        let query = supabaseAdmin
          .from('registros_presenca')
          .select('id, created_at, lista_presenca_id, lista_presenca(titulo, data_evento)')
          .eq('user_id', target)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (data_inicio) query = query.gte('created_at', data_inicio);
        if (data_fim) query = query.lte('created_at', `${data_fim}T23:59:59`);

        const { data, error } = await query;
        if (error) return `Erro ao buscar inconsistências: ${error.message}`;

        const seen = new Map<string, number>();
        const duplicados: any[] = [];
        for (const r of data || []) {
          const day = String(r.created_at).slice(0, 10);
          const key = `${r.lista_presenca_id || 'manual'}|${day}`;
          const count = (seen.get(key) || 0) + 1;
          seen.set(key, count);
          if (count === 2) {
            duplicados.push({
              lista_presenca_id: r.lista_presenca_id,
              evento: (r as any).lista_presenca?.titulo,
              dia: day,
              ocorrencias: count,
            });
          } else if (count > 2) {
            const last = duplicados.find(d => d.dia === day && d.lista_presenca_id === r.lista_presenca_id);
            if (last) last.ocorrencias = count;
          }
        }

        return JSON.stringify({
          funcionario_id: target,
          duplicados: duplicados.slice(0, limite || 50),
          total_duplicados: duplicados.length,
        });
      }

      case 'matricular_usuario_curso': {
        const { curso_id, usuario_id } = args;
        if (!curso_id) return 'curso_id é obrigatório.';
        const target = usuario_id || userId;
        if (userRole !== 'ADMIN' && target !== userId) {
          return 'Acesso negado: você só pode se matricular a si mesmo.';
        }

        const { data: existing } = await supabaseAdmin
          .from('academy_enrollments')
          .select('id, is_active')
          .eq('user_id', target)
          .eq('course_id', curso_id)
          .maybeSingle();

        if (existing?.is_active) {
          return JSON.stringify({ success: true, message: 'Usuário já matriculado neste curso.', enrollment_id: existing.id });
        }

        if (existing && !existing.is_active) {
          const { data, error } = await supabaseAdmin
            .from('academy_enrollments')
            .update({ is_active: true, enrolled_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select('id, enrolled_at')
            .single();
          if (error) return `Erro ao reativar matrícula: ${error.message}`;
          return JSON.stringify({ success: true, message: 'Matrícula reativada.', enrollment: data });
        }

        const { data, error } = await supabaseAdmin
          .from('academy_enrollments')
          .insert({
            user_id: target,
            course_id: curso_id,
            is_active: true,
            enrolled_at: new Date().toISOString(),
          })
          .select('id, enrolled_at')
          .single();

        if (error) return `Erro ao matricular: ${error.message}`;
        return JSON.stringify({ success: true, message: 'Matrícula criada.', enrollment: data });
      }

      case 'buscar_certificados': {
        const { usuario_id, curso_id, limite = 50 } = args;
        const target = usuario_id || userId;
        if (userRole !== 'ADMIN' && userRole !== 'GERENTE' && userRole !== 'MANAGER' && target !== userId) {
          return 'Acesso negado.';
        }

        let query = supabaseAdmin
          .from('academy_enrollments')
          .select('id, enrolled_at, completed_at, certificate_url, certificate_issued_at, course:academy_courses(id, title)')
          .not('certificate_url', 'is', null)
          .order('certificate_issued_at', { ascending: false })
          .limit(Math.min(limite || 50, 200));

        query = query.eq('user_id', target);
        if (curso_id) query = query.eq('course_id', curso_id);

        const { data, error } = await query;
        if (error) return `Erro ao buscar certificados: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, certificados: data || [] });
      }

      case 'buscar_quizzes_pendentes': {
        const { curso_id, usuario_id, limite = 50 } = args;
        const isAdmin = userRole === 'ADMIN' || userRole === 'GERENTE' || userRole === 'MANAGER';

        let query = supabaseAdmin
          .from('academy_quiz_attempts')
          .select('id, course_id, user_id, score_percentage, needs_grading, is_passed, created_at')
          .order('created_at', { ascending: false })
          .limit(Math.min(limite || 50, 200));

        if (curso_id) query = query.eq('course_id', curso_id);

        if (isAdmin) {
          if (usuario_id) query = query.eq('user_id', usuario_id);
          else query = query.eq('needs_grading', true);
        } else {
          query = query.eq('user_id', userId).or('needs_grading.eq.true,is_passed.eq.false');
        }

        const { data, error } = await query;
        if (error) return `Erro ao buscar quizzes pendentes: ${error.message}`;
        return JSON.stringify({ total: data?.length || 0, quizzes: data || [] });
      }

      case 'buscar_sinais_kpi_comunicacao': {
        const { email_usuario, dominios, dias = 14, limite = 30 } = args || {};
        let mailbox = email_usuario as string | undefined;
        if (mailbox && userRole !== 'ADMIN') {
          const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
          if (!me?.email || me.email.toLowerCase() !== String(mailbox).toLowerCase()) {
            return 'Acesso negado: você só pode pesquisar a própria caixa de e-mail.';
          }
        }
        if (!mailbox) {
          const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
          mailbox = me?.email;
        }
        if (!mailbox) return 'Não foi possível determinar o e-mail do usuário.';

        const { collectKpiCommunicationSignals } = await import('./kpi-comms-signals');
        const domainList = dominios
          ? String(dominios).split(',').map((d: string) => d.trim()).filter(Boolean)
          : undefined;

        const result = await collectKpiCommunicationSignals({
          emailUsuario: mailbox,
          dominios: domainList as any,
          dias: Number(dias) || 14,
          limite: resolveGraphLimit(limite, 30),
        });
        return JSON.stringify(result);
      }

      case 'meus_emails': {
        const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
        if (!me?.email) return 'Usuário sem e-mail corporativo cadastrado.';

        const limit = resolveGraphLimit(args?.limite, 50);
        const emails = await msGraphClient.searchEmails(me.email, args?.consulta, {
          from: args?.de,
          subject: args?.assunto,
          dateFrom: args?.data_inicio,
          dateTo: args?.data_fim,
          folder: args?.pasta,
          isRead: args?.apenas_nao_lidos === true ? false : undefined,
          hasAttachments: args?.com_anexos === true ? true : undefined,
          includeBody: !!args?.incluir_corpo,
          top: limit,
        });

        if (!emails.length) return 'Nenhum e-mail encontrado com os filtros informados.';
        return JSON.stringify(
          buildEmailListPayload(emails, {
            includeBody: !!args?.incluir_corpo,
            folderHint: args?.pasta,
            limiteAplicado: limit,
            hardCap: GRAPH_HARD_CAP,
            maxItems: Math.min(limit, 50),
          })
        );
      }

      case 'meu_calendario': {
        const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
        const daysFwd = Number(args?.dias_futuros ?? 14);
        const daysBack = Number(args?.dias_passados ?? 0);
        const start = new Date();
        start.setDate(start.getDate() - daysBack);
        const end = new Date();
        end.setDate(end.getDate() + daysFwd);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const limit = resolveGraphLimit(args?.limite, 50);

        const events: any[] = [];

        if (me?.email) {
          try {
            const graphEvents = await msGraphClient.listCalendarEvents(
              me.email,
              startIso,
              endIso,
              limit
            );
            for (const e of graphEvents) {
              events.push({
                fonte: 'outlook',
                titulo: e.subject,
                inicio: e.start?.dateTime,
                fim: e.end?.dateTime,
                local: (e.location as any)?.displayName,
              });
            }
          } catch { /* ignore graph */ }
        }

        const { data: portalEvents } = await supabaseAdmin
          .from('calendar_events')
          .select('id, summary, description, start_time, end_time, location')
          .eq('user_id', userId)
          .gte('start_time', startIso)
          .lte('start_time', endIso)
          .order('start_time', { ascending: true })
          .limit(limit);

        for (const e of portalEvents || []) {
          events.push({
            fonte: 'portal',
            id: e.id,
            titulo: e.summary,
            inicio: e.start_time,
            fim: e.end_time,
            local: e.location,
            descricao: e.description,
          });
        }

        if (!events.length) return `Nenhum evento encontrado no período (${daysBack} dias atrás → ${daysFwd} à frente).`;
        return JSON.stringify({ total: events.length, eventos: events });
      }

      case 'criar_evento_calendario': {
        const { titulo, inicio, fim, local, descricao, tambem_outlook } = args || {};
        if (!titulo || !inicio || !fim) return 'titulo, inicio e fim são obrigatórios.';

        const { data: created, error } = await supabaseAdmin
          .from('calendar_events')
          .insert({
            user_id: userId,
            summary: titulo,
            description: descricao || null,
            start_time: inicio,
            end_time: fim,
            location: local || null,
            attendees: [],
            reminders: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, summary, start_time, end_time')
          .single();

        if (error) return `Erro ao criar evento no portal: ${error.message}`;

        let outlook: any = null;
        if (tambem_outlook) {
          const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
          if (me?.email) {
            outlook = await msGraphClient.createCalendarEvent(me.email, {
              subject: titulo,
              start: inicio,
              end: fim,
              location: local,
              body: descricao,
            });
          }
        }

        return JSON.stringify({
          success: true,
          portal: created,
          outlook: outlook ? { id: outlook.id, subject: outlook.subject } : null,
        });
      }

      case 'minhas_conversas_teams': {
        const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
        if (!me?.email) return 'Usuário sem e-mail corporativo.';

        const limit = resolveGraphLimit(args?.limite, 40);
        const out: Record<string, unknown> = { detalhe: 'completo' };

        if (args?.consulta) {
          const rawMsgs = await msGraphClient.searchTeamsMessages(me.email, {
            consulta: args.consulta,
            limite: limit,
          });
          out.total_mensagens = rawMsgs.length;
          out.mensagens = enrichTeamsMessages(rawMsgs, { maxItems: limit });
        }

        if (args?.listar_chats !== false && !args?.consulta) {
          const chats = await msGraphClient.listTeamsChats(me.email);
          out.total_chats = Math.min(chats.length, limit);
          out.chats = enrichTeamsChats(chats, limit);
        } else if (args?.listar_chats === true) {
          const chats = await msGraphClient.listTeamsChats(me.email);
          out.total_chats = Math.min(chats.length, Math.min(limit, 30));
          out.chats = enrichTeamsChats(chats, Math.min(limit, 30));
        }

        if (!(out.chats as any[])?.length && !(out.mensagens as any[])?.length) {
          return 'Nenhuma conversa/mensagem Teams encontrada.';
        }
        return JSON.stringify(out);
      }

      case 'pesquisar_mensagens_teams': {
        const { consulta, limite = 40 } = args || {};
        if (!consulta) return 'consulta é obrigatória.';

        let mailbox = args?.email_usuario as string | undefined;
        if (mailbox && userRole !== 'ADMIN') {
          return 'Acesso negado: apenas ADMIN pode pesquisar Teams de outro usuário.';
        }
        if (!mailbox) {
          const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
          mailbox = me?.email;
        }
        if (!mailbox) return 'E-mail do usuário não encontrado.';

        const limit = resolveGraphLimit(limite, 40);
        const msgs = await msGraphClient.searchTeamsMessages(mailbox, {
          consulta,
          limite: limit,
        });
        if (!msgs.length) return 'Nenhuma mensagem Teams encontrada para a consulta.';
        return JSON.stringify({
          total: msgs.length,
          detalhe: 'completo',
          mensagens: enrichTeamsMessages(msgs, { maxItems: limit }),
        });
      }

      case 'aprovar_ferias': {
        const role = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER');
        if (role === 'USER') {
          return JSON.stringify({ success: false, error: 'Apenas ADMIN/GERENTE podem aprovar férias.', _summary: 'aprovar_ferias: negado' });
        }
        const solicitacaoId = String(args?.solicitacao_id || '').trim();
        if (!solicitacaoId) {
          return JSON.stringify({ success: false, error: 'solicitacao_id obrigatório.', _summary: 'aprovar_ferias: id ausente' });
        }

        const { data: req, error: fetchErr } = await supabaseAdmin
          .from('leave_requests')
          .select('id, user_id, status, start_date, end_date')
          .eq('id', solicitacaoId)
          .maybeSingle();

        if (fetchErr || !req) {
          return JSON.stringify({ success: false, error: 'Solicitação não encontrada.', _summary: 'aprovar_ferias: não encontrada' });
        }

        if (role === 'GERENTE') {
          const hasAccess = await canAccessUserData(userId, role, req.user_id);
          if (!hasAccess) {
            return JSON.stringify({ success: false, error: 'Só pode aprovar férias da sua equipe.', _summary: 'aprovar_ferias: fora da equipe' });
          }
        }

        let nextStatus: 'PENDING_MANAGER' | 'APPROVED' | null = null;
        if (req.status === 'PENDING_LEADER') nextStatus = 'PENDING_MANAGER';
        else if (req.status === 'PENDING_MANAGER') nextStatus = 'APPROVED';
        else {
          return JSON.stringify({
            success: false,
            error: `Status atual "${req.status}" não permite aprovação.`,
            _summary: `aprovar_ferias: status inválido ${req.status}`,
          });
        }

        const { updateLeaveRequestStatus } = await import('@/services/leaveService');
        const ok = await updateLeaveRequestStatus(solicitacaoId, nextStatus);
        if (!ok) {
          return JSON.stringify({ success: false, error: 'Falha ao atualizar status.', _summary: 'aprovar_ferias: erro update' });
        }

        return JSON.stringify({
          success: true,
          solicitacao_id: solicitacaoId,
          status_anterior: req.status,
          status_novo: nextStatus,
          periodo: { inicio: req.start_date, fim: req.end_date },
          comentario: args?.comentario || null,
          message:
            nextStatus === 'PENDING_MANAGER'
              ? 'Aprovado pelo líder — aguardando gerente.'
              : 'Férias aprovadas.',
          _summary: `aprovar_ferias: ${req.status} → ${nextStatus}`,
        });
      }

      case 'reprovar_ferias': {
        const role = userRole === 'ADMIN' ? 'ADMIN' : (userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER');
        if (role === 'USER') {
          return JSON.stringify({ success: false, error: 'Apenas ADMIN/GERENTE podem reprovar férias.', _summary: 'reprovar_ferias: negado' });
        }
        const solicitacaoId = String(args?.solicitacao_id || '').trim();
        const motivo = String(args?.motivo || '').trim();
        if (!solicitacaoId || !motivo) {
          return JSON.stringify({ success: false, error: 'solicitacao_id e motivo são obrigatórios.', _summary: 'reprovar_ferias: args' });
        }

        const { data: req, error: fetchErr } = await supabaseAdmin
          .from('leave_requests')
          .select('id, user_id, status, start_date, end_date')
          .eq('id', solicitacaoId)
          .maybeSingle();

        if (fetchErr || !req) {
          return JSON.stringify({ success: false, error: 'Solicitação não encontrada.', _summary: 'reprovar_ferias: não encontrada' });
        }

        if (req.status !== 'PENDING_LEADER' && req.status !== 'PENDING_MANAGER') {
          return JSON.stringify({
            success: false,
            error: `Status "${req.status}" não permite reprovação.`,
            _summary: `reprovar_ferias: status ${req.status}`,
          });
        }

        if (role === 'GERENTE') {
          const hasAccess = await canAccessUserData(userId, role, req.user_id);
          if (!hasAccess) {
            return JSON.stringify({ success: false, error: 'Só pode reprovar férias da sua equipe.', _summary: 'reprovar_ferias: fora da equipe' });
          }
        }

        const { updateLeaveRequestStatus } = await import('@/services/leaveService');
        const ok = await updateLeaveRequestStatus(solicitacaoId, 'REJECTED', motivo);
        if (!ok) {
          return JSON.stringify({ success: false, error: 'Falha ao atualizar status.', _summary: 'reprovar_ferias: erro update' });
        }

        return JSON.stringify({
          success: true,
          solicitacao_id: solicitacaoId,
          status_novo: 'REJECTED',
          motivo,
          message: 'Férias reprovadas.',
          _summary: `reprovar_ferias: ${req.status} → REJECTED`,
        });
      }

      case 'aprovar_reembolso': {
        if (userRole !== 'ADMIN') {
          return JSON.stringify({ success: false, error: 'Apenas ADMIN pode aprovar reembolso.', _summary: 'aprovar_reembolso: negado' });
        }
        const reembolsoId = String(args?.reembolso_id || '').trim();
        if (!reembolsoId) {
          return JSON.stringify({ success: false, error: 'reembolso_id obrigatório.', _summary: 'aprovar_reembolso: id ausente' });
        }

        const { data: reemb, error: fetchErr } = await supabaseAdmin
          .from('Reimbursement')
          .select('id, status, valorTotal, descricao, email')
          .eq('id', reembolsoId)
          .maybeSingle();

        if (fetchErr || !reemb) {
          return JSON.stringify({ success: false, error: 'Reembolso não encontrado.', _summary: 'aprovar_reembolso: não encontrado' });
        }

        const st = String(reemb.status || '').toLowerCase();
        if (st !== 'pendente' && st !== 'pending') {
          return JSON.stringify({
            success: false,
            error: `Reembolso já está "${reemb.status}".`,
            _summary: `aprovar_reembolso: status ${reemb.status}`,
          });
        }

        const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
        const { error: updErr } = await supabaseAdmin
          .from('Reimbursement')
          .update({
            status: 'aprovado',
            approvedBy: me?.email || userId,
            approvedAt: new Date().toISOString(),
            comments: args?.comentario || null,
          })
          .eq('id', reembolsoId);

        if (updErr) {
          return JSON.stringify({ success: false, error: updErr.message, _summary: 'aprovar_reembolso: erro update' });
        }

        return JSON.stringify({
          success: true,
          reembolso_id: reembolsoId,
          status_novo: 'aprovado',
          valor: reemb.valorTotal,
          message: 'Reembolso aprovado.',
          _summary: `aprovar_reembolso: ${reembolsoId} → aprovado`,
        });
      }

      case 'reprovar_reembolso': {
        if (userRole !== 'ADMIN') {
          return JSON.stringify({ success: false, error: 'Apenas ADMIN pode reprovar reembolso.', _summary: 'reprovar_reembolso: negado' });
        }
        const reembolsoId = String(args?.reembolso_id || '').trim();
        const motivo = String(args?.motivo || '').trim();
        if (!reembolsoId || !motivo) {
          return JSON.stringify({ success: false, error: 'reembolso_id e motivo são obrigatórios.', _summary: 'reprovar_reembolso: args' });
        }

        const { data: reemb, error: fetchErr } = await supabaseAdmin
          .from('Reimbursement')
          .select('id, status')
          .eq('id', reembolsoId)
          .maybeSingle();

        if (fetchErr || !reemb) {
          return JSON.stringify({ success: false, error: 'Reembolso não encontrado.', _summary: 'reprovar_reembolso: não encontrado' });
        }

        const st = String(reemb.status || '').toLowerCase();
        if (st !== 'pendente' && st !== 'pending') {
          return JSON.stringify({
            success: false,
            error: `Reembolso já está "${reemb.status}".`,
            _summary: `reprovar_reembolso: status ${reemb.status}`,
          });
        }

        const { data: me } = await supabaseAdmin.from('users_unified').select('email').eq('id', userId).maybeSingle();
        const { error: updErr } = await supabaseAdmin
          .from('Reimbursement')
          .update({
            status: 'rejeitado',
            approvedBy: me?.email || userId,
            approvedAt: new Date().toISOString(),
            comments: motivo,
          })
          .eq('id', reembolsoId);

        if (updErr) {
          return JSON.stringify({ success: false, error: updErr.message, _summary: 'reprovar_reembolso: erro update' });
        }

        return JSON.stringify({
          success: true,
          reembolso_id: reembolsoId,
          status_novo: 'rejeitado',
          motivo,
          message: 'Reembolso rejeitado.',
          _summary: `reprovar_reembolso: ${reembolsoId} → rejeitado`,
        });
      }

      case 'navegar_portal': {
        const destino = String(args?.destino || '').trim();
        if (!destino) return 'destino é obrigatório.';

        const match = resolvePortalNavigation(destino);
        const path = match && match.score >= 0.78
          ? match.route.path
          : aliasToPath(destino);
        const label = match?.route.label || path;

        const commands: Array<{ action: string; target: string; label: string }> = [
          match && match.score >= 0.78
            ? buildNavCommand(match)
            : { action: 'NAVIGATE', target: path, label: `Navegando para ${label}...` },
        ];
        if (args?.highlight) {
          commands.push({
            action: 'HIGHLIGHT_ELEMENT',
            target: String(args.highlight),
            label: 'Destacando elemento',
          });
        }

        return JSON.stringify({
          success: true,
          message: `Navegação pronta: ${label} (${path})` +
            (match ? ` [match: ${match.matchedOn}, confiança: ${match.confidence}]` : ''),
          commands,
          instrucao_companion: 'O AI Companion deve despachar estes commands via portalActionBus.',
          _metadata: { portalCommands: commands },
        });
      }

       default: {
         // Bridge: tenta registry modular (Fase 3)
         try {
           const { executeTool, hasTool, initializeTools } = await import('./registry/tools-registry');
           if (!hasTool(name)) {
             await initializeTools();
           }
           if (hasTool(name)) {
             const result = await executeTool(name, args || {}, {
               userId,
               userRole: (userRole === 'ADMIN' ? 'ADMIN' : userRole === 'GERENTE' || userRole === 'MANAGER' ? 'GERENTE' : 'USER') as any,
             });
             if (result.success) {
               return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
             }
             return result.error || `Erro ao executar ${name}`;
           }
         } catch (bridgeErr) {
           console.warn('[IA Tools] Registry bridge falhou:', bridgeErr);
         }
         return `Ferramenta desconhecida: ${name}`;
       }
    }
  } catch (err) {
    return `Erro interno ao executar ferramenta: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Busca e-mails globais usando Client Credentials Flow (fallback)
 */
async function getGlobalUserEmails(
  email: string,
  options?: {
    limite?: number;
    de?: string;
    assunto?: string;
    data_inicio?: string;
    data_fim?: string;
    pasta?: string;
    incluir_corpo?: boolean;
  }
): Promise<string> {
  const MS_CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || '';
  const MS_CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || '';
  const MS_TENANT_ID = process.env.MS_GRAPH_TENANT_ID || 'common';

  if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    return 'Erro: Credenciais do Azure AD (Client ID/Secret) não configuradas no servidor.';
  }

  // 1. Obter Token de Aplicativo (Application Token)
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokenText = await tokenRes.text();
    let tokenData: any = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return 'Erro ao obter Token de App: resposta inválida do Microsoft Login.';
    }
    if (!tokenData.access_token) {
      return `Erro ao obter Token de App. A aplicação pode não ter sido configurada para o fluxo Client Credentials. Detalhes: ${JSON.stringify(tokenData)}`;
    }

    const limit = resolveGraphLimit(options?.limite, 50);
    const filters: string[] = [];
    if (options?.de) filters.push(`from/emailAddress/address eq '${options.de.replace(/'/g, "''")}'`);
    if (options?.assunto) filters.push(`contains(subject, '${options.assunto.replace(/'/g, "''")}')`);
    if (options?.data_inicio) filters.push(`receivedDateTime ge ${options.data_inicio}T00:00:00Z`);
    if (options?.data_fim) filters.push(`receivedDateTime le ${options.data_fim}T23:59:59Z`);

    const selectFields = options?.incluir_corpo
      ? `${GRAPH_EMAIL_SELECT_LIST},body`
      : GRAPH_EMAIL_SELECT_LIST;
    const basePath = options?.pasta
      ? `https://graph.microsoft.com/v1.0/users/${email}/mailFolders/${options.pasta}/messages`
      : `https://graph.microsoft.com/v1.0/users/${email}/messages`;

    const collected: any[] = [];
    let nextUrl: string | null =
      `${basePath}?$top=${Math.min(limit, 100)}&$select=${selectFields}&$orderby=receivedDateTime desc` +
      (filters.length ? `&$filter=${filters.join(' and ')}` : '');

    while (nextUrl && collected.length < limit) {
      const mailRes: Response = await fetch(nextUrl, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!mailRes.ok) {
        const errorData = await mailRes.text();
        if (mailRes.status === 403) {
          return `Erro 403 (Acesso Negado). Você configurou a Application Permission "Mail.Read.All" no Azure AD? Detalhes: ${errorData}`;
        }
        return `Erro ao ler e-mails do usuário via Graph API: ${mailRes.status} - ${errorData}`;
      }

      const mailData: { value?: unknown[]; '@odata.nextLink'?: string } = await mailRes.json();
      collected.push(...(mailData.value || []));
      nextUrl = mailData['@odata.nextLink'] || null;
    }

    if (collected.length === 0) {
      return `A caixa de entrada de ${email} está vazia ou inacessível.`;
    }

    return JSON.stringify(
      buildEmailListPayload(collected.slice(0, limit), {
        includeBody: !!options?.incluir_corpo,
        folderHint: options?.pasta,
        limiteAplicado: limit,
        hardCap: GRAPH_HARD_CAP,
        maxItems: limit,
      })
    );
  } catch (err) {
    return `Erro de rede ao conectar com Microsoft Graph: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// =====================================================
// NOVAS FERRAMENTAS DO AGENTE PROATIVO
// =====================================================

async function executePesquisarEmailsOutlook(args: any): Promise<string> {
  try {
    const limit = resolveGraphLimit(args.limite, 50);
    const emails = await msGraphClient.searchEmails(
      args.email_usuario,
      args.consulta,
      {
        from: args.de,
        to: args.para,
        subject: args.assunto,
        dateFrom: args.data_inicio,
        dateTo: args.data_fim,
        folder: args.pasta,
        isRead: args.apenas_nao_lidos === true ? false : undefined,
        hasAttachments: args.com_anexos === true ? true : undefined,
        includeBody: !!args.incluir_corpo,
        top: limit,
      }
    );

    if (emails.length === 0) return 'Nenhum e-mail encontrado com os filtros informados.';

    return JSON.stringify(
      buildEmailListPayload(emails, {
        includeBody: !!args.incluir_corpo,
        folderHint: args.pasta,
        limiteAplicado: limit,
        hardCap: GRAPH_HARD_CAP,
        maxItems: Math.min(limit, 50),
      })
    );
  } catch (err) {
    return `Erro ao pesquisar e-mails: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeEnviarEmailOutlook(args: any): Promise<string> {
  try {
    const to = args.destinatarios.split(',').map((e: string) => e.trim()).filter(Boolean);
    const cc = args.copia ? args.copia.split(',').map((e: string) => e.trim()).filter(Boolean) : undefined;

    const success = await msGraphClient.sendEmail(
      args.email_remetente,
      to,
      args.assunto,
      args.corpo,
      cc
    );

    return success
      ? `E-mail enviado com sucesso de ${args.email_remetente} para ${to.join(', ')}`
      : 'Erro ao enviar e-mail via Microsoft Graph.';
  } catch (err) {
    return `Erro ao enviar e-mail: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeCriarNotaCorporativa(args: any): Promise<string> {
  try {
    if (args.tipo === 'onenote') {
      // Primeiro, buscar notebooks e seções do usuário
      const notebooks = await msGraphClient.listNotebooks(args.email_usuario);
      if (notebooks.length === 0) return 'Nenhum notebook encontrado para este usuário.';

      const sections = await msGraphClient.listNotebookSections(args.email_usuario, notebooks[0].id);
      if (sections.length === 0) return 'Nenhuma seção encontrada no notebook.';

      const result = await msGraphClient.createOneNotePage(
        args.email_usuario,
        sections[0].id,
        args.titulo,
        args.conteudo || '<p>Sem conteúdo adicional.</p>'
      );

      return result
        ? `Nota "${args.titulo}" criada com sucesso no OneNote.${result.link ? ` Link: ${result.link}` : ''}`
        : 'Erro ao criar nota no OneNote.';

    } else if (args.tipo === 'todo') {
      const lists = await msGraphClient.listTaskLists(args.email_usuario);
      if (lists.length === 0) return 'Nenhuma lista de tarefas encontrada.';

      const result = await msGraphClient.createToDoTask(
        args.email_usuario,
        lists[0].id,
        {
          title: args.titulo,
          body: args.conteudo,
          dueDate: args.data_vencimento,
          importance: args.importancia || 'normal',
        }
      );

      return result
        ? `Tarefa "${args.titulo}" criada com sucesso no Microsoft To Do.`
        : 'Erro ao criar tarefa no To Do.';
    }

    return 'Tipo inválido. Use "onenote" ou "todo".';
  } catch (err) {
    return `Erro ao criar nota/tarefa: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeAgendarTarefaAgente(args: any, userId: string): Promise<string> {
  try {
    const { createScheduledTask } = await import('@/lib/ia/agent-service');

    const targetUsers = args.usuarios_alvo
      ? args.usuarios_alvo.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const targetRoles = args.roles_alvo
      ? args.roles_alvo.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const channels = args.canais
      ? args.canais.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['push', 'email'];

    const task = await createScheduledTask({
      userId,
      taskName: args.nome,
      taskType: args.tipo,
      prompt: args.prompt,
      schedule: args.cron,
      targetUsers,
      targetRoles,
      channels,
      maxRuns: args.max_execucoes,
    });

    return task
      ? `Tarefa "${args.nome}" agendada com sucesso! Cron: ${args.cron}. Próxima execução: ${task.next_run ? new Date(task.next_run).toLocaleString('pt-BR') : 'calculando...'}`
      : 'Erro ao agendar tarefa.';
  } catch (err) {
    return `Erro ao agendar tarefa: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeAnalisarKPIs(args: any, userId?: string, userRole?: string): Promise<string> {
  try {
    const { analyzeKPIs } = await import('@/lib/ia/agent-service');
    const analyses = await analyzeKPIs(args.departamento);

    const base: any = {
      resumo: analyses.length === 0
        ? 'Todos os KPIs estão dentro das metas! Nenhuma anomalia detectada.'
        : `${analyses.length} KPI(s) abaixo da meta`,
      criticos: analyses.filter(a => a.priority === 'critical').length,
      altos: analyses.filter(a => a.priority === 'high').length,
      detalhes: analyses.map(a => ({
        kpi: a.kpiLabel,
        atual: `${a.currentValue}${a.unit === 'percent' ? '%' : ''}`,
        meta: `${a.targetValue}${a.unit === 'percent' ? '%' : ''}`,
        gap: `${a.gap.toFixed(1)}%`,
        prioridade: a.priority,
        acao: a.suggestedAction,
        departamento: a.department || 'Global',
      })),
    };

    const shouldScan =
      args?.incluir_comunicacao === true ||
      (args?.incluir_comunicacao !== false && analyses.length > 0);

    if (shouldScan && userId) {
      try {
        const { collectKpiCommunicationSignals } = await import('./kpi-comms-signals');
        let mailbox = args?.email_monitoramento as string | undefined;
        if (!mailbox) {
          const { data: me } = await supabaseAdmin
            .from('users_unified')
            .select('email')
            .eq('id', userId)
            .maybeSingle();
          mailbox = me?.email;
        }
        if (mailbox && (userRole === 'ADMIN' || !args?.email_monitoramento)) {
          const pendencias: Record<string, number> = {};
          for (const a of analyses) {
            const key = String(a.kpiKey || '');
            if (key.includes('vacation') || key.includes('ferias')) pendencias.ferias_pendentes = 1;
            if (key.includes('reimburs') || key.includes('reembolso')) pendencias.reembolsos_pendentes = 1;
            if (key.includes('purchase') || key.includes('compra')) pendencias.compras_pendentes = 1;
            if (key.includes('evaluation') || key.includes('avaliacao')) pendencias.avaliacoes_pendentes = 1;
          }
          base.comunicacao = await collectKpiCommunicationSignals({
            emailUsuario: mailbox,
            pendencias,
            dias: Number(args?.dias) || 14,
            limite: 25,
          });
        }
      } catch (e) {
        base.comunicacao = {
          resumo: `Scan de comunicação indisponível: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }

    return JSON.stringify(base);
  } catch (err) {
    return `Erro ao analisar KPIs: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeEnviarNotificacaoProativa(args: any, userId: string): Promise<string> {
  try {
    const { sendProactiveReminder, logAgentAction } = await import('@/lib/ia/agent-service');

    const userIds = args.usuarios.split(',').map((s: string) => s.trim()).filter(Boolean);
    const channels = args.canais
      ? args.canais.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['push', 'portal'];

    const results: any[] = [];

    for (const targetUserId of userIds) {
      const result = await sendProactiveReminder(
        targetUserId,
        args.titulo,
        args.mensagem,
        channels,
        { priority: args.prioridade || 'medium', actionUrl: args.url_acao }
      );
      results.push({ userId: targetUserId, ...result });
    }

    const totalSent = results.filter(r => r.push || r.portal || r.email).length;
    return `Notificação "${args.titulo}" enviada para ${totalSent}/${userIds.length} usuário(s). Canais: ${channels.join(', ')}.`;
  } catch (err) {
    return `Erro ao enviar notificação: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeGerenciarBaseConhecimento(args: any, userId: string): Promise<string> {
  try {
    const kb = await import('@/lib/ia/knowledge-base');

    switch (args.acao) {
      case 'adicionar': {
        if (!args.titulo || !args.conteudo) return 'Título e conteúdo são obrigatórios para adicionar.';
        const entry = await kb.addKnowledge({
          title: args.titulo,
          content: args.conteudo,
          category: args.categoria || 'general',
          scope: args.escopo || 'global',
          scope_id: args.escopo === 'user' ? userId : undefined,
          tags: args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [],
        }, userId);

        return entry
          ? `Informação "${args.titulo}" adicionada à base de conhecimento (escopo: ${args.escopo || 'global'}).`
          : 'Erro ao adicionar informação.';
      }

      case 'buscar': {
        if (!args.busca) return 'Informe um termo de busca.';
        const results = await kb.searchKnowledge(args.busca, {
          userId,
          userRole: 'ADMIN', // A busca via IA usa o contexto do usuário
          limit: 10,
        });

        if (results.length === 0) return 'Nenhuma informação encontrada na base de conhecimento.';

        return JSON.stringify(results.map(r => ({
          id: r.id,
          titulo: r.title,
          conteudo: r.content.substring(0, 300),
          categoria: r.category,
          escopo: r.scope,
          tags: r.tags,
        })));
      }

      case 'listar': {
        const { entries, total } = await kb.listAllKnowledge({
          category: args.categoria,
          scope: args.escopo,
          isActive: true,
          limit: 20,
        });

        return JSON.stringify({
          total,
          entradas: entries.map(e => ({
            id: e.id,
            titulo: e.title,
            categoria: e.category,
            escopo: e.scope,
            ativo: e.is_active,
          })),
        });
      }

      case 'atualizar': {
        if (!args.id) return 'ID da entrada é obrigatório para atualizar.';
        const updates: any = {};
        if (args.titulo) updates.title = args.titulo;
        if (args.conteudo) updates.content = args.conteudo;
        if (args.categoria) updates.category = args.categoria;
        if (args.tags) updates.tags = args.tags.split(',').map((t: string) => t.trim());

        const success = await kb.updateKnowledge(args.id, updates, userId);
        return success ? 'Informação atualizada com sucesso.' : 'Erro ao atualizar.';
      }

      case 'remover': {
        if (!args.id) return 'ID da entrada é obrigatório para remover.';
        const success = await kb.deactivateKnowledge(args.id);
        return success ? 'Informação removida da base de conhecimento.' : 'Erro ao remover.';
      }

      default:
        return 'Ação inválida. Use: adicionar, buscar, listar, atualizar ou remover.';
    }
  } catch (err) {
    return `Erro ao gerenciar base de conhecimento: ${err instanceof Error ? err.message : String(err)}`;
  }
}
