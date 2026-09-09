# Gestão de Tripulantes UI — DOX

## Purpose

Componentes da Matriz, modal do colaborador e Man Schedule. Lookups profissionais compartilhados e viewport da escala.

## Ownership

- `src/components/gestao-tripulantes/`
- Lookups: `SearchableCreatableSelect.tsx`, `createGtLookupOption.ts`
- KPIs: consomem `GET /api/gestao-tripulantes/dashboard` (`dashboard-service.ts`)
- Filtro de data da escala: `ScheduleDateFilterInput.tsx` + `src/lib/gestao-tripulantes/filter-date.ts`
- ASO logistics inbox: `AsoAgendamentoInbox.tsx` (aba GT **ASO Logística**)
- ASO DP panel: `AsoAgendamentoDpPanel.tsx`
- Admin ASO config: `admin/AsoAgendamentoConfigTab.tsx`
- Grade da escala: `man-schedule-grid-classes.ts` (scroll + sticky) usado por `GTManScheduleTab` e `/department/man-schedule`
- Viewport das páginas GT-family: `GtPageShell.tsx` (`/department/gestao-tripulantes`, `/department/man-schedule`, `/department/dp`, `/department/e-social`)
- Modal do colaborador: `collaborator-modal-layout.ts` (viewport + tablist + table scrollports) usado por `CollaboratorModal` e todas as abas

## Local Contracts

- Cargo / Empresa / Embarcação / Centro de Custo: `SearchableCreatableSelect` (busca + Adicionar). Create via POST `/api/gestao-tripulantes/{cargos|empresas|embarcacoes|centros-custo}` (`createGtLookupOption`). Filtros da matriz/Man Schedule: busca sem create (valores de nome, não UUID).
- **Regime de trabalho** (`DadosPessoaisTab`): opções `sem_escala` / `administrativo` / `onshore` + NxN. Não defaultar 14x14. Sem rotação grava dias 0; a grade Man Schedule não inventa ON. Token vazio + `escala_* = 0` lê como `sem_escala` (`inferRegimeUi`).
- Cards da Matriz: só `ativo=true` e CC ativo; docs vencidos do card e das badges = **primário por grupo** (`documento-historico.ts`), não irmãos obsoletos. Coluna Documentos mostra título/tipo do vigente vencido. Filtro **Docs Vencidos** abre `DocsAlertasPanel`.
- Abas do modal (contrato): Dados Pessoais = cadastro RH (sem docs ASO/EPI); Ficha unificada = Employee Hub; Treinamentos = certificados/cursos; **ASO** = único lugar de exames ocupacionais/laudo (upload, S-2220, agendamento DP); Passaportes = viagem (não ocultar por cargo); Documentos = só `gt_documentos` agrupados; **QHSE / EPI** = ficha AN-HSE-005 + EPI + listas QHSE, **nunca ASO**; **Desligamento** = rescisão (`gt_desligamentos`) — botão no header para quem `pode_registrar`, histórico readonly se já desligado. Filtro `documentoPertenceAba` (`certificado`→treinamentos, `aso`/`laudo`→aso). Highlight `gt-doc-<id>`.
- Desligamento: `DesligamentoModal` (z-60 sobre o CollaboratorModal). POST fail-soft na folha; após sucesso atualiza `ativo=false` no estado local e chama `onUpdated?` (opcional — DP/GT não precisam mudar a page).
- **POB / Embarcados Agora**: só código de escala **exato `ON`** no dia civil de hoje (`embarque-status.ts`). `ON*`, `*`, STB, DBA, FI, OFF-C, TRE, FER, UTR, DHC não entram.
- **Pílula Status da Matriz / DP / ficha**: mesma célula de hoje. ON → Embarcado (verde); STB → StandBy (laranja); Folga/OFF/OFF-C/FI → Folga (azul); FER/AFAST → Afastado (vermelho). `GET /colaboradores` sobrescreve `status_embarque` com esse mapa (`escala_codigo_hoje`). Não usar só a coluna stale.
- Cards de KPI são botões: `?kpi=embarcados|disponiveis|docs_vencidos|colaboradores` filtra a lista (e Man Schedule para embarcados/STB). Clique de novo limpa.
- Man Schedule: checkbox `Visualizar por dia` (`gt-man-schedule-viewport-day`). Off = semana sáb–sex; on = um dia por coluna.
- Toolbar **Hoje / ‹ › coluna / mês de referência / pill POB** (`ManScheduleTimelineNav`) compartilhada por `GTManScheduleTab` e `/department/man-schedule`. **Mês de referência** (default = mês civil atual; `localStorage` `gt-man-schedule-reference-month`): a grade cobre o mês inteiro (1º–último dia + snap sábado), mesmo sem rotações — permite planejar o futuro. Setas do label (`‹ Setembro 2026 ›`) mudam o mês; distintas das setas que andam **uma coluna**. **Hoje** restaura o mês atual e rola até a coluna de hoje (viewport dia = aquele dia; semana = sáb–sex que contém hoje). Destaque amarelo só quando essa coluna existe na grade (sem nearest-fallback). A pill interpola `{count}` (`manSchedule.todayPob`) via `interpolateTranslationParams`. Contagem = `countPobOnCivilDay` no dia civil de **hoje**, **independente do mês de referência visível**. Colunas via `buildScheduleColumns` (`man-schedule-reference-month.ts`). `/department/man-schedule` amplia `?janela=` (`realtimeJanelaForReferenceMonth`) se o mês sair da janela 90d; aba GT permanece `janela=all`. O scroll usa `[data-man-schedule-col]` no scrollport existente — não alterar overflow/sticky só para os botões.
- **Scroll da grade (global)**: wrapper `overflow-x-scroll overflow-y-auto` + `min-h-0 min-w-0` (`[data-testid=man-schedule-scroll]`, `.man-schedule-scroll`). `min-w-0` é obrigatório em **toda** a cadeia flex (`<main>`, `GtPageShell`, wrapper da aba, root do tab, scrollport) — sem isso `min-width:auto` cresce até a tabela `w-max` e o `body overflow-x-hidden` corta a grade sem barra. Coluna **NOME** (e QTD/CARGO) `position: sticky; left: …` com fundo opaco; `thead` `sticky top-0`. Tabela `border-separate border-spacing-0` — `border-collapse` quebra sticky no Chrome. Mesmo modelo na aba GT e em `/department/man-schedule`. Classes em `man-schedule-grid-classes.ts`. Barra superior sincronizada (`MAN_SCHEDULE_TOP_SCROLL_CLASS` + `useManScheduleScrollSync`) mede `table.scrollWidth`. Hoje/setas rolam **esse** wrapper (uma coluna via `[data-man-schedule-col]`), sem pixel offset fixo. A **página** em volta usa `GtPageShell` (`flush` em `/department/man-schedule`); não alterar overflow/sticky da grade só para caber o viewport. Sem animação de width na grade.
- **Viewport das páginas GT-family**: `GtPageShell` — coluna flex `flex-1 min-h-0 min-w-0` que preenche o `<main>` do MainLayout (`h-dvh` + `flex flex-col` + `min-w-0`). Header/abas/filtros/toolbar `shrink-0`. Em desktop (`lg:`), grade/tabela `flex-1 min-h-0 min-w-0 overflow-auto` (`GT_PAGE_SCROLLPORT_CLASS`); em mobile/telas compactas (`< 1024px`), `GtPageShell` usa `overflow-y-auto lg:overflow-hidden` e as tabelas mantêm altura mínima (`min-h-[320px]` / `min-h-[360px]`), com swipe horizontal no scrollport da grade/tabela (`min-w-[760px]` Matriz, `min-w-[720px]` ASO logística, `min-w-[850px]` DP). Man Schedule usa `flush` (cancela o padding do `<main>`); o scrollport da grade continua `man-schedule-grid-classes.ts`.
- **CollaboratorModal viewport**: painel `h-[min(98dvh,calc(100dvh-0.75rem))]` em coluna flex (`collaborator-modal-layout.ts`). Overlay sem scroll. Header + tablist `shrink-0` (ficam visíveis). Body `[data-testid=collaborator-modal-body]` `flex-1 min-h-0 overflow-auto`. Tablist: nowrap com overflow-x e scroll suave (`no-scrollbar`), evitando que as abas quebrem em múltiplas linhas no celular. Botões de ação em modais usam posicionamento sticky no rodapé.
- Save de evento escreve linha em `allSchedules` (`rotation_start`/`end`). Novo lançamento prevalece sobre STB/ON antigo no mesmo período. `QTD. EMBARC` = pessoas no cargo (não é quantidade de embarques).
- Aba **Ficha unificada**: card **Usuário do portal** lê `portalUser` do hub (nome + e-mail + role). Sem match → "sem vínculo". Join em `src/lib/employee-hub/` (`tax_id` + e-mail, nunca coluna `cpf`).
- Aba **Documentos** do modal: `gt_documentos` locais agrupados por tipo (`documento-historico.ts` + `HistoricoColapsavel`, default fechado). Sem dump de “outros módulos”. Sem QHSE.
- Aba **QHSE / EPI** (`QhseTab`): só se o viewer `hasAccess('epi')` (mesmo módulo do `/epi`). Lista ficha AN-HSE-005, entregas EPI e listas de presença QHSE via catálogo (`onlyQhse`). **Nunca ASO/laudo** — exames ocupacionais ficam na aba ASO. `qhseRelated` é false para `tipo_documento` aso/laudo; `isQhseCatalogDocument` / `?qhse=1` excluem aso mesmo se a fonte marcar `category: 'qhse'`. Não altera Treinamentos/CBSP. Não ocultar Passaportes por cargo.
- Aba **ASO Logística** na página GT: fila `solicitado` para logística aprovar/reprovar com `useSignature` (sem segundo SignatureModal). API: ADMIN/MANAGER **ou** USER cujo setor é logística-like e tem `gestao-tripulantes`. Aprovação marca o ASO; reprovação exige motivo.
- **Fechamento de escalas / Envio DP**: admin `WorkflowFechamentoTab` busca **usuários do portal + colaboradores GT** com e-mail (`listarCandidatosAprovadores` + `SearchableCreatableSelect`). Digitar nome/e-mail filtra. Adicionar/remover e o **Salvar do topo** da página admin gravam `PUT /relatorio-mensal/config` (não o PUT geral). O PUT `/configuracoes` **não** pode sobrescrever `gt_fechamento_mensal_config`. Lista nominada = exatamente essas pessoas assinam, **independente do role**. Lista vazia = um ADMIN/MANAGER conclui. `ModalAprovacaoFechamento` **sempre** `await requestSignature()`. Ator do modal: `useSupabaseAuth` (`profile` + `user` → id, email, role, first_name, last_name). **Nunca** `useAuth` / `@/contexts/AuthContext` — `ClientProviders` só tem `SupabaseAuthProvider` (não ressuscitar `AuthProvider` legado).
- Aba **Treinamentos** / **Passaportes**: mesmo agrupamento. Primário = último certificado válido/permanente; irmãos = Histórico (Obsoleto) com download. Badges do resumo usam só o primário.
- **Matriz de Treinamentos (Admin & Ficha)**:
  - Admin: `src/components/gestao-tripulantes/admin/MatrizTreinamentoConfigTab.tsx` gerencia matrizes ativas, importação de planilhas XLSX oficiais do MIO e inclusão/remoção de requisitos de treinamentos por cargo e regime.
  - Ficha (`TreinamentosTab`): `MatrizConformidadeColaboradorCard.tsx` exibe conformidade percentual do cargo, detalhando cursos vigentes, a vencer, vencidos e faltantes não realizados (com botão direto para lançar).
- **Lista de Presença para Treinamentos Internos**:
  - `ModalListaPresencaTreinamento.tsx`: acessível no topo de `TreinamentosTab` (botão **Lista de Presença**). Permite registrar treinamentos internos, selecionar tripulantes em lote, gerar a lista no portal para assinaturas digitais/PDF e opcionalmente cadastrar a conclusão do curso diretamente no histórico de todos os participantes selecionados.
- **Scroll Sincronizado do Man Schedule**:
  - Estilos em `globals.css` (`.man-schedule-scroll`) com barra visível de 14px, thumb `#94a3b8` e `-webkit-overflow-scrolling: touch`.
  - Hook `useManScheduleScrollSync` (aba GT + `/department/man-schedule`): `ResizeObserver` na tabela **e** no scrollport; spacer da barra superior = `table.scrollWidth`.
  - Barra superior + barra inferior da grade: as duas andam juntas (`scrollLeft`). Desktop arrasta a barra; mobile faz swipe no scrollport.
- **Editar/Excluir itens do cadastro** (Treinamentos, ASO, Documentos, Passaportes): todas as quatro abas usam `useGtDocumentPermissions()` (`use-gt-document-permissions.ts`) para exibir/ocultar os botões `FiEdit2`/`FiTrash2`. `TreinamentosTab` permite edição e exclusão de itens vigentes e obsoletos (histórico); `ASOTab` bloqueia edição/exclusão apenas quando o ASO já foi enviado/processado no e-Social.
- **Filtro Data Início / Data Fim** (`GTManScheduleTab` e `/department/man-schedule`): `ScheduleDateFilterInput` commita só `YYYY-MM-DD` completo com ano 1990–2100 (ou vazio). Chrome `0002-01-01` / `0020-01-01` / `0202-01-01` ao digitar o ano **não** recalcula a grade. Cap: 400 colunas/dia, 2000 semanas (segurança). Matriz/vencimentos/dashboard não têm filtro de período.

## Work Guidance

- Não voltar `<select>` nativo nesses quatro campos de cadastro.
- Não gravar escala no MIO.
- Não ligar `onChange` de `type="date"` direto em `setFilterDate*` da grade.
- Não usar `border-collapse` na tabela da escala (quebra sticky de nomes/semanas).
- Não restaurar `overflow-x-auto` + `min-w-max` no tablist do CollaboratorModal (scrollbar nativo gigante no Windows). Overlay do modal sem `overflow-y-auto`.
- Não usar alturas mágicas (`calc(100vh-6.5rem)`) nas páginas GT-family — `GtPageShell` + flex `min-h-0` / `overflow-auto`.
- Não mudar overflow/sticky em `man-schedule-grid-classes.ts` só para o chrome da página.
- Não remover `min-w-0` da cadeia flex da grade (`<main>`, `GtPageShell`, wrapper da aba, root do tab, `[data-testid=man-schedule-scroll]`). Sem isso a tabela `w-max` estica o pane e o scroll horizontal some.
- Não trocar o scrollport da grade por `overflow-x-only` — linhas também transbordam; eixos X e Y juntos (`overflow-x-scroll overflow-y-auto`).

## Verification

- Editar Dados Pessoais: digitar cargo inexistente → Adicionar → POST 201 → campo fica com o novo id. Selecionar **Sem escala** → Salvar → reload ainda mostra Sem escala (não 14x14).
- Cards da Matriz < total de linhas se existirem inativos.
- KPI 1 vencido: card/filtro lista o documento; linha abre ficha; aba correta mostra o card (incl. certificado/CNH/laudo). ASO abre a aba ASO, não QHSE.
- Modal GT com módulo `epi`: aba **QHSE / EPI** lista ficha AN-HSE-005 e listas QHSE e **não** lista ASO/laudo.
- Clique em "Embarcados Agora" filtra a lista ao mesmo conjunto do card (ON hoje, sem *). Quem está na lista com ON hoje mostra pílula **Embarcado** (não Folga stale).
- Admin Fechamento: dropdown lista usuários ativos (USER incluso), não só ADMIN/MANAGER. USER na lista consegue assinar; ADMIN fora da lista toma 403. `npx tsx --test src/lib/gestao-tripulantes/fechamento-assinatura.test.ts`.
- GT aba ASO Logística lista solicitações do DP; aprovar com assinatura → status Marcado; reprovar mostra motivo no DP. USER do setor Logística com módulo GT passa no POST aprovar; USER de outro setor com o mesmo módulo toma 403.
- Man Schedule: checkbox liga colunas diárias; desliga volta semana. Badge `Hoje: NP a bordo` interpola `{count}` e usa a mesma regra POB (ON exato no dia civil de hoje), mesmo com mês de referência futuro. **Hoje** volta ao mês atual e à coluna de hoje; setas de coluna andam uma coluna; setas do mês mudam o mês de referência e geram colunas mesmo sem rotações. `npx tsx --test src/i18n/interpolate.test.ts src/lib/gestao-tripulantes/embarque-status.test.ts src/lib/gestao-tripulantes/man-schedule-nav.test.ts`.
- Man Schedule (aba GT **e** `/department/man-schedule`): `scrollWidth > clientWidth` no `[data-testid=man-schedule-scroll]`; barra inferior ~14px; barra superior move a grade; swipe horizontal no mobile sem esticar a sidebar. Nomes (`man-schedule-sticky-name`) permanecem visíveis; cabeçalho de semanas fica no topo. `node --test src/components/gestao-tripulantes/man-schedule-grid-classes.test.mjs`.
- Matriz GT / aba ASO Logística / `/department/man-schedule`: o documento não rola; filtros ficam visíveis; a lista/grade rola no pane restante (`[data-testid=gt-page-shell]`).
- CollaboratorModal: painel ~96dvh; header+abas visíveis; tablist sem barra nativa grossa (`[data-testid=collaborator-modal-tablist]`); cada aba rola a lista/formulário no espaço restante.
- Ficha unificada: card **Usuário do portal** (`[data-testid=ficha-portal-user]`) mostra nome + e-mail + role quando o hub resolve `users_unified` por `user_id` / `tax_id` / e-mail; sem match → "sem vínculo".
- Após Salvar ON, as células do período e a coluna ON atualizam sem recarregar a página.
- Digitar o ano em Data Início (`2`, `20`, `202`) não congela a UI; a grade só muda com data completa ou picker.
- Treinamentos: CBSP válido + CBSP vencido/declaração → uma linha primária, Histórico colapsado, resumo sem “1 vencido” falso.
- Card `total_docs_vencidos` da Matriz não sobe por declaração/certificado antigo se o primário do grupo está válido.
- USER sem a feature `gestao-tripulantes.documents.edit`/`.delete` não vê os botões de editar/excluir em Treinamentos/ASO/Documentos/Passaportes; ADMIN/MANAGER sempre veem (bypass em `hasFeature`). Ligar a feature em `/admin/users` (checkbox "Gestão de Tripulantes — Cadastro do Colaborador") faz o botão aparecer e o `PUT`/`DELETE` correspondente passar.
- ASO com e-Social `enviado`/`processado`: cartão mostra "Já enviado ao e-Social — não editável" em vez dos botões Editar/Excluir.
- CollaboratorModal: USER ADMIN/MANAGER (ou DP com módulo GT) vê **Desligar**; após confirmar, `ativo=false` no estado local e a aba Desligamento mostra o histórico. Já desligado não abre o wizard de novo.
- **Matriz de Treinamentos (Visibilidade por ACL e Setor)**:
  - Componente `MatrizTreinamentoConfigTab.tsx` suporta prop `readOnly` para usuários que possuem permissão de visualização sem edição.
  - No departamento (`/department/gestao-tripulantes`), a aba **Matriz de Treinamentos** e o botão no header usam o hook `useGtMatrizPermissions()`.
  - Só são visíveis quando o usuário possui acesso concedido via Setor (DP, RH, Treinamento, SMS/QHSE, Operações com módulo GT), Role (ADMIN/MANAGER), ACL (`gestao-tripulantes:matrizes.manage` ou `.view`) ou Feature JSONB (`gestao-tripulantes.matrizes.manage`). Usuários sem permissão não veem a aba nem o botão.

## Child DOX Index

- `src/lib/document-catalog/AGENTS.md` — catálogo global; aba QHSE / EPI do modal (módulo `epi`); QHSE nunca lista ASO
