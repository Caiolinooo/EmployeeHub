# Portal ABZ — Plano mobile-first (Fase 1)

**Status:** só inventário, auditoria e plano. Nenhuma mudança de UI nesta branch.  
**Branch:** `feat/mobile-first` (a partir de `portal`). Sem merge, sem PR.  
**Data da auditoria:** 2026-09-25.  
**App:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI. Catálogo vivo em `src/config/modules.ts`.

---

## 1. Método

1. Inventário pelo código: `src/config/modules.ts`, `src/app/**/page.tsx` (198 páginas), layouts, `MainLayout`, `GtPageShell`, `admin/layout.tsx`.
2. Auditoria de código em viewport ~375–390 px: overflow, tabelas, nav, forms, modais, alvos &lt; 44 px, tipografia.
3. Prova visual: Next.js local com `.env.local` **fake** (não commitado) + Playwright (script + MCP) em **375×812** e **390×844**.
4. Rotas autenticadas **não** receberam screenshot do conteúdo real (sem login seguro). Elas foram auditadas por código. A seção 8 lista o que teve screenshot vs só código.

**Já existe base mobile (R9 / GT v2), mas o portal não é mobile-first.** Há drawer, `.tap-target`, `.table-responsive`, `.pb-safe` e `viewportFit: cover`. Adoção é irregular. Muitos módulos ainda são desktop-first com swipe horizontal.

---

## 2. Arquitetura atual (relevante para mobile)

| Peça | Onde | Comportamento hoje |
|------|------|--------------------|
| Framework | Next.js 15 App Router | `src/app/**/page.tsx` |
| Viewport | `src/app/layout.tsx` | `device-width`, zoom até 5×, `viewportFit: cover` |
| Body | `src/app/layout.tsx` | `overflow-x-hidden max-w-[100vw]` — corta overflow se faltar `min-w-0` |
| Shell principal | `src/components/Layout/MainLayout.tsx` | `h-dvh`; sidebar drawer &lt; `md` (768); hamburger 44×44; overlay `z-30`; sidebar `z-40` |
| Shell admin | `src/app/admin/layout.tsx` | Drawer próprio; footer `pb-safe`; **não** usa MainLayout |
| Shell GT-family | `GtPageShell.tsx` | `overflow-y-auto lg:overflow-hidden`; tabelas em scrollport |
| Chat | `/chat` | Layout próprio `h-screen`; **sem** MainLayout |
| Auth / token | `/login`, `/register`, públicas | Sem MainLayout |
| Breakpoints | Tailwind default | `sm` 640 / `md` 768 / `lg` 1024. Nav usa `md`; GT usa `lg` |
| Tokens | `tailwind.config.ts` | Cores `abz-*`; **sem** tokens de toque/tipo mobile |
| PWA | `src/app/manifest.ts` + `public/notifications-sw.js` | Manifest + push. **Sem** `next-pwa` / offline |
| Companion | `AICompanionWidget.tsx` | FAB global `fixed`; painel `w-[390px]` |
| Help | `HelpWidget.tsx` | FAB canto direito; mobile vira bottom sheet |

---

## 3. Inventário

Contagem: **38 módulos** no catálogo `SYSTEM_MODULES` + **1 ACL extra** (Social, redirect) + **~198 rotas** `page.tsx` (inclui legado, admin e teste).  
Flags: T = tabela/grade, F = formulário, M = modal, G = gráfico.

### 3.1 Catálogo (`src/config/modules.ts`)

| Módulo | Rota principal | Componentes principais | T | F | M | G | Shell |
|--------|----------------|------------------------|---|---|---|---|-------|
| Dashboard | `/dashboard` | `page.tsx`, `DashboardNewsWidget`, `QuickLinksWidget`, `EventsWidget`, `PendenciesWidget`, `UserShortcutsBar` | não | não | não | não | MainLayout |
| Notícias | `/noticias` | `NewsFeed`; admin `NewsAdminPanel`, `RichTextEditor` | não | parcial | sim | não | MainLayout |
| Calendário | `/calendario` | `react-calendar` + ICS/feriados | não | não | não | não | MainLayout |
| ABZ Assistant | `/ia`, `/ia/dashboard` | `ChatWindow`; Companion FAB global | não | sim | não | não | MainLayout |
| Ponto | `/ponto` | Landing Ahgora (links + PDF) | não | não | não | não | MainLayout |
| Contracheque | `/contracheque` | Lista + viewer PDF modal | sim | não | sim | não | MainLayout + GtPageShell |
| Reembolso | `/reembolso`, `/reembolso/[protocolo]` | `ReimbursementFormWrapper`, `ReimbursementDashboard`, `ReimbursementApproval` | sim | sim | sim | não | MainLayout |
| KPIs | `/kpi` | `KpiBoardRenderer`, boards `ia_kpi_boards` | não | não | sim | sim | MainLayout |
| Avaliação | `/avaliacao` + `/gerenciar` `/nova` `/pendentes` `/preencher/[id]` `/ver/[id]` | `EvaluationListClient`, `FillEvaluationClient`, `EvaluationCharts` | sim | sim | sim | sim | MainLayout |
| EPI | `/epi` | `EPIList`, `EPIForm`, `SignaturePad` | sim | sim | sim | não | MainLayout |
| Férias | `/ferias` | `ferias/page.tsx` (lista + form + export + PDF) | sim | sim | sim | não | MainLayout |
| Lista de presença | `/lista-presenca`, `/[id]`, `/public/[linkUnico]` | Lista interna; assinatura pública | sim | sim | sim | não | MainLayout / standalone |
| Contratos | `/contratos`, `/[id]`, `/[id]/assinar`, `/templates/[id]` | `DocumentUploadModal`, `SignaturePositionOverlay`, react-pdf | sim | sim | sim | não | MainLayout / fullscreen |
| Academy | `/academy` + dashboard / my-courses / course / editor / certificates | Catálogo, player, editor | sim | sim | sim | não | MainLayout / validate standalone |
| Biblioteca | `/biblioteca`, `/[slug]` | `LibraryManager`, `ModernLibraryCard` | não | sim | sim | não | MainLayout |
| Ajuda | `/ajuda` | Conteúdo + HelpWidget | não | não | não | não | MainLayout |
| Manual | `/manual` | Documento | não | não | não | não | MainLayout (`visible: false`) |
| Procedimentos | `/procedimentos` (+ gerais / logística) | Documento / PDF | não | não | não | não | MainLayout (`visible: false`) |
| Políticas | `/politicas` | Documento | não | não | não | não | MainLayout (`visible: false`) |
| Ordens de compra | `/department/purchase-orders` + new / [id] / settings | `PurchaseOrderStats`, forms | sim | sim | sim | não | layout → MainLayout |
| Poliweb | `/poliweb` | Embed / iframe | não | sim | sim | não | MainLayout |
| Man Schedule | `/department/man-schedule` | Grade `man-schedule-grid-classes.ts`, `GTManScheduleTab` | sim | sim | sim | não | MainLayout + GtPageShell flush |
| Chat | `/chat` | Canais, `CreateChannelModal`, `VideoCall`, lista de membros | não | sim | sim | não | **próprio** |
| WK Radar | `/wkradar` | Iframe | não | sim | não | não | MainLayout |
| Lista de ramais | `/contatos` | Lista | não | não | não | não | MainLayout (`visible: false`) |
| Emergência | `/emergencia` | Conteúdo | não | não | não | não | MainLayout (`visible: false`) |
| Guia Offshore | `/guia_offshore` | Conteúdo | não | não | não | não | MainLayout (`visible: false`) |
| Notificações | `/admin/notifications` | Broadcast / push | sim | sim | sim | não | Admin layout |
| Feedbacks | `/admin/feedback` | Lista | sim | não | não | não | Admin layout |
| Métricas | `/admin/metrics`, `/admin/metrics/engagement` | Métricas | sim | não | não | sim | Admin layout |
| Administração | `/admin` (~66 pages) | `UnifiedUserManager`, `UserEditor`, ACL, cards | sim | sim | sim | sim | Admin layout |
| Integração ERP | `/admin/integracao-erp`, `/integracao-erp` | Sync MIO | sim | sim | sim | parcial | mix |
| Gestão de Tripulantes | `/department/gestao-tripulantes`, `/novo` | `GTMatrix`, `CollaboratorModal`, `GTManScheduleTab`, fechamento | sim | sim | sim | não | MainLayout + GtPageShell |
| e-Social | `/department/e-social` + eventos / revisão / certificados / config | `EventosList`, `EventoRevisao`, `CertificadoManager` | sim | sim | sim | não | MainLayout + GtPageShell |
| Indicadores R&S | `/department/indicadores`, `/kpi` | Grade + Recharts | sim | sim | sim | sim | MainLayout + GtPageShell |
| Departamento Pessoal | `/department/dp`, `/novo` | Lista, `CollaboratorModal`, `DpFolhaPanel`, `ColaboradorCadastroForm` | sim | sim | sim | não | MainLayout + GtPageShell |
| Folha | `/folha-pagamento` + sheets / nova / funcionarios / empresas / relatórios | `FinanceiroHub`, `DpFolhaPanel`, `PayrollDashboard` | sim | sim | sim | parcial | MainLayout + GtPageShell |
| Financeiro | mesmo hub `/folha-pagamento` + faturas / nfse / bancos | `FaturasList`, `NfseEmissoesList`, `BancosRecebimentosTab` | sim | sim | sim | parcial | MainLayout + GtPageShell |

### 3.2 Produção fora do catálogo (ou legado)

| Nome | Rotas | T | F | M | G | Nota |
|------|-------|---|---|---|---|------|
| Social | `/social` | — | — | — | — | Redirect para `/noticias` |
| News legado | `/news`, `/news-feed`, `/news/post/[id]` | não | não | sim | não | Paralelo a `/noticias` |
| Reembolso legado | `/reembolso-form`, `/reimbursement-dashboard`, `/reimbursement-settings` | sim | sim | sim | não | Duplicata |
| Purchase requests | `/department/purchase-requests` + new / [id] / edit | sim | sim | sim | não | Sem key no catálogo |
| Dashboard BI | `/dashboard-bi` | sim | sim | sim | sim | Standalone |
| Perfil | `/profile`, `/profile/[id]` | parcial | sim | sim | não | MainLayout |
| Avaliação avançada | `/avaliacoes-avancadas` | não | não | não | sim | Chart.js |
| Assinatura token | `/assinatura/[token]` | não | sim | não | não | Fullscreen |
| Manager module | `/manager-module` + documents / noticias | sim | sim | sim | não | Legado |
| Folha (subrotas) | 14 pages sob `/folha-pagamento/**` | sim | sim | sim | parcial | Hub + config + relatórios |
| Admin | 66 pages sob `/admin/**` | sim | sim | sim | sim | Ver lista no código |

### 3.3 Auth / públicas

`/`, `/login`, `/register`, `/verify-email`, `/reset-password`, `/set-password`, `/unauthorized`, `/settings/security`, `/lista-presenca/public/[linkUnico]`, `/academy/certificates/validate/[id]`, `/assinatura/[token]`.

### 3.4 Teste / debug (fora do plano de UI)

`/debug/*`, `/test-*`, `/token-tester`, `/translation-debug`, `/login-test`, `/admin-test`, `/admin-token-test`, `/admin-fix`, `/admin-setup`. ~18 rotas. Não priorizar.

---

## 4. Achados da auditoria (por módulo)

Severidade: **crítica** = ação principal impossível ou conteúdo cortado; **alta** = UX fortemente degradada; **média** = uso possível com atrito; **baixa** = polish.

### 4.1 Com screenshot real

| Superfície | Sev. | O que quebra | Prova |
|------------|------|--------------|-------|
| Login `/login` | média | Alvos &lt; 44 px: EN/PT **35×28**, “I have an invite code” **altura 20**, Continue **40**, ícones sociais **20×20**. Form cabe na largura (sem overflow). `min-h-screen` (não `dvh`). | MCP boxes 390×844; `login-375x812.png` / `login-390x844.png` — 8 alvos pequenos |
| Registro `/register` | média | Nome/sobrenome **lado a lado** (155 px cada). Language **41×20**. Register **40** de altura. Link “Sign in” **16** de altura. Página **869 &gt; 844** (scroll vertical ok). Sem overflow X. | MCP snapshot; `register-*-*.png` — 9–10 alvos pequenos |
| Reset password | baixa | Cabe no viewport. 1 alvo pequeno (link/voltar). | `reset-password-*-*.png` |
| Unauthorized | baixa | Card simples, sem overflow. | `unauthorized-375x812.png` |
| Lista pública | média | Empty “Lista não encontrada” centralizado, sem overflow. Layout ok; fluxo real de assinatura não exercido (token fake). | `mcp-lista-presenca-public-375x812.png` |
| Validar certificado Academy | baixa | Página pública renderiza (token fake). 2 alvos pequenos. | `academy-validate-375x812.png` |
| Chat `/chat` | **crítica** | `showUserList` default **true**. Painel “Membros Online” **239 px** sobre 375. Botão fechar **28×28**. Sidebar servidores off-canvas à esquerda. `h-screen` (não `dvh`). Sem overlay no painel de membros. | Snapshot MCP: `Fechar lista de membros` + heading visível; `mcp-chat-375x812.png` |
| Language first-run | média | Modal “Choose Your Language” no 1º acesso. Continue **116×40**. | `mcp-dashboard-lang-375x812.png` |
| Gate autenticado | info | Maioria das rotas internas cai em login ou spinner `ProtectedRoute`. Conteúdo do módulo **não** fotografado. | batch `*-375x812.png` com `final=/login` |

### 4.2 Só código (módulos autenticados)

| Módulo | Sev. | Achados |
|--------|------|---------|
| Companion (global) | **crítica** | Painel `fixed bottom-24 right-24 w-[390px]` — em 375 px extrapola ~111 px; `body overflow-x-hidden` **corta**. FAB `right-[5.25rem]` compete com Help. Input sem `visualViewport` (teclado iOS). `AICompanionWidget.tsx` ~L204–227 |
| Help + Companion | alta | Dois FABs no canto. Help já tem bottom sheet; Companion não. |
| MainLayout / nav | média | Drawer existe e fecha no `pathname`. Menu longo (Meu RH + Departamento) exige scroll. Sem bottom nav. Itens `py-3.5` ok. Toggle collapse desktop `p-1.5` (só `md`). |
| `body overflow-x-hidden` | alta | Risco sistêmico: grade `w-max` sem `min-w-0` na cadeia flex = corte sem barra. Documentado em MainLayout e `man-schedule-grid-classes.ts`. |
| Dashboard | média | Atalhos: busca `min-w-[280px]`; “+” `40×40`; remover atalho `p-0.5` (14 px) — hover-only. |
| Notícias | alta (admin) | `RichTextEditor` preview `grid-cols-2` em qualquer largura. Chips ok com `overflow-x-auto`. |
| Calendário | baixa | `lg:grid-cols-3` empilha no mobile. |
| IA `/ia` | média | Chat ok em coluna; Companion por cima. |
| Ponto | média | CTAs loja `py-1.5 text-xs` (~28 px). |
| Contracheque | média | Modal PDF; fechar/ações `min-h-[40px]`. |
| Reembolso | média | Dashboard já usa `.table-responsive`. Approval: muitas colunas `px-6` sem `min-w`. Tabs `min-w-max` + scroll. |
| KPI | média | Tabs/excluir `py-1.5`; gráficos HTML dependem do board. |
| Avaliação | alta | Submit sticky + safe-area **bom**. Conflito com FAB Companion. Charts `ResponsiveContainer` ok. |
| EPI | média | Tabs com scroll; detalhe `grid-cols-2`. |
| Férias | média | Tabela admin `min-w-[800px]` + `overflow-auto` (swipe). Form/modal desktop-centrado. |
| Lista presença (logada) | média | 5 colunas + `overflow-x-auto`. |
| Contratos | média | PDF + overlay de assinatura pensados para desktop. |
| Academy | média | Catálogo empilha; editor é desktop. |
| Biblioteca | média | Manager drawer + `grid-cols-2`. |
| Compras / purchase-requests | média | Tabelas com `overflow-x-auto`. |
| Man Schedule | média (esperado) | Grade `w-max`, sticky nome, `text-[10px]`, células ~36 px. Scrollport existe **se** `min-w-0` intacto. Não é “card”; é ferramenta densa. |
| GT Matriz | média | `min-w-[760px]` no scrollport. |
| CollaboratorModal | média | ~98 dvh; tablist nowrap + overflow-x. Muitas abas no celular. |
| Fechamento | alta | `PendenciasProximoPeriodo`: tabela `min-w-[640px]` dentro de `overflow-hidden` **sem** scroll X. Workspace já é fullscreen no mobile. Tabela tripulantes `min-w-[1100px]`. |
| DP | média | Lista `min-w-[720px]`; ASO DP `min-w-[860px]`. Cadastro `/novo` é form longo. |
| e-Social | média | `EventosList` `min-w-[720px]`. Revisão XML é desktop. |
| Indicadores | média | Grade + import modal fullscreen. KPI com Recharts. |
| Folha / Financeiro | alta | `FolhaInboxAprovador`: `overflow-hidden` + tabela `min-w-[640px]` sem scroll X. `PayrollCard` `grid-cols-3` sem breakpoint. Hub tem cards. |
| Admin | média | Drawer + `.tap-target` no menu. `UnifiedUserManager` já tem `.table-responsive`. UserEditor é denso. |
| Perfil | média | `overflow-x-hidden` no container pode clipar abas. |
| Poliweb / WK Radar | alta | Iframe desktop em 375 px. |
| Embeds / PDF viewers | média | `MultiPdfViewer` / jsPDF pensados para desktop. |

---

## 5. Top problemas transversais

1. **Desktop-first + swipe**, não mobile-first: listas viram tabela larga (`min-w-[720–1100px]`). GtPageShell mitiga; o usuário ainda “lê de lado”.
2. **Companion 390 px cortado** no iPhone SE/13 mini — crítico e global.
3. **Dois (três) cromos flutuantes:** Companion + Help + submit sticky / teclado.
4. **Alvos &lt; 44 px** espalhados: ícones `p-1` / `p-1.5`, chips, EN/PT, links de rodapé. `.tap-target` existe e quase não é usado.
5. **Dois shells + exceções** (MainLayout, Admin, Chat, auth) — nav inconsistente.
6. **`overflow-x-hidden` no body** esconde bugs de flex/`min-w-0`.
7. **Modais centrados** (`max-w-lg`) em vez de bottom sheet — teclado e polegar ruins. Exceções boas: Help, fechamento, folha, alguns GT.
8. **PWA incompleto:** dá para “adicionar à tela”, sem offline nem install UX.
9. **Tipografia de grade** `text-[10px]` / `text-[11px]` em Man Schedule e fechamento — ilegível sem zoom (zoom está habilitado, ok acessibilidade).
10. **Chat** ignora o padrão do portal (sem MainLayout, lista de membros aberta).

---

## 6. Plano por fases

Esforço: **P** = 1–2 dias úteis; **M** = 3–5; **G** = 6–10. Sem UI nesta Fase 1.

### Fase A — Fundação (fazer antes de redesenhar módulo)

| # | Trabalho | Esforço | Notas |
|---|----------|---------|-------|
| A1 | Tokens: `--touch-min: 44px`, tipo base ≥16 px em input, spacing safe-area | P | Tailwind + `globals.css`. Não quebrar desktop. |
| A2 | Primitivos: `TouchButton`, `DataCardList`, `BottomSheet`, `ResponsiveTable` (card &lt;`md` / tabela ≥`md`) | M | Radix Dialog/Drawer. Sem lib nova até o dono decidir. |
| A3 | Nav mobile: implementar a decisão D1 (bottom nav e/ou drawer). Fechar drawer no navigate (já existe). | M | Um padrão para MainLayout **e** Admin. |
| A4 | Companion + Help: painel full-width / bottom sheet; FAB sem corte; teclado `visualViewport`; zona inferior reservada (`pb-safe` + altura da bottom nav) | M | Crítico. |
| A5 | Form/modal padrão: 1 coluna &lt;`md`; bottom sheet; sticky submit + safe-area (copiar avaliação) | P | Documentar no DOX. |
| A6 | Regra de tabela: lista humana → cards; grade operacional (Man Schedule, fechamento, indicadores) → swipe + sticky + `min-w-0` | P | Contrato, não rewrite. |
| A7 | Audit harness: manter `scripts/mobile-audit-screenshots.mjs` + viewports 375/390 | P | Rodar a cada onda. |

**A3+A4 bloqueiam a percepção “o portal é de celular”.** Sem isso, cada módulo remenda o próprio chrome.

### Fase B — Módulos (prioridade sugerida)

Ordem: o que o colaborador abre **no bolso** (offshore / em trânsito), depois operação de escritório, depois admin.

| Prioridade | Módulo | Esforço | Por quê | Abordagem |
|------------|--------|---------|---------|-----------|
| P0 | Login / register / reset / set-password | P | Porta de entrada; já quase cabe | Alvos 44 px; `dvh`; 1 coluna no register |
| P0 | Shell + Companion + language picker | M | Global | Fase A3–A4 |
| P1 | Dashboard | M | Home diária | Cards empilhados; atalhos com alvo de toque |
| P1 | Notícias | P | Leitura no celular | Feed já empilha; consertar editor admin depois |
| P1 | Férias | M | Pedido + PDF + assinatura | Lista → cards; form bottom sheet; manter PDF |
| P1 | Reembolso | M | Foto de recibo no celular | Form 1 col; lista cards; approval tabela→cards |
| P1 | Contracheque | P | Abrir holerite | Lista cards; viewer fullscreen |
| P1 | Ponto | P | Deep link Ahgora | CTAs 44 px; copy clara |
| P2 | Lista de presença (pública + logada) | M | Assinar no celular | Já é candidato natural; empty state ok |
| P2 | Contratos / assinatura | M | Assinar PDF no celular | Overlay touch-friendly |
| P2 | Academy (catálogo + player) | M | Curso no quarto de hotel | Editor fica P3 |
| P2 | Avaliação (preencher) | M | Form longo; sticky já existe | Cards de questão; FAB não cobrir submit |
| P2 | Perfil + assinatura digital | P | Soft prompt já existe | Abas em scroll; sem clip |
| P2 | Calendário / Ajuda / Biblioteca (leitura) | P cada | Conteúdo | Empilhar; PDF fullscreen |
| P3 | Chat | M | Crítico hoje, uso menor que RH | Fechar membros no mobile; `dvh`; bottom composer |
| P3 | KPI / IA `/ia` | M | Boards HTML | Harness estreito; Companion sheet |
| P3 | EPI | M | Lista + form + assinatura | Cards + sheet |
| P4 | GT Matriz / DP lista / e-Social listas | G | Operação; tabelas 720–860 px | **Não** virar card cego. Filtros sticky + swipe + ficha fullscreen (já ~98 dvh) |
| P4 | Man Schedule | G | Grade é o produto | Manter grade; chrome mobile (toolbar wrap, alvos, sticky nome). Sem “card por dia” sem o dono. |
| P4 | Fechamento / Folha inbox | M | Bugs de `overflow-hidden` | Corrigir clip; workspace já fullscreen |
| P4 | Indicadores / Folha hub / Financeiro | G | Grades + forms | Cards no hub; grades com scrollport |
| P5 | Compras / purchase-requests | M | Staff | Cards + form 1 col |
| P5 | Admin (66 rotas) | G | Desktop-primary aceitável | Aplicar primitivos; UserEditor por último |
| P5 | Poliweb / WK Radar / iframe | P | Só chrome | Aviso “melhor no desktop” + open-in-browser |
| P6 | Legado (`/news*`, `/reembolso-form`, `/manager-module`, `/dashboard-bi`) | P | Redirecionar ou esconder no mobile | Não redesenhar |

### Fase C — PWA e qualidade (depois de P0–P2)

| # | Trabalho | Esforço | Depende de |
|---|----------|---------|------------|
| C1 | Install prompt + ícones 192/512 reais | P | D2 |
| C2 | Offline mínimo (shell + última tela) | M | D2 = sim |
| C3 | Push já existe; revisar UX mobile | P | — |
| C4 | Pass de QA 375 / 390 / 430 em todo P0–P2 | M | A7 |

---

## 7. Decisões do dono (consultar antes da Fase A)

### D1 — Navegação no celular

| Opção | Prós | Contras |
|-------|------|---------|
| A. Só drawer (como hoje, polido) | Menos código; todos os módulos cabem | Polegar no hamburger; 2 toques para Férias |
| B. Só bottom nav (4–5 itens) | Padrão de app; acesso rápido | ~38 módulos não cabem; “Mais” vira drawer |
| C. Híbrido: bottom nav (Home, Notícias, Meu RH, +Mais) + drawer completo | Diário no polegar; resto no Mais | Dois sistemas para manter |

**Recomendação: C.** Bottom nav com 4 destinos do colaborador (Dashboard, Notícias, atalho RH — Férias ou Reembolso —, Mais). Drawer atual vive dentro de Mais. Admin **sem** bottom nav (drawer basta).

### D2 — PWA

| Opção | Prós | Contras |
|-------|------|---------|
| A. Não | Menos escopo | “Abrir no Safari” continua |
| B. Install only (manifest já existe) | Ícone na home | Sem offline |
| C. Install + shell offline | Sensaçao de app; ponto/férias offline-lite | Cache errado em portal autenticado |

**Recomendação: B agora, C depois de P2.** Manifest já está em `src/app/manifest.ts`. Não meter `next-pwa` na fundação.

### D3 — Quais módulos primeiro

**Recomendação:** P0–P1 da tabela (login, shell, dashboard, notícias, férias, reembolso, contracheque, ponto). GT/Man Schedule **não** são P0: são ferramentas de mesa; no celular precisam ser *usáveis* (swipe), não redesenhados.

### D4 — Desktop pode mudar?

| Opção | Prós | Contras |
|-------|------|---------|
| A. Desktop congelado; só &lt;`md` muda | Zero regressão de grade | Dois designs para sempre |
| B. Desktop pode evoluir (tokens, sheets em tablet, cards opcionais) | Um sistema | Risco em Man Schedule / fechamento |
| C. Tudo vira mobile-first e desktop “estica” | Consistência | Inaceitável para grade de escala |

**Recomendação: B com cerca:** tokens e primitivos globais; **não** converter Man Schedule / indicadores / fechamento em cards no desktop. `lg:` continua dono da grade.

### D5 — Lib de componentes

| Opção | Prós | Contras |
|-------|------|---------|
| A. Só Tailwind + Radix (hoje) | Já no repo | Cada módulo inventa modal |
| B. A + kit interno (`BottomSheet`, `DataCard`, `TouchButton`) | Padrão sem vendor | Precisa disciplina DOX |
| C. Nova lib (MUI / Ionic / shadcn pack) | Pronto | Conflito visual ABZ; bundle |

**Recomendação: B.** shadcn-like em cima de Radix, visual ABZ. Sem Ionic/MUI.

### D6 — Tabela vs card

**Recomendação:**  
- Listas de *pessoas/pedidos* (férias, reembolso, contracheque, EPI, academy, admin users): **card no &lt;`md`**.  
- Grades *operacionais* (Man Schedule, matriz GT, indicadores, fechamento NxN): **swipe + sticky**. Não card-por-célula.

### D7 — Companion no mobile

| Opção | Prós | Contras |
|-------|------|---------|
| A. Esconder no &lt;`md` | Some o corte | Dono perdeu a IA no bolso |
| B. Bottom sheet full-width + FAB menor | Continua global | Compete com bottom nav |
| C. Entrada só em `/ia` no mobile | Limpo | Menos “companion” |

**Recomendação: B**, com FAB à **esquerda** ou no item “Mais”, e sheet `inset-x-0 bottom-0 h-[85dvh]`. Help fica no sheet ou no Mais — não dois FABs.

### D8 — Chat

**Recomendação:** no mobile, membros **fechados** por padrão; `h-dvh`; composer acima do teclado. Não forçar MainLayout no chat na primeira onda (risco alto). Alinhar chrome depois.

---

## 8. Screenshot vs código

### Screenshot real (Playwright, 375×812 e/ou 390×844)

Ambiente local, JWT/URL **fake**, sem segredos no git. Conteúdo autenticado **não** aparece.

| Rota | Arquivos | Nota |
|------|----------|------|
| `/login` | `docs/mobile-audit/login-375x812.png`, `login-390x844.png`, `mcp-login-375x812.png`, `mcp-login-390x844.png` | UI real; 8 alvos &lt; 44 |
| `/register` | `register-375x812.png`, `register-390x844.png`, `mcp-register-*.png` | UI real; 9–10 alvos |
| `/reset-password` | `reset-password-*.png`, `mcp-reset-password-390x844.png` | UI real |
| `/unauthorized` | `unauthorized-375x812.png` | UI real |
| `/lista-presenca/public/…` | `lista-presenca-public-*.png`, `mcp-lista-presenca-public-375x812.png` | Empty state real |
| `/academy/certificates/validate/…` | `academy-validate-375x812.png` | Público, token fake |
| `/chat` | `mcp-chat-375x812.png`, `chat-375x812.png` | UI real; lista de membros aberta |
| `/dashboard` (1º acesso) | `mcp-dashboard-lang-375x812.png`, `dashboard-375x812.png` | Language picker / loading — **não** o dashboard logado |
| `/`, `/set-password`, `/verify-email`, `/assinatura/…`, `/admin` | batch `docs/mobile-audit/<slug>-<viewport>.png` | Loading, redirect ou empty |

Métricas: `docs/mobile-audit/metrics.json`.  
Script: `scripts/mobile-audit-screenshots.mjs`.

### Só código (sem screenshot do módulo autenticado)

Dashboard (widgets), notícias (feed logado), calendário, `/ia`, ponto, contracheque, reembolso, KPI, avaliação, EPI, férias, lista logada, contratos, academy logada, biblioteca, ajuda, compras, Man Schedule, GT, DP, e-Social, indicadores, folha/financeiro, perfil, admin (conteúdo), Poliweb, WK Radar, Companion aberto (painel 390 px — medido no código).

**Não** contornamos login com token real, bypass de `ProtectedRoute` commitado, nem credenciais de produção.

---

## 9. Próximo passo (Fase 2, depois das decisões)

1. Dono responde D1–D8 (mesmo que “vai com a recomendação”).  
2. Abrir PR de **fundação** (A1–A7 + P0) a partir desta branch ou de `portal`.  
3. Uma PR por fatia P1 (férias, reembolso, …) — sem big-bang.  
4. Não alterar `portal` até o dono pedir merge.

---

## 10. Fora de escopo desta Fase 1

- Qualquer CSS/JS de UI “já que estamos aqui”.  
- Redesign visual da marca.  
- App nativo (React Native).  
- Offline de escalas / OCR no celular.
