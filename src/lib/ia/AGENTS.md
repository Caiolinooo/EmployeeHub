# IA Tools — DOX

## Purpose

Ferramentas LLM do portal (`tools.ts`, cliente Microsoft Graph, geradores Excel/PDF, sinais KPI via e-mail/Teams, **KPI Quadro Branco**). Contrato de extração sob demanda + registry modular (Fase 3). Companion deve **ver / consultar / raciocinar / manipular** dados reais (RBAC), sem inventar números.

## Ownership

- `src/lib/ia/tools.ts` — caminho ativo do chat (`executeToolCall`)
- `src/lib/ia/tool-result-format.ts` — `_summary` + truncagem de resultados para o LLM
- `src/lib/ia/graph-comms-format.ts` — enrichers e-mail/Teams (datas ISO+pt-BR, participantes, preview, webLink)
- `src/lib/ia/microsoft/client.ts` — Graph (paginação, filtros, Teams search)
- `src/lib/ia/kpi-comms-signals.ts` — scan e-mail/Teams correlato a pendências/conclusões
- `src/lib/ia/kpi-board.ts` + `kpi-board-shared.ts` + `kpi-board-harness.ts` — CRUD/Zod + **role harness** + soft-delete
- `src/app/api/ia/kpi-boards/route.ts` — list/create/update/delete + resolve dataSources
- `src/app/kpi/page.tsx` + `src/components/KPI/KpiBoardRenderer.tsx` — render allowlisted (+ `html_sandbox` iframe) + lixeira
- `src/lib/ia/registry/` — modules + bridge no `default` de `executeToolCall`
- `src/lib/ia/portal-action-bus.ts` + `/api/ia/companion` — navegação Companion + `OPEN_KPI_BOARD`
- `src/lib/ia/portal-navigation.ts` — catálogo de rotas, fuzzy/typos, contextos
- `src/lib/ia/user-memory.ts` — LTM `ia_user_memory`
- `src/lib/ia/user-skills.ts` — skills procedurais `ia_user_skills` (Hermes Agent–like)

## Local Contracts

### Anti-alucinação (obrigatório)

- Companion + `context-builder`: NUNCA inventar números/status/valores; sempre chamar tool antes de afirmar fatos do portal
- **Sem tool de logs/schema de BD**: prompts (`COMPANION_SYSTEM` em `/api/ia/companion` + `buildSystemPrompt` em `context-builder.ts`) proíbem fabricar logs/migrations/DDL — sem tool correspondente, a IA diz que não tem acesso
- Resultados de tools passam por `formatToolResultForLLM` (`_summary` + cap ~10k; e-mail/Teams ~28k) no loop `chatCompletion` / stream
- Loop sync: até **12** rodadas de tools; stream: até **10** (sem abort prematuro em rodada 3 sem texto)

### Graph — extração conforme solicitação

- `limite=0` → até `GRAPH_HARD_CAP` (1000) com `@odata.nextLink`
- Emails/Teams: payload **rico** via `graph-comms-format.ts` (`enrichGraphEmail` / `enrichTeamsMessage` / `buildEmailListPayload`)
  - Por item: `id`, `conversationId`, `assunto`, `de`/`para`/`cc` (nome+email), datas **ISO + pt-BR**, `preview`, `corpo_texto` opcional (HTML stripped, cap ~500–2000), `lido`, `anexos`, `importancia`, `pasta`/`pasta_id`, `webLink`, `categorias`, `flag_status`
  - Listas: tipicamente 20–50 itens completos (não thin stubs); `detalhe: "completo"`
- Tools: `meus_emails`, `ler_email_funcionario`, `pesquisar_emails_outlook`, `minhas_conversas_teams`, `pesquisar_mensagens_teams`, `buscar_sinais_kpi_comunicacao`
- `formatToolResultForLLM`: tools de comms usam cap ~28k e **preservam** arrays `emails`/`mensagens` (não só `_summary`)
- Texto fallback de e-mail (`email-tool.ts`): `stripHtmlTags` em `src/lib/html-text.ts` (loop até estabilizar; sem `/<[^>]*>/g` de um passe)
- Teams: `listTeamsChats(user)`, `searchTeamsMessages(user, consulta)` → chats com participantes + msgs com datas/preview

### KPIs + comunicação

- `buscar_kpis_sistema`: ADMIN = totais globais + scan Graph opcional; MANAGER/USER = escopo RBAC (equipe/pessoal)
- Pendências pessoais: preferir `buscar_dados_usuario` tipo `resumo`
- `analisar_kpis_negocio`: anomalias vs meta + scan Graph opcional
- `buscar_sinais_kpi_comunicacao`: scan explícito por domínio (`ferias|reembolso|compras|...`)

### Fetch pessoal (defaults)

- `buscar_ferias` / `buscar_reembolsos`: sem ID → usuário autenticado; com ID → RBAC via `canAccessUserData`
- Status férias: `PENDING_LEADER` | `PENDING_MANAGER` | `APPROVED` | `REJECTED` | `CANCELLED`
- `buscar_ferias` / `buscar_ferias_global`: `ano`, `status`, `incluir_historico` (default **true** = histórico/passado); limite maior para consultas anuais
- Status reembolso: `pendente` / `aprovado` / `rejeitado` / `pago` — valor `valorTotal`

### Mutações (RBAC)

- `aprovar_ferias` / `reprovar_ferias` (ADMIN/GERENTE|MANAGER): fluxo líder→gerente→APPROVED / REJECTED
- `aprovar_reembolso` / `reprovar_reembolso` (ADMIN): `pendente` → `aprovado` | `rejeitado`
- Actions registry (`ferias.actions` / `reembolso.actions`) alinhadas aos mesmos status

### KPI Quadro Branco v1 + harness de roles

- Spec Zod em `ia_kpi_boards.spec` — widgets `metric|table|list|chart|markdown|html_sandbox`
- **Harness** (`kpi-board-harness.ts`): enforcement server-side em create/update (tools + API); prompts sozinhos NÃO bastam
  - ADMIN: liberdade máxima; `html_sandbox` (iframe `sandbox="allow-scripts"` **sem** `allow-same-origin`); max 24 widgets; conteúdo experimental OK
  - MANAGER: work-only; max 16; sem sandbox/jogos; dataTools de equipe/ops; markdown sem scripts
  - USER: work-own-only; max 8; só dataTools pessoais; sem sandbox/jogos
- `dataSource.tool` filtrado pelo allowlist do papel; execução ainda RBAC
- Tools: `criar_quadro_kpi`, `atualizar_quadro_kpi`, `listar_quadros_kpi`, `abrir_quadro_kpi`, `excluir_quadro_kpi`, `excluir_todos_quadros_kpi`
- **Delete (higiene)**: soft-delete via `deleted_at` (+ `is_active=false`); só o dono (`user_id`); USER/MANAGER/ADMIN podem excluir **os próprios** boards; list/get/open ignoram soft-deleted
- API: `DELETE /api/ia/kpi-boards?id=` (um) ou `?all=1` (todos do usuário); UI `/kpi` tem botão lixeira com confirm
- `render_dashboard` persiste board + `_metadata.dashboard` + `portalCommands` (`OPEN_KPI_BOARD` + `NAVIGATE /kpi`)
- `/kpi` usa AuthContext `user.id` / `profile.id` (não `abz_user_id` localStorage)
- **/kpi viewport**: página preenche a coluna (`flex flex-col min-h-0 flex-1`); header `shrink-0`; quadro em `overflow-auto` (sem `min-h-screen`)
- `html_sandbox`: nunca `dangerouslySetInnerHTML` no origin; CSP no srcdoc; size cap ~100KB
- `ia_dashboard_cache` = summary TTL apenas (não confundir com boards)
- **Widget data binding**: `normalizeWidgetData` / `adaptToolResultToWidget` em `kpi-board-shared.ts` — coerção de shapes LLM (`label`/`value`/`assunto`/`labels+datasets`) → metric/list/chart/table; empty-state textual (não só ícones em branco)
- GET `/api/ia/kpi-boards?resolve=1` (botão Atualizar): executa `dataSource.tool` allowlisted, opcional `dataSource.path` (ex. `comunicacao.email_sinais`); **prefere resultado da tool** sobre snapshot vazio
- Companion `/api/ia/companion` devolve `dashboard` normalizado; FAB renderiza `GenerativeDashboard` na bolha
- Companion UI: mensagens da IA via `renderChatMarkdown` (`src/components/IA/chatMarkdown.tsx`, shared com `MessageBubble`); user = plain text; renderer suporta tabelas GFM, blockquotes, listas estruturadas e headings (só React nodes, sem HTML cru)

### Fase 3 tools (non-admin + write)

- `meus_emails`, `meu_calendario`, `criar_evento_calendario`, `minhas_conversas_teams`, `pesquisar_mensagens_teams`, `navegar_portal`
- Registry: `microsoft.tools`, `calendario.tools`, `chat.tools`, `portal.tools` (inclui board tools)
- Companion (`/api/ia/companion`): IA real + tools; fuzzy nav (`portal-navigation.ts`); commands via `_metadata.portalCommands`; UI mascote livro (`AnimatedABZLogo` → Rive/Rive-like; frames em `companion-mascot/`)
- Sub-agente `companion` no `agents-router` (ativado por `[ABZ_COMPANION]` / verbos de navegação) — inclui globals, KPIs, mutate, boards, memória/skills

## Work Guidance

- Não hardcodar `$top=5` em Graph
- Escala/treinamentos MIO: tools `buscar_escala_mio` / `buscar_treinamentos_mio` leem `gt_historico_embarques` / `gt_documentos` (nunca a API MIO no request path)
- `buscar_tripulantes`: `status` filtra o status **vivo** da célula de hoje (overlay `overlayStatusEscalaHoje`), não a coluna stale
- Docs vencidos da Matriz: `buscar_documentos_vencidos` (vigentes; `incluir_historico` para cópias antigas)
- Companion: global (`CompanionSessionProvider`); STM localStorage limpa no logout; LTM `ia_user_memory` + skills `ia_user_skills`; boards `ia_kpi_boards` + índice no prompt
- FAB = mascote livro azul via `AnimatedABZLogo` → `CompanionMascotRive` (Rive se `.riv`; senão Rive-like); body-only por default (`MASCOT_USE_FACE_OVERLAY=false`); API wait = `executing` (não `speaking`); float Framer off quando Rive drive; `useReducedMotion` → estático; `fixed` sem `relative`
- Tweak timing: `MASCOT_STATUS_CYCLES` / `MASCOT_LIP_SYNC_FPS` / `MASCOT_STATUS_BLEND_MS` em `companion-mascot-frames.ts`
- Sub-agentes: `rh_tripulantes` / `geral` / `companion` / `analytics` — `enviar_notificacao_proativa` (não `gerenciar_notificacoes` fantasma)
- Assistant stream vs Companion sync; histórico Companion ~12 msgs; multi-tool permitido
- **Companion NAVIGATE contract**: nunca prometer navegação sem `NAVIGATE` (`isTourIntent` / `ensureNavigationCommand`; tour → `/dashboard`)
- **KPI board / delete / harness**: ver contratos acima; nunca “salve .html” / dump HTML fora do portal

## Verification

- USER "minhas férias" sem ID → `buscar_ferias` do autenticado
- USER "férias do ano passado" → `buscar_ferias` com `ano` (histórico incluso por padrão)
- USER "minhas pendências" → `buscar_dados_usuario` resumo (números reais)
- Tool results no loop trazem `_summary`
- `meus_emails` / `pesquisar_emails_outlook` → cada item com `data_recebido_iso` + `data_recebido` (pt-BR), `de`/`para`/`cc`, `preview`, `webLink`
- ADMIN `buscar_kpis_sistema` → totais + comunicação; USER/MANAGER → escopo RBAC
- GERENTE/ADMIN `aprovar_ferias` com status `PENDING_*` reais
- `navegar_portal` typo `feririas` → `/ferias`; `kpi` → `/kpi`
- Companion tour → `NAVIGATE` `/dashboard`; board create/open/delete conforme DOX
- Registry bridge + FAB dashboard metadata

## Child DOX Index

- `src/components/IA/AGENTS.md` — Companion FAB UI / mascote Rive + Rive-like (crossfade, visemes, `.riv` drop-in)
