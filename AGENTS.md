# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

- **Reembolso emails**: três listas no admin — `recipients` (@groupabz.com), `externalRecipients` (outros domínios), `financeEmails` (pós-aprovação/pago). Ver `src/app/api/reembolso/AGENTS.md`.
- **Secrets / credenciais**: nunca hardcodar senhas, app passwords, JWT secrets ou fallbacks reais em código, docs ou scripts. Usar `src/lib/email-env.ts`, `src/lib/jwt-secret.ts`, `WKRADAR_DEFAULT_PASSWORD`. CI: Gitleaks (`.gitleaks.toml`). Incidentes de exposição: seguir `tasks.md` + `SECURITY.md`.
- **Middleware (Next 15.5)**: `middleware.ts` no **mesmo parent** que o `pagesDir` vencedor. `findDir` prioriza `./pages` sobre `./src/pages`; o build procura `middleware.*` em `path.join(pagesDir, '..')`. Enquanto existir `pages/` na raiz (stub `pages/api/check-env.js`), o ficheiro tem de viver em `./middleware.ts` — `src/middleware.ts` é ignorado e o manifesto sai `{ middleware: {} }`. Não apagar `pages/` sem remover conflitos `src/pages/api` vs `src/app/api` (senão o build quebra e `src/pages` legado volta a ser compilado). Verificar com `npm run assert:middleware`. Matcher exclui `/api` + `_next/static|_next/image|_next/data` + `favicon.ico|public|images|fonts|documentos`. Header de prova: `x-abz-middleware`. Gate de cookie **só** `/avaliacao` e `/avaliacao/...` (`isAvaliacaoPagePath` em `src/lib/middleware-gates.ts`) — nunca `startsWith('/avaliacao')` (pega `/avaliacoes-avancadas`). Públicas: `/login` `/register` `/set-password` `/reset-password` `/verify-email` `/lista-presenca/public/*`. Login APIs não passam no matcher. `/login` e páginas de runtime **não** chamam `GET /api/auth/ensure-admin` nem `/api/admin/ensure-admin` (gated com `CRON_SECRET`; bootstrap de admin = script/cron, não mount do login). Não regravar cookies `abzToken`/`token` no branch `/avaliacao` (TTL 1d encolhia a sessão de 30d do `saveToken`). Restante das páginas = locale `NEXT_LOCALE` only. Teste: `npx tsx --test src/lib/middleware-gates.test.ts`.
- **Email no portal**: admin em `/admin/email-settings`; `app_secrets` (senha AES); runtime DB → env; transporte `smtp` | `graph` | `auto` (O365 com erro 535 → preferir Graph + `MS_GRAPH_*`). Ver `src/app/api/admin/email-settings/AGENTS.md`.
- **IA Graph**: extrair dados conforme solicitação do usuário (filtros + `limite=0` até hard cap 1000). E-mail/Teams tools devolvem payload **rico** (`graph-comms-format`: datas ISO+pt-BR, participantes, preview/corpo truncado, webLink, pasta, status) + `_summary` sem descartar o JSON detalhado. KPIs com pendências disparam scan e-mail/Teams. Ver `src/lib/ia/AGENTS.md`.
- **IA Companion**: global em todos os módulos; STM em `localStorage` (limpa só no logout); LTM `ia_user_memory` (persiste); skills procedurais `ia_user_skills` (Hermes Agent–like, persistem); FAB mascote livro azul (`AnimatedABZLogo` → Rive body-only `companion-mascot.riv` SM `CompanionSM` status/viseme no-op — senão Rive-like; **sem** face overlays por default — body PNGs já têm face; soft mixes ~500ms; API wait = `executing` não `speaking`); bolhas da IA com Markdown via `chatMarkdown.tsx` (shared com Assistant `MessageBubble`; user = plain text). Navegação: nunca prometer abrir módulo sem `NAVIGATE` (`isTourIntent` / `ensureNavigationCommand`; tour → `/dashboard`; kpi → `/kpi`). Quadro branco KPI: `ia_kpi_boards` + harness por role (`kpi-board-harness.ts`) — ADMIN livre (`html_sandbox`); USER/MANAGER só trabalho; tools board (criar/atualizar/listar/abrir/**excluir**/excluir_todos) + `OPEN_KPI_BOARD` → `/kpi` (nunca “salve .html” / dump HTML fora do portal; nunca dizer que delete é indisponível). Cards IA: `normalizeWidgetData` (KPI + chat + Companion); resolve `dataSource` no refresh `/kpi`. **Dados**: nunca inventar números — sempre tools; `formatToolResultForLLM` (`_summary`); `buscar_ferias`/`buscar_reembolsos` default = usuário logado; `buscar_ferias` aceita `ano`/`status`/`incluir_historico` (histórico por padrão); mutate `aprovar_*`/`reprovar_*` com RBAC. **Férias UI**: histórico (status+ano), export XLSX/CSV, Detalhes → formulário PDF preenchido (`/api/leave/[id]/pdf`) com carimbo de `signature_url` (sem cadastro → “Assinatura não cadastrada”). Ver `src/lib/ia/AGENTS.md` e `src/app/ferias/AGENTS.md`.
- **Assinatura digital**: global via `SignatureProvider` / `useSignature().requestSignature` (`SignatureModal` único); API `GET/POST /api/user/signature`; perfil `SignatureTab`. Em `/ferias`, soft prompt se `!hasSignature` (banner + gate em criar/baixar PDF), dismissível com `sessionStorage` `ferias_signature_prompt_dismissed` — não bloquear o módulo. Não montar segundo SignatureModal.
- **Fechamento de escalas (assinaturas)**: lista nomeada de `aprovadores_obrigatorios` = exatamente essas pessoas devem assinar (match por user id, e-mail secundário), **independente de role**. Extras não fecham o fluxo. Lista vazia = fallback ADMIN/MANAGER (nunca USER, nunca “esperar para sempre”). USER na lista pode `POST /api/gestao-tripulantes/relatorio-mensal/aprovar`. Dropdown admin lista usuários ativos com e-mail (`first_name`/`last_name`/`tax_id`). `ModalAprovacaoFechamento` usa `useSupabaseAuth`, não `AuthContext` legado. Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Fechamento DP (cálculo NxN)**: comparativo embarque N / folga N a partir de dt início e dt fim. Dobra = excedente a bordo; FI = folga não gozada + evento FI (sem duplicar); exporta também dias folga e STB. Mesmos números na UI, `GET /relatorio-mensal` (`calculosFolha`) e XLSX. Sem dt fim não inventa janela. Motor `fechamento-calculo.ts`. Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Motor de OCR & Identidade**: Validação estrita por Módulo 11 oficial (CPF/CNPJ); auto-reparo guiado por matriz de confusão óptica (`CONFUSAO_OPTICA`, `8`↔`9`, `3`↔`8`, `0`↔`O`, `1`↔`I/l/7`, etc.) e reconciliação contextual com o perfil do colaborador ($\le 2$ diffs); detecção contextual de caixas de seleção `(X) APTO` para evitar falsas inaptidões decorrentes de modelos pré-impressos; correção de séculos de nascimento (`18xx` $\rightarrow$ `19xx`); isolamento de RG sem sobreposição de CPF. Ver `src/app/api/gestao-tripulantes/AGENTS.md` e `src/lib/ocr/ocr-repair.ts`.
- **ASO agendamento DP→logística**: antecedência configurável (padrão **60 dias**) em `/admin/gestao-tripulantes` aba Agendamento ASO (`gt_aso_agendamento_config`). Sugestões pela escala local (`gt_historico_embarques` + `embarque-status.ts`: preferir STB, evitar ON). DP escolhe data e assina; logística aprova/reprova com `useSignature` + hash `GT_ASO_AGENDAMENTO:...`. Aprovar/reprovar: `isLogisticaRole` **ou** setor logística-like com módulo `gestao-tripulantes` (`podeAprovarAsoLogistica` — sem e-mail hardcoded). Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Status de embarque na UI**: badges/listas/filtros/ficha usam a célula de **hoje** em `gt_historico_embarques` (+ afastamentos), via `embarque-status.ts` (`statusEmbarqueFromDayCode` / `overlayStatusEscalaHoje`). Nunca só `gt_colaboradores.status_embarque` (pode estar stale vs a escala). ON → Embarcado; STB → StandBy; OFF/OFF-C/FI → Folga; FER/AFAST → Afastado. POB continua só ON exato. Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **e-Social TS_nome (S-2220)**: `nmMed`/`nmResp` só nome (2–70, sem cargo/quebra de linha). OCR lixo (`Médica`, `à Á`) sai em `sanitizeTsNome`; Validar Auto-Correção e pré-envio rebuildam XML. Ver `src/lib/e-social/AGENTS.md`.
- **e-Social datas (S-2220)**: sempre DD/MM (PT-BR), mesmo se exames vierem em MM/DD inglês. `10/08/2026` = `2026-08-10`; `dtExm` swap de `dtAso` (`2026-10-08`) alinha em `dtAso`. Nunca `Date.parse`. Ver `src/lib/e-social/AGENTS.md`.
- **e-Social matrícula**: sempre editável na revisão do evento (não só erro de contrato). `POST /api/e-social/corrigir-matricula` grava evento + XML + `gt_colaboradores.matricula`/`matricula_esocial`. Processado com recibo fica travado. Cadastro GT expõe `matricula_esocial`. Ver `src/app/department/e-social/AGENTS.md`.
- **MIO canonical local**: future modules read only `gt_*` (`src/lib/gestao-tripulantes/gt-canonical.ts`). Runtime never calls MIO/PoliWeb. Pull admin/cron `POST /api/gestao-tripulantes/mio/sync` copies integrantes (incl. inativos), treinamentos, ASO (every READ path), embarques/LGP extras, afastamentos, anexos, leftover entidades. Man Schedule serves `gt_historico_embarques`. Nunca PUT/PATCH/DELETE/upload de volta ao MIO. Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Regime sem escala**: `sem_escala` / `administrativo` / `onshore` são regimes válidos (administrativos/onshore sem rotação offshore). **14x14 não é o default de vazio/null**. `escala_embarque`/`escala_folga` = 0. Dobra automática só em NxN. Pull MIO não sobrescreve override local; vazio/onshore no MIO mapeia para `sem_escala`/`onshore`. Ver `src/lib/gestao-tripulantes/regime-escala.ts` e `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Deploy / hosting**: produção e previews no **Vercel** apenas. Não usar Netlify (legado); ao falar de deploy, env vars, cron ou build, referir Vercel.
- **Startup Experience (Splash & Áudio)**: gerenciado em `/admin/users` via `UserEditor` e `users_unified` (`startup_splash_enabled`, `startup_splash_url`, `startup_sound_enabled`, `startup_sound_url`). Assets em bucket `user-startup-assets`. Visualizado na tabela com badges e executado 1x por sessão via `StartupExperience`.
- **Calendário (`/calendario`)**: só feriados oficiais + eventos do ICS compartilhado. Sem embarques, cursos, ASO ou outros eventos operacionais MIO/`gt_*`. Ver `src/app/calendario/AGENTS.md`.
- **QHSE/EPI na ficha**: aba **QHSE / EPI** no modal GT e em `/profile` (seção no UserEditor) quando o viewer tem o módulo `epi`. Sem ACL extra de catálogo. Admin libera em `/admin/users` → Módulos do Sistema → EPI. **Nunca lista ASO/laudo** — exames ocupacionais ficam só na aba ASO. Ver `src/lib/document-catalog/AGENTS.md`.
- **Documentos globais do colaborador**: catálogo vivo em `src/lib/document-catalog/` (`tax_id` / user id / e-mail / telefone / nome único). Nunca `SELECT cpf` em `users_unified`. Nunca `SELECT cargo_nome` em `gt_colaboradores` (alias da view; use `cargo:gt_cargos(nome)`). Portal user existente não vira 404. Inclui QHSE/ficha EPI e listas de presença assinadas. Sem copiar blobs. Ver `src/lib/document-catalog/AGENTS.md`.
- **Catálogo vivo de permissões**: `src/config/modules.ts` é a fonte única (módulo + features JSONB + ACL). Sidebar (`src/constants/modules.ts`), UserEditor, RolePermissions e `POST /api/acl/init` consomem esse registry. Novo módulo no catálogo aparece nas UIs sem segunda lista morta. Cards extras em `cards` entram como flag de módulo. Ver `src/config/AGENTS.md`.
- **Viewport do portal**: shell `h-dvh` + coluna de conteúdo `flex flex-col min-h-0 flex-1`; página preenche; `<main>` com padding responsivo (`px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6`), `min-w-0` e `-webkit-overflow-scrolling: touch;`. Em desktop (`lg:`), filtros/header `shrink-0` e lista/tabela primária em `flex-1 min-h-0 min-w-0 overflow-auto` (grades largas, ex. Man Schedule, rolam no pane — não esticam a página/sidebar). Em mobile/telas compactas (`< 1024px`), `GtPageShell` permite rolagem vertical fluida (`overflow-y-auto lg:overflow-hidden`) e as tabelas/grades mantêm altura mínima (`min-h-[320px]` / `min-h-[360px]`) **e** scroll horizontal próprio no scrollport da grade. Menus mobile fecham automaticamente na navegação (`pathname`). Menu lateral (`MainLayout`): `<nav>` é o scrollport (`flex-1 min-h-0 overflow-y-auto`), header do logo e créditos `shrink-0` — sem `min-h-0` o menu empurra o rodapé para fora da viewport (conteúdo cortado e inalcançável). Estado colapsado/aberto vem do localStorage no mount: renderizar já no estado final com transições desabilitadas até ser pintado (`layoutTransition` / `isLayoutStateLoaded`, double-rAF) — sem animação de esticar ao abrir; transições apenas em toggles iniciados pelo usuário.
- **Cadastro DP (funcionário do zero)**: DP cria e altera qualquer campo de `gt_colaboradores` via `POST|PUT /api/gestao-tripulantes/colaboradores` (mesmo banco interno; sem tabela paralela). Gate = ADMIN/MANAGER/SUPERADMIN **ou** setor DP/RH + módulo `gestao-tripulantes` (`podeMutarCadastroColaborador`). CPF Módulo 11; `matricula_esocial` vazio copia `matricula`. Form `ColaboradorCadastroForm` em `/department/dp/novo`, `/department/gestao-tripulantes/novo` e aba Dados Pessoais (Editar). Ver `src/app/department/dp/AGENTS.md`.
- **Desligamento (rescisão)**: processo em `gt_desligamentos` via `CollaboratorModal` (aba/botão), **não** na lista DP. Permissão ADMIN/MANAGER ou setor DP/RH + módulo `gestao-tripulantes`. Folha é fail-soft; e-Social S-2299 reusa `autoGenerateESocialEvents` (`motivo_demissao` = `mtvDeslig`). Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Editar/excluir itens do cadastro GT (treinamentos/ASO/documentos/passaportes)**: gate único em `PUT`/`DELETE /api/gestao-tripulantes/documentos/[id]` (`documento-permissions.ts`) — ADMIN/MANAGER bypass, senão feature JSONB `gestao-tripulantes.documents.edit`/`.delete` (checkbox em `/admin/users`) **ou** ACL granular (`acl_permissions` resource `gestao-tripulantes`). Cliente: `useGtDocumentPermissions()` lê `hasFeature` (JSONB + nomes ACL via `GET /api/user/effective-permissions`) e confirma em `GET /api/gestao-tripulantes/documentos/permissions`. Feature checkbox fica visível mesmo com o módulo GT desmarcado; ligar a feature liga o módulo. ASO já enviado ao e-Social não é editável/excluível. Treinamentos agora contam com edição e exclusão total de lançamentos incorretos, inclusive no histórico colapsado. Ver `src/app/api/gestao-tripulantes/AGENTS.md`.
- **Matriz de Treinamento & Conformidade por Cargo (Setores & ACL)**: gerenciado em `/admin/gestao-tripulantes` e também disponível diretamente em `/department/gestao-tripulantes` (aba e botão de cabeçalho "Matriz de Treinamentos"). Exibição e mutação (`/api/gestao-tripulantes/matrizes`) condicionadas à autorização via Setor (DP, RH, Treinamento, Operações, SMS/QHSE, Gestão de Tripulantes com módulo `gestao-tripulantes`), Role (ADMIN/MANAGER), Feature JSONB (`gestao-tripulantes.matrizes.manage` configurável em `/admin/users`) ou ACL granular (`acl_permissions` action `matrizes.manage`/`matrizes.view`). Usuários sem permissão não veem a aba administrativa. Suporta importação de planilhas XLSX oficiais do MIO (`Matriz - Modelo 002`) e cruzamento com o colaborador em `TreinamentosTab` (`MatrizConformidadeColaboradorCard`).
- **Lista de Presença para Treinamentos Internos**: modal integrado `ModalListaPresencaTreinamento` gerando lista formal no portal (`/lista-presenca`) para assinaturas digitais, com opção de lançamento imediato em lote da conclusão do treinamento no prontuário de todos os participantes selecionados.
- **Sistema de ACL (visão geral)**: três camadas independentes coexistem — módulos on/off (`access_permissions.modules` + `sectors.allowed_modules`), features JSONB granulares (`access_permissions.features`, `src/lib/permissions.ts`) e tabelas ACL (`acl_permissions`/`user_acl_permissions`/`role_acl_permissions`, checadas via `checkAclPermission`). `hasFeature` / `hasEffectiveFeature` tratam JSONB **e** nome ACL (`gestao-tripulantes.documents.delete`) como o mesmo grant. `GET /api/user/effective-permissions` devolve `effective_features` + `acl_permission_names` do DB (sem cache HTTP; cliente refetch em focus/visibility/`permissions-updated`). A maioria dos módulos usa só as duas primeiras; **férias** e **gestão de tripulantes** (`documents.edit`/`documents.delete`, `matrizes.manage`/`matrizes.view`) também aceitam a 3ª. Seed vivo em `POST /api/acl/init` lê `src/config/modules.ts` (não um array morto). Não regressar GT/e-social.

## Child DOX Index

- `src/app/api/reembolso/AGENTS.md` — fluxo de emails e status de reembolso
- `src/app/api/admin/email-settings/AGENTS.md` — credenciais SMTP no admin (app_secrets)
- `src/app/api/gestao-tripulantes/AGENTS.md` — ASO identity gate, ASO agendamento DP/logística (60d config), e-Social, Man Schedule from `gt_*`, MIO canonical pull, fechamento lista nomeada, cadastro DP (`gt_colaboradores`), desligamento (`gt_desligamentos` + S-2299)
- `src/lib/ia/AGENTS.md` — tools LLM, Graph, Companion (`portal-navigation` fuzzy + IA real)
- `src/components/IA/AGENTS.md` — Companion FAB UI / mascote Fase 0 + Rive/Rive-like
- `src/app/ferias/AGENTS.md` — histórico, export XLSX/CSV, PDF preenchido + assinaturas + soft prompt de cadastro
- `src/app/department/dp/AGENTS.md` — DP: cadastro do zero (`/novo`), edição total via `gt_*`, lista achatada, ASO vencimentos + agendamento (60d), viewport `GtPageShell`
- `src/app/department/e-social/AGENTS.md` — e-Social: listas no pane (`GtPageShell`), `fetchWithToken`
- `src/lib/e-social/AGENTS.md` — `TS_nome` / `nmMed` + datas PT-BR (`dtExm`/`dtAso`) e rebuild XML S-2220
- `src/components/gestao-tripulantes/AGENTS.md` — lookups criáveis, KPIs ativos, viewport dia/semana, inbox ASO logística, scroll horizontal + sticky da escala (`min-w-0`), `GtPageShell` das páginas GT-family
- `src/app/calendario/AGENTS.md` — só feriados + ICS compartilhado; sem MIO/embarque/curso
- `src/app/api/calendar/AGENTS.md` — ICS `from`/`to` vs `rangeDays` (futuros)
- `src/lib/employee-hub/AGENTS.md` — ficha unificada (`gt_*` + portal via `tax_id`/e-mail + férias + reembolso)
- `src/lib/document-catalog/AGENTS.md` — catálogo global de documentos (QHSE/EPI, lista de presença, GT, academy)
- `src/config/AGENTS.md` — catálogo vivo de módulos + permissões (UserEditor / ACL)
- `src/app/api/acl/AGENTS.md` — seed ACL a partir do catálogo vivo

## Index of Modules

