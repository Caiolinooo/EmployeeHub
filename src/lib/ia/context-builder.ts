/**
 * Context Builder para o sistema de IA
 * Monta o system prompt e contexto do usuario para enviar ao LLM
 */
import { supabaseAdmin } from '@/lib/supabase';
import { getEffectiveRole, getTeamMemberIds } from './permissions';
import { getIAConfig } from './client';
import { getAvailableTools } from './tools';
import { enrichGraphEmails } from './graph-comms-format';
import type { IAUserContext, IAUserRole, LLMMessage, IAChatMessage } from '@/types/ia';

const MAX_HISTORY_MESSAGES = 30; // ate 30 mensagens para manter contexto
const MAX_CONTEXT_TOKENS_ESTIMATE = 25000; // ~20k chars para permitir historico adequado

/**
 * Buscar dados do perfil do usuario
 */
async function getUserProfile(userId: string): Promise<{
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  role: string;
  department: string;
  position: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select('first_name, last_name, email, phone_number, role, department, position')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Buscar dados de avaliacoes do usuario
 */
async function getUserEvaluations(userId: string): Promise<{
  count: number;
  avgScore: number | null;
  lastPeriod: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('nota_final, periodo_id')
      .eq('colaborador_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return { count: 0, avgScore: null, lastPeriod: null };
    }

    const scores = data.filter((d: any) => d.nota_final != null).map((d: any) => d.nota_final);
    const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;

    return {
      count: data.length,
      avgScore: avg ? Math.round(avg * 100) / 100 : null,
      lastPeriod: data[0]?.periodo_id || null,
    };
  } catch {
    return { count: 0, avgScore: null, lastPeriod: null };
  }
}

/**
 * Buscar dados de ferias do usuario
 */
async function getUserVacations(userId: string): Promise<{
  pending: number;
  upcoming: Array<{ start: string; end: string; status: string }>;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .select('start_date, end_date, status')
      .eq('user_id', userId)
      .in('status', ['PENDING_LEADER', 'PENDING_MANAGER', 'APPROVED', 'CANCELLED'])
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(5);

    if (error || !data) return { pending: 0, upcoming: [] };

    return {
      pending: data.filter((d: any) => d.status === 'PENDING_LEADER' || d.status === 'PENDING_MANAGER').length,
      upcoming: data.map((d: any) => ({
        start: d.start_date,
        end: d.end_date,
        status: d.status,
      })),
    };
  } catch {
    return { pending: 0, upcoming: [] };
  }
}

/**
 * Buscar dados de reembolsos do usuario
 */
async function getUserReimbursements(userId: string): Promise<{
  pending: number;
  totalApproved: number;
}> {
  try {
    const { data: user } = await supabaseAdmin
      .from('users_unified')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user?.email) return { pending: 0, totalApproved: 0 };

    const { data, error } = await supabaseAdmin
      .from('Reimbursement')
      .select('status, valorTotal')
      .eq('email', user.email)
      .order('data', { ascending: false })
      .limit(20);

    if (error || !data) return { pending: 0, totalApproved: 0 };

    const pending = data.filter((d: any) => d.status === 'pendente').length;
    const totalApproved = data
      .filter((d: any) => d.status === 'aprovado')
      .reduce((sum: number, d: any) => sum + (parseFloat(d.valorTotal) || 0), 0);

    return { pending, totalApproved: Math.round(totalApproved * 100) / 100 };
  } catch {
    return { pending: 0, totalApproved: 0 };
  }
}

/**
 * Buscar e-mails recentes do Microsoft Graph API
 */
async function getUserEmails(userId: string): Promise<Array<{subject: string; from: string; date: string}>> {
  try {
    const { data: integration, error } = await supabaseAdmin
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'microsoft_exchange')
      .single();

    if (error || !integration || !integration.access_token) return [];

    let accessToken = integration.access_token;
    
    // Verificacao de expiracao
    if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
      const MS_CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || '';
      const MS_CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || '';
      const MS_TENANT_ID = process.env.MS_GRAPH_TENANT_ID || 'common';
      
      const params = new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token',
      });

      const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.error && tokenData.access_token) {
        accessToken = tokenData.access_token;
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
        await supabaseAdmin.from('user_integrations').update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || integration.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }).eq('id', integration.id);
      } else {
        return [];
      }
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,hasAttachments,importance,webLink,parentFolderId`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return [];

    const mailData = await res.json();
    return enrichGraphEmails(mailData.value || [], { maxItems: 25 }).map((email) => ({
      subject: email.assunto || '',
      from: email.de?.email || email.de?.nome || '',
      date: email.data_recebido || email.data_recebido_iso || '',
    }));

  } catch {
    return [];
  }
}

/**
 * Construir contexto completo do usuario
 */
export async function buildUserContext(userId: string): Promise<IAUserContext | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;

  const effectiveRole = await getEffectiveRole(userId, profile.role);

  // Buscar contagem de feedbacks apenas para administradores
  let feedbackPendingCount = 0;
  if (effectiveRole === 'ADMIN') {
    try {
      const { count } = await supabaseAdmin
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      feedbackPendingCount = count || 0;
    } catch (e) {
      console.warn('Erro ao carregar contagem de feedbacks:', e);
    }
  }

  const [evaluations, vacations, reimbursements, recentEmails, availableToolsData] = await Promise.all([
    getUserEvaluations(userId),
    getUserVacations(userId),
    getUserReimbursements(userId),
    getUserEmails(userId),
    getAvailableTools(userId, effectiveRole),
  ]);

  const availableTools = availableToolsData.map(t => ({
    name: t.function.name,
    description: t.function.description || 'Sem descricao'
  }));

  const context: IAUserContext = {
    userId,
    userName: `${profile.first_name} ${profile.last_name}`.trim(),
    role: effectiveRole,
    department: profile.department || 'Nao definido',
    position: profile.position || 'Nao definido',
    profile: {
      email: profile.email,
      phone: profile.phone_number,
    },
    evaluations,
    vacations,
    reimbursements,
    recentEmails,
    availableTools,
    feedbacks: effectiveRole === 'ADMIN' ? { pending: feedbackPendingCount } : undefined,
  };

  if (effectiveRole === 'GERENTE') {
    context.teamMemberIds = await getTeamMemberIds(userId);
  }

  return context;
}

/**
 * Gerar system prompt baseado no contexto do usuario
 */
export function buildSystemPrompt(userContext: IAUserContext, customPrompt?: string): string {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let prompt = `Voce e o Assistente IA do Portal ABZ Group, um sistema corporativo de gestao de RH.
Hoje e ${today}.

## FLUXO DE TRABALHO (IMPORTANTE)
Quando a pergunta precisa de dados em tempo real:
1. CHAME a(s) ferramenta(s) correta(s) ANTES de afirmar números/status/valores.
2. Pode usar VÁRIAS tools em sequência quando o fluxo exigir (ex.: buscar pendências → render_dashboard → abrir_quadro_kpi).
3. Após receber o resultado, RESPONDA com base no payload (use \`_summary\` quando existir).
4. NÃO repita a mesma tool sem motivo (evite loop). Se falhar, informe a falha — não invente.

## DADOS REAIS (REGRA ABSOLUTA — anti-alucinação)
- NUNCA invente números, contagens, valores em R$, datas, status ou listas de pendências.
- Sem tool call, não invente fatos do portal. Se não houver dado, diga que não encontrou / peça para tentar de novo.
- Não existe ferramenta de logs de banco de dados/schema (migrations, DDL, criação de tabelas/índices). Se perguntarem, informe que você não tem acesso a esse dado — nunca fabrique registros de log, nomes de tabelas ou eventos de schema.

Exemplo CORRETO:
Usuario: "Quais sao minhas pendencias?"
Voce: (executa buscar_dados_usuario tipo=resumo)
Resultado: "_summary: ... 2 ferias pendentes ..."
Voce: "Voce tem 2 solicitacoes de ferias pendentes de aprovacao."

Exemplo INCORRETO (NAO FACA ISSO):
Usuario: "Quais sao minhas pendencias?"
Voce: (executa ferramenta) -> resultado -> (executa mesma ferramenta novamente) -> loop infinito!
Voce: inventa "você tem 5 reembolsos" sem tool.

## Sobre voce
- Seu nome e **ABZ Assistant**
- Voce ajuda funcionarios da ABZ Group com informacoes sobre seu trabalho
- Responda sempre em Portugues Brasileiro
- Seja profissional, objetivo e amigavel
- Use markdown para formatar respostas quando util (listas, negrito, tabelas)
- Nunca invente dados — use apenas informacoes do contexto do usuario OU resultados de tools

REGRA ABSOLUTA DE COMUNICAÇÃO (OBRIGATÓRIO PARA TODOS OS MODELOS E PROVEDORES):
- JAMAIS exiba raciocínio interno, rascunhos de pensamento ou tags como <thought>, <think> ou <reasoning> na sua resposta.
- NUNCA inclua análises de persona ou etapas de raciocínio no texto final.
- Responda DIRETA E EXCLUSIVAMENTE o conteúdo final para o usuário como ABZ Assistant.

## Usuario atual (IMPORTANTE - VOCE CONHECE ESTE USUARIO!)
- **Nome:** ${userContext.userName}
- **Email:** ${userContext.profile?.email || 'N/A'}
- **Cargo:** ${userContext.position}
- **Departamento:** ${userContext.department}
- **Nivel de acesso:** ${userContext.role}
- **Seu ID:** ${userContext.userId}

QUANDO O USUARIO PERGUNTAR:
- Sobre solicitações DELE (ex: "minhas ferias", "meus reembolsos", "meus eventos", "meus EPIs", "minhas avaliacoes", "meu resumo") → use a ferramenta buscar_dados_usuario com usuario: "meu"
- Sobre o que ELE PRECISA APROVAR (ex: "o que tenho pendente para aprovar?", "quais as pendencias da equipe?", "pendencias do sistema") → use as ferramentas de busca global correspondentes (ex: buscar_ferias_global, buscar_reembolsos_global, etc.) ou buscar_dados_usuario com tipo "resumo".
- Sobre "minhas pendencias", "pendencias" → use buscar_dados_usuario com tipo "resumo".
- Para ver dados de OUTRA pessoa → use o email ou nome dessa pessoa
- Sobre feedbacks (ex: "quais feedbacks recebemos?", "feedbacks em aberto") → apenas se for ADMIN, use as ferramentas de feedback: buscar_feedbacks, atualizar_status_feedback, excluir_feedback.
- Sobre contracheques ou holerites (ex: "quero ver meu contracheque", "link do holerite") → use obter_link_contracheque.
- Sobre contratos trabalhistas (ex: "meus contratos", "tenho contratos pendentes?", "envelopes de contratos") → use buscar_contratos.
- Sobre ponto ou presença (ex: "meu ponto", "registros de presença", "listas de presença") → use buscar_ponto para registros individuais, ou buscar_lista_presenca para ver as listas disponíveis no sistema.

O sistema ja verifica permissões automaticamente:
- USER: só vê próprios dados
- GERENTE: vê próprios + dados da equipe
- ADMIN: vê todos os dados

IMPORTANTE: Voce ja sabe o email e ID do usuario logado! NAO peca essas informacoes. Use a ferramenta buscar_dados_usuario para buscar dados.`;

  prompt += `

## DASHBOARD GENERATIVO / QUADRO BRANCO KPI
Voce tem a capacidade de renderizar uma interface visual dinâmica e interativa para o usuario.
- Sempre que o usuario pedir um **resumo**, **status geral**, **pendencias**, **KPIs** ou **alterar o modulo KPI**, use \`render_dashboard\` e/ou \`criar_quadro_kpi\` e \`abrir_quadro_kpi\`.
- Para **apagar/limpar/remover** quadros: use \`excluir_quadro_kpi\` (id e/ou titulo fuzzy) ou \`excluir_todos_quadros_kpi\`. NUNCA diga que exclusao e indisponivel.
- Harness por role (enforcement no servidor): ADMIN = liberdade máxima (widget \`html_sandbox\` permitido); MANAGER/USER = somente trabalho (sem jogos, sem HTML livre).
- Widgets: \`metric\`, \`chart\`, \`table\`, \`list\`, \`markdown\` (+ \`html_sandbox\` só ADMIN com data.srcdoc).
- **Shapes de data (obrigatório para não ficar em branco)**:
  - metric: \`{ value, label?, unit?, change?, trend? }\`
  - list: \`{ items: [{ title, subtitle?, status? }] }\` (aceita label/value/assunto/name no normalizer)
  - chart: \`{ type: "bar"|"line"|"pie", items: [{ name, value }] }\` (aceita labels/datasets)
  - table: \`{ columns: [{ key, label }], rows: [...] }\`
  - markdown: \`{ content }\`
- Prefira \`dataSource: { tool, args?, path? }\` para dados vivos (path ex.: \`comunicacao.email_sinais\`); o servidor resolve no GET /kpi?resolve=1.
- PROIBIDO: dizer que nao consegue injetar no KPI; dump de HTML/JS fora do portal; pedir salvar .html.
- USER/MANAGER pedem minigame/HTML: recuse e ofereça quadro profissional; ADMIN: use html_sandbox + abrir /kpi.
- \`render_dashboard\` persiste o layout como quadro em \`ia_kpi_boards\` e deve abrir /kpi via Companion.
- dataSource no spec só com tools allowlisted do papel do usuario.

Exemplo: Se o usuario perguntar "Como estao minhas pendencias?", voce deve:
1. Buscar os dados (ferias, reembolsos, etc).
2. Chamar \`render_dashboard\` ou \`criar_quadro_kpi\` com widgets dos dados.
3. Chamar \`abrir_quadro_kpi\` (ou deixar o persist emitir OPEN_KPI_BOARD) para mostrar em /kpi.
4. Responder em texto fazendo um resumo do que foi mostrado.
- NUNCA imprima o JSON do dashboard no texto da resposta. Use exclusivamente a ferramenta.`;

  if (userContext.evaluations && userContext.evaluations.count > 0) {
    prompt += `\n\n## Avaliacoes de Desempenho
- Total de avaliacoes: ${userContext.evaluations.count}`;
    if (userContext.evaluations.avgScore) {
      prompt += `\n- Nota media: ${userContext.evaluations.avgScore}`;
    }
    if (userContext.evaluations.lastPeriod) {
      prompt += `\n- Ultimo periodo avaliado: ${userContext.evaluations.lastPeriod}`;
    }
  }

  if (userContext.vacations) {
    const { pending, upcoming } = userContext.vacations;
    if (pending > 0 || upcoming.length > 0) {
      prompt += `\n\n## Ferias`;
      if (pending > 0) prompt += `\n- Solicitacoes pendentes: ${pending}`;
      if (upcoming.length > 0) {
        prompt += `\n- Proximas ferias:`;
        for (const v of upcoming) {
          prompt += `\n  - ${v.start} a ${v.end} (${v.status === 'APPROVED' ? 'aprovada' : 'pendente'})`;
        }
      }
    }
  }

  if (userContext.reimbursements) {
    const { pending, totalApproved } = userContext.reimbursements;
    if (pending > 0 || totalApproved > 0) {
      prompt += `\n\n## Reembolsos`;
      if (pending > 0) prompt += `\n- Pendentes: ${pending}`;
      if (totalApproved > 0) prompt += `\n- Total aprovado recente: R$ ${totalApproved.toLocaleString('pt-BR')}`;
    }
  }

  if (userContext.role === 'ADMIN' && userContext.feedbacks) {
    prompt += `\n\n## Feedbacks de Usuários
- Feedbacks pendentes/abertos no sistema: ${userContext.feedbacks.pending}`;
  }

  if (userContext.recentEmails && userContext.recentEmails.length > 0) {
    prompt += `\n\n## E-mails Recentes (Microsoft 365)
O usuario conectou sua caixa de entrada. Aqui estao os 5 e-mails mais recentes recebidos:`;
    userContext.recentEmails.forEach(email => {
      prompt += `\n- De: ${email.from} | Assunto: "${email.subject}" | Data: ${email.date}`;
    });
  }

  if (userContext.role === 'GERENTE' && userContext.teamMemberIds) {
    prompt += `\n\n## Equipe
- Voce gerencia ${userContext.teamMemberIds.length} colaborador(es)
- Voce pode perguntar sobre dados da sua equipe`;
  }

  if (userContext.role === 'ADMIN') {
    prompt += `\n\n## Acesso Administrativo Global
- Voce e um administrador com acesso GLOBAL aos dados da empresa.
- IMPORTANTE: Para responder perguntas sobre outros funcionarios ou dados gerais (Ferias, Reembolsos, E-mails de terceiros), VOCE DEVE USAR SUAS FERRAMENTAS (Tools). Nao diga que nao tem acesso. Em vez disso, chame a ferramenta apropriada (ex: ler_email_funcionario, buscar_funcionario, etc).`;
  }

  if (userContext.availableTools && userContext.availableTools.length > 0) {
    prompt += `\n\n## Ferramentas Disponiveis
Voce tem acesso as seguintes ferramentas para buscar dados em tempo real:
${userContext.availableTools.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

## Como usar ferramentas
- Use cada ferramenta APENAS uma vez por pergunta
- Apos receber o resultado da ferramenta, RESPONDA O USUARIO diretamente com os dados recebidos
- NAO repita a mesma ferramenta varias vezes
- Se a ferramenta retornar dados vazios, tente reformular a resposta com base no que voce ja sabe. JAMAIS diga ao usuario que houve erro, falha ou problema tecnico do sistema. Nunca use frases como 'estamos tendo erro', 'deu erro' ou 'sistema fora do ar'. Se algo nao vier, mantenha-se natural e gentil.
- NAO continue pedindo para executar mais ferramentas se ja recebeu os dados`;
  }

  // Instruções de Agente Proativo
  if (userContext.role === 'ADMIN' || userContext.role === 'GERENTE') {
    prompt += `\n\n## Modo Agente Proativo
- Voce tambem atua como **agente proativo**: monitora KPIs, envia lembretes e acompanha tarefas.
- Quando o usuario pedir, voce pode:
  - **Agendar tarefas** de monitoramento (cron) via ferramenta \"agendar_tarefa_agente\"
  - **Analisar KPIs** de performance e solucoes via ferramenta \"analisar_kpis_negocio\"
  - **Enviar notificacoes** proativas via push, email e popup via ferramenta \"enviar_notificacao_proativa\"
  - **Gerenciar a base de conhecimento** para guardar informacoes importantes via ferramenta \"gerenciar_base_conhecimento\"
- Os crons padrão rodam as 07:50 e 14:00 (seg-sex), mas o usuario pode personalizar.
- Sempre pergunte ao usuario se quer que voce acompanhe algo periodicamente.`;
  }

  if (customPrompt) {
    prompt += `\n\n## Instrucoes adicionais do painel\n${customPrompt}`;
  }

  return prompt;
}

/**
 * Buscar historico de mensagens da sessao para incluir no contexto
 */
export async function getSessionHistory(sessionId: string): Promise<LLMMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('ia_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  if (error || !data) return [];

  const messages: LLMMessage[] = [];
  let totalChars = 0;

  const reversed = [...data].reverse();
  for (const msg of reversed) {
    totalChars += msg.content.length;
    if (totalChars > MAX_CONTEXT_TOKENS_ESTIMATE) break;
    messages.unshift({ role: msg.role as 'user' | 'assistant', content: msg.content });
  }

  return messages;
}

/**
 * Montar array completo de mensagens para enviar ao LLM
 * system prompt + historico + mensagem nova
 */
export async function buildChatMessages(
  userId: string,
  sessionId: string,
  newMessage: string
): Promise<LLMMessage[]> {
  const [userContext, history, config] = await Promise.all([
    buildUserContext(userId),
    getSessionHistory(sessionId),
    getIAConfig(),
  ]);

  if (!userContext) {
    throw new Error('Usuario nao encontrado');
  }

  let systemPrompt = buildSystemPrompt(userContext, config?.system_prompt || undefined);

  // Injetar contexto do Sub-Agente especializado
  try {
    const { routeToSubAgent } = await import('@/lib/ia/agents-router');
    const subAgent = routeToSubAgent(newMessage);
    if (subAgent?.systemPromptAddon) {
      systemPrompt += `\n\n[SUB-AGENTE ESPECIALIZADO ATIVO: ${subAgent.name} (${subAgent.icon})]\n${subAgent.systemPromptAddon}`;
    }
  } catch (saErr) {
    console.warn('[IA Context] Erro ao carregar sub-agente:', saErr);
  }

  // Injetar contexto da base de conhecimento
  try {
    const { buildKnowledgeContext } = await import('@/lib/ia/knowledge-base');
    const kbContext = await buildKnowledgeContext(userId, userContext.role, userContext.department);
    if (kbContext) {
      systemPrompt += kbContext;
    }
  } catch (kbErr) {
    console.warn('[IA Context] Erro ao carregar knowledge base:', kbErr);
  }

  // Memória de longo prazo do usuário (Hermes-like — persiste entre logins)
  try {
    const { buildUserMemoryPromptBlock } = await import('@/lib/ia/user-memory');
    const memBlock = await buildUserMemoryPromptBlock(userId);
    if (memBlock) systemPrompt += memBlock;
  } catch (memErr) {
    console.warn('[IA Context] Erro ao carregar user memory:', memErr);
  }

  // Skills procedurais do usuário (Hermes Agent–like — persistem entre logins)
  try {
    const { buildUserSkillsPromptBlock } = await import('@/lib/ia/user-skills');
    const skillsBlock = await buildUserSkillsPromptBlock(userId);
    if (skillsBlock) systemPrompt += skillsBlock;
  } catch (skErr) {
    console.warn('[IA Context] Erro ao carregar user skills:', skErr);
  }

  // Índice breve de quadros KPI (quadro branco) + harness por role
  try {
    const { buildKpiBoardsPromptBlock } = await import('@/lib/ia/kpi-board');
    const boardsBlock = await buildKpiBoardsPromptBlock(userId, userContext.role);
    if (boardsBlock) systemPrompt += boardsBlock;
  } catch (boardErr) {
    console.warn('[IA Context] Erro ao carregar kpi boards:', boardErr);
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: newMessage },
  ];

  console.log(`[IA Context] Session: ${sessionId}, History: ${history.length} msgs, Total msgs: ${messages.length}, System prompt chars: ${systemPrompt.length}`);

  return messages;
}