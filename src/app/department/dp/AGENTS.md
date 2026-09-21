# Departamento Pessoal (DP) — DOX

## Purpose

UI de `/department/dp` para o DP operar cadastro de colaboradores, fechamento de escala/folha, vencimentos de ASO e atalho ao e-Social. Lê só `gt_*` via APIs de Gestão de Tripulantes.

## Ownership

- Page/layout: `src/app/department/dp/`
- APIs: `GET /api/gestao-tripulantes/colaboradores`, `GET|POST /api/gestao-tripulantes/aso/notificar-vencimentos`, `GET|POST /api/gestao-tripulantes/aso/agendamentos`, `GET|POST /api/gestao-tripulantes/aso/agendamentos/sugestoes`, `GET /api/gestao-tripulantes/relatorio-mensal`, `POST /api/gestao-tripulantes/relatorio-mensal/aprovar`, `POST /api/e-social/consolidar`
- Lib: `src/lib/gestao-tripulantes/aso-vencimentos.ts`, `aso-agendamento-*.ts`, `LIST_SELECT` em `colaborador-get.ts`

## Local Contracts

- Sempre wrap com `MainLayout` (`layout.tsx`) — o menu lateral vem daí, como GT / e-Social / Man Schedule.
- Lista de colaboradores usa campos achatados da API: `cargo_nome`, `empresa_nome`, `embarcacao_nome`, `centro_custo_nome`, `centro_custo_codigo`, `ativo`, `regime_trabalho`, `escala_embarque`, `escala_folga`, `status_embarque` (célula de hoje, não a coluna stale). Nunca `cargo.nome` / `empresa.nome` (o flatten remove os nested). Coluna Escala: `formatRegimeDisplay` — `sem_escala`/`administrativo`/`onshore` (não 14x14).
- Coluna Status: Ativo/Inativo **e** pílula de embarque viva (Embarcado/StandBy/Folga/Afastado) da mesma API.
- Aba ASO lê `GET /api/gestao-tripulantes/aso/notificar-vencimentos` (`tipo_documento=aso` + join colaborador) e `GET /aso/agendamentos`. Não usar o bucket genérico de `/auditoria`.
- Janela vencendo = antecedência admin (padrão 60 dias), não hardcoded 30.
- DP escolhe data sugerida (escala STB preferida) e assina (`useSignature`); cria `solicitado` para a logística. Status `marcado` / `reprovado` (com motivo) aparecem na mesma aba.
- Status VENCIDO/VENCENDO vem de `alerta` calculado por data civil local (`YYYY-MM-DD`), não de `new Date(iso)` UTC.
- Fechamento: preview de totais via `relatorio-mensal` (ON, DBA, FI, Folga, STB, TRE/FER, alertas NxN + `calculosFolha`); aprovação em `ModalAprovacaoFechamento` com `useSignature().requestSignature` (modal global) e ator via `useSupabaseAuth` (não `AuthContext` legado). Lista nominada = exatamente essas pessoas, qualquer role; sem nomes, um ADMIN/MANAGER assina e conclui. Números vêm de `fechamento-calculo.ts` (dt início/dt fim, sem inventar janela).
- Header: pills compactas (não grid de KPI). Colaboradores = `filteredColabs.length` visíveis + ativos na folha + carregados na consulta (não o total bruto como se fosse a tabela). ASO = vencidos + janela de antecedência. Sem cards decorativos “Escalas & Fechamento” / “e-Social Integrado”.
- Lista: `GET /colaboradores?limit=5000`; se `pagination.total` > linhas carregadas, pill “Lista incompleta” + `console.warn`. Filtros Empresa/Embarcação/Cargo (`SearchableCreatableSelect`): Enter com texto seleciona o primeiro resultado real, não “Todas…”. Enter com campo vazio continua limpando o filtro. Busca por CPF ignora pontuação-só (não casa todos os CPFs).

## Work Guidance

- Novos campos da tabela DP devem existir em `LIST_SELECT` + flatten.
- Clique na linha de ASO **ou** na lista de colaboradores abre o `CollaboratorModal` do colaborador.
- **Cadastro do zero**: botão **Novo colaborador** no header → `/department/dp/novo` (`ColaboradorCadastroForm` + `POST /colaboradores`). Mesma tabela `gt_colaboradores`. GT reusa o form em `/department/gestao-tripulantes/novo`.
- **Editar qualquer dado**: linha/Editar abre o modal; aba Dados Pessoais → Editar monta o form completo (pessoais, docs, banco, vínculo, e-Social) via `PUT /colaboradores/[id]`.
- **Desligamento**: não há ação na lista. Abrir o modal → botão/aba **Desligamento** (`DesligamentoModal`). API `GET|POST /colaboradores/[id]/desligamento`. Colaborador já inativo com `gt_desligamentos` mostra histórico (não desliga de novo).
- Viewport: `GtPageShell` preenche o `<main>` do MainLayout (`flex-1 min-h-0 min-w-0`). Header (título + pills de métricas), abas e filtros `shrink-0`; lista de colaboradores e painel ASO `flex-1 min-h-0 min-w-0 overflow-auto` (`GT_PAGE_SCROLLPORT_CLASS`). Tabela da lista `min-w-[850px]`; ASO `min-w-[860px]` — scroll horizontal no pane, não na página. Sem faixa de KPI cards em todas as abas. Sem scroll duplo da página.

## Verification

- `/department/dp` mostra sidebar do portal (não tela full-bleed). Sem grid de 4 KPI cards no topo; pills no header (visíveis = linhas da tabela).
- Lista DP: filtros visíveis; a tabela rola no pane restante (documento não vira o scroll principal). Em viewport estreita, a lista/ASO rola no eixo X dentro do pane (`min-w-[850px]` / `min-w-[860px]`).
- Colunas Cargo, Centro de Custo, Empresa e Escala preenchidas quando o cadastro tem FK.
- Coluna Status mostra Ativo/Inativo **e** a pílula de embarque da célula de hoje (ON → Embarcado).
- Aba ASO lista nome/CPF/cargo (não `N/A` em massa); validade em `dd/mm/aaaa`; vencido só se a data local já passou; permite Agendar → logística; marcado após aprovação.
- Aba Fechamento mostra totais ON/DBA/FI/Folga/STB/TRE/FER e alertas NxN do mês selecionado. Assinar abre o SignatureModal global; cancelar não quebra; sem assinatura cadastrada o cadastro no próprio modal precede o POST.
- Clique na linha do colaborador → `CollaboratorModal` → Desligar / aba Desligamento. A lista DP não tem botão próprio de rescisão.
- Header DP tem **Novo colaborador** → `/department/dp/novo`. Salvar volta para `/department/dp`. Editar no modal cobre banco/PIS/CTPS/salário/contrato, não só identidade.

## Aba Rubricas & Folha (2026-09, plano dp-rubricas-wkradar)

- Quarta aba da página (`'colaboradores' | 'fechamento' | 'asos' | 'folha'`); painel `src/components/dp/DpFolhaPanel.tsx`. Visibilidade/ações por features do módulo ACL **folha** (`folha.view|edit|approve|admin` em `src/config/modules.ts`; gate server `src/lib/payroll/payroll-auth.ts` — 3 camadas: ADMIN → ACL → setor DP-like).
- Fluxo do painel: competência + empresa/departamento → **Sincronizar WK** (`POST /api/dp/wk/sync` fonte `'api'` ou multipart `'arquivo'`; roda WK **e** consolidação dos módulos internos) → **Calcular folha** (`PUT /api/payroll/calculate { sheetId }`) → preview por colaborador (badge origem `manual|wk|gt`) → **Enviar para aprovação** (`AprovacaoFolhaModal`, rotas `/api/payroll/sheets/[id]/aprovacao` GET/POST/DELETE) → `status='approved'` ao 100% das assinaturas. Rejeição → `aprovacao.rejeicao` em `payroll_sheets.aprovacao` JSONB, sheet permanece `'calculated'`.
- Estado de sync: `GET /api/dp/wk/status` (último evento `wk_sync` de `payroll_audit_log` + contagens `origem='wk'`). Colaboradores WK: `GET /api/dp/wk/colaboradores` (paginada, SELECT em `payroll_employees`). Credenciais Radar.API: `GET|PUT /api/dp/wk/credentials` (admin; via app_secrets `wkradar_api_url`/`wkradar_api_token`).
- Férias/escala → folha: `src/lib/payroll/fontes-dp.ts` (`sincronizarModulosInternos`; rota dedicada `POST /api/dp/wk/modulos-internos`). Fonte de férias segue sendo `gt_afastamentos` (via `leaveService`); folha lê na consolidação, não duplica estado. Precedência WK > GT auditada.
- Mapeamento WK ↔ portal: `payroll_codes.codigo_wk` (unique parcial). Sync aborta 422 com lista de códigos não mapeados; correção na UI **Folha de Pagamento → Configurações → Rubricas** (CRUD completo: `GET|POST /api/payroll/codes`, `PUT|DELETE /api/payroll/codes/[id]` — DELETE é soft `is_active=false`). Nunca auto-criar rubrica.
- Motor: `src/lib/payroll/calculations.ts` (IRRF min(legal, simplificada 607,20); `FORMULAS_FOLHA` `'dsr'|'reflexo'|'reflexo_he'`; perfis `PerfilCalculo` derivados de `payroll_calculation_profiles.rules`; tributos POR natureza `mensal|ferias|decimo|rescisao`) + `src/lib/payroll/rescisao.ts` (`calcularRescisao`; códigos do seed 301–307). Aprovação: `src/lib/payroll/aprovacao.ts` clona `fechamento-assinatura.ts` (interfaces importadas, hash SHA-256); aprovadores em `settings` key `payroll_aprovadores_config` (`GET|PUT /api/payroll/aprovadores`).

## Child DOX Index

_(none)_
