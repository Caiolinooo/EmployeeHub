# Gestão de Tripulantes API — DOX

## Purpose

API routes for crew management (colaboradores, documentos, ASO, embarques, tipos de escala, PoliWeb, cron). Owns contracts for ASO identity, e-Social visibility, and Man Schedule local event types/colors.

## Ownership

- Routes under `src/app/api/gestao-tripulantes/`
- Related libs: `src/lib/gestao-tripulantes/*`, OCR in `src/lib/ocr/*` + `src/lib/gestao-tripulantes/ocr-processor.ts`
- Canonical contract: `src/lib/gestao-tripulantes/gt-canonical.ts`
- Man Schedule realtime: `src/app/api/man-schedule/realtime/route.ts` (reads **gt_historico_embarques + gt_colaboradores + gt_tipos_evento_escala** — never live MIO, never mio_cache blobs on the request path)
- UI consumers: `AsoReviewPanel`, `ASOTab`, `ImportarASOModal`, Collaborator modal, `GTManScheduleTab`, admin `/admin/gestao-tripulantes`

## Local Contracts

### Canonical read contract (future modules)

- Feature modules read **only** `gt_*` via `src/lib/gestao-tripulantes/gt-canonical.ts`. Never import `mioClient` or `poliweb-scraper` on page-load paths.
- Join by `colaborador_id` or CPF digits (`normalizeCpf`). Origem values: `mio | poliweb | upload | manual | ocr | local | importado`.
- ASO: query `gt_documentos_aso` (parent `gt_documentos.origem`). PoliWeb scrape is ingest only (`POST /poliweb` / cron).
- Man Schedule: `gt_historico_embarques` + `gt_colaboradores` + `gt_tipos_evento_escala`. Do not read `mio_cache` blobs on the request path.
- Missing file bytes: `gt_documentos.arquivo_ausente` + retry queue `gt_mio_anexo_misses`.
- Leftover MIO entities (férias, benefício, dependente, sispat, timesheet, turmas): `gt_mio_entidades`.

### Poliweb ASO pendentes (fail-soft)

- `GET /api/gestao-tripulantes/poliweb/asos-pendentes` lists `gt_documentos` with `origem=poliweb` + `status_revisao=pendente_revisao`. Does **not** scrape on page load.
- `?sync=1` (refresh) may scrape Poliweb with **2.5s abort**; config/timeout/upstream failure → **HTTP 200** `{ ok:false, data:[], warning }` (never 503). Overlay is caused by `fetchWithToken` `console.error` on non-OK.
- UI: `AsoReviewPanel` must not throw/`console.error` on this degradation.
- Live scrape for import remains `POST /poliweb` (`buscar_pendentes`) and cron `poliweb-scraper`.

### ASO identity gate & Motor de OCR com Módulo 11 e Auto-Reparo

- CPF normalize: digits-only via `@/lib/utils/identity` → `@/lib/gestao-tripulantes/cpf` (client-safe) + `cpf-lookup.ts` (server).
- **Validação Matemática por Módulo 11 (Receita Federal)**:
  - Todo CPF e CNPJ extraído pelo OCR é validado matematicamente pelo algoritmo oficial de 2 dígitos verificadores (`D1` e `D2`).
  - CPFs inválidos passam por auto-reparo guiado pela matriz de confusão óptica (`CONFUSAO_OPTICA`, `8`↔`9`, `3`↔`8`, `0`↔`O`, `1`↔`I/l/7`, `B`↔`8`, etc.) e reconciliação contextual com o CPF do perfil do colaborador (distância de edição $\le 2$).
- **Detecção de Resultado Apto vs Inapto**:
  - Reconhece caixas de seleção preenchidas `(X) APTO`, `[X] APTO`, `(✓) APTO`, `(•) APTO` evitando falsos positivos de `inapto` gerados por templates pré-impressos `( ) APTO ( ) INAPTO`.
- **Sanitização de Datas e Documentos**:
  - Correção automática de séculos históricos de OCR (`18xx` $\rightarrow$ `19xx` para trabalhadores ativos).
  - Isolamento estrito de RG sem sobreposição de substrings com o CPF.
  - Datas de ASO/exame: `normalizeEsocialDate` / `alinharDataExamePtBr` (`src/lib/e-social/esocial-date.ts`) — sempre DD/MM (PT-BR), inclusive quando o laudo mistura MM/DD inglês. Nome do médico ASO passa por `sanitizeTsNome` (`src/lib/e-social/ts-nome.ts`) antes de gravar `gt_documentos_aso` e de montar S-2220 — sem cargo/quebra de linha no `nmMed`.
- OCR path (`extrairDadosASODoTexto`): **CPF-only** reassociation. Never silent name/`ilike` moves.
- If OCR CPF ≠ profile CPF: reassign to `gt_colaboradores` by CPF **or** quarantine (`gt_documentos.colaborador_id` + ASO `colaborador_id` = null, `esocial_status = quarentena`, `identity_match = quarantine`). When OCR cannot extract CPF, quarantine is set immediately to avoid wrong profile assignment.
- After `esocial_status` in `pendente|enviado|processado`: freeze identity (`identity_match = frozen`); do not reset status to `nao_enviado`.
- Persist `cpf_documento` + `identity_match` on `gt_documentos_aso`.
- Send (`POST .../documentos/[id]/esocial`): prefer OCR CPF; **block** if OCR CPF ≠ profile CPF.

### All e-Social Events ↔ Module Sync
- Generic sync service `esocial-sync.ts` mirrors e-Social event status changes back to originating entities:
  - **S-2200**: `gt_colaboradores.esocial_admissao_status`
  - **S-2205**: `gt_colaboradores.esocial_cadastro_status`
  - **S-2206**: `gt_colaboradores.esocial_contrato_status`
  - **S-2220**: `gt_documentos_aso.esocial_status`
  - **S-2230**: `gt_afastamentos.esocial_status`
  - **S-2210**: `gt_acidentes.esocial_status`
  - **S-2240**: `gt_colaboradores.esocial_risco_status`
  - **S-2299**: `gt_colaboradores.esocial_desligamento_status`

### Desligamento / rescisão (`gt_desligamentos`)

- Processo auditável além de `gt_colaboradores.data_demissao` / `motivo_demissao`.
- Tabela `gt_desligamentos` (migration `20260902_000001`): RLS ligado, **sem** policy anon (`service_role`). Um registro aberto por colaborador (`status <> cancelado`).
- `payroll_sheet_id` é referência **solta** (sem FK) — `payroll_*` vive em `scripts/create-payroll-tables.sql`.
- APIs: `GET|POST /api/gestao-tripulantes/colaboradores/[id]/desligamento`.
- Auth POST: ADMIN/MANAGER/SUPERADMIN **ou** setor DP/RH-like (`setorEhDp`) **e** módulo `gestao-tripulantes` (`podeRegistrarDesligamento`). Sem e-mail hardcoded. GET autenticado devolve o registro + `pode_registrar`.
- Body: `tipo_rescisao` (`sem_justa_causa|pedido_demissao|justa_causa|acordo_mutuo|termino_contrato|rescisao_indireta`), `data_desligamento`, `motivo`, `aviso_previo_tipo`, `aviso_previo_dias`, `data_ultimo_dia_trabalhado`, `observacoes`, `mtv_deslig` opcional.
- `tipo_rescisao` → e-Social Tabela 19 (`mtvDeslig`): `02` sem justa causa / indireta, `07` pedido, `01` justa causa, `25` acordo 484-A, `06` término. Gravado em `gt_desligamentos.mtv_deslig` **e** em `gt_colaboradores.motivo_demissao` para o hook existente `autoGenerateESocialEvents` (S-2299).
- Ordem: inativa colaborador (`ativo=false`, `data_demissao`) → insert `gt_desligamentos` (`iniciado`) → folha **fail-soft** → dispara `autoGenerateESocialEvents`. Folha/e-Social nunca derrubam o GT.
- Folha: localiza/cria `payroll_employees` pelo CPF; reusa `payroll_sheets` do mês (ou cria draft); lança `payroll_sheet_items` com valor 0 (DP calcula). Rubricas 301/302 (seed) + 303–307 (`scripts/seed-payroll-data.sql` e migration `20260902_000002`, skip se `payroll_codes` não existir).
- Prazo de pagamento: 10 dias corridos (Lei 13.467/2017) em `prazo_pagamento`. Aviso sugerido: 30 + 3/ano, máx. 90.
- UI: aba/botão no `CollaboratorModal` + `DesligamentoModal`. Lista DP abre o modal na linha; **não** tem botão próprio de rescisão. Cadastro do zero / edição de ficha **pode** alterar `dp/page.tsx` e `/department/dp/novo`.

### Cadastro de colaborador (`gt_colaboradores`)

- Fonte única: tabela `gt_colaboradores` via `POST|PUT|DELETE /api/gestao-tripulantes/colaboradores`. Sem store paralelo no DP.
- Payload compartilhado: `montarPayloadCadastro` / `validarCadastroMinimo` (`colaborador-cadastro.ts`). Whitelist de colunas editáveis; ignora PK/sistema/`mio_*`/`esocial_*`/`deleted_at`.
- Auth mutação: `podeMutarCadastroColaborador` = mesmo gate do desligamento (ADMIN/MANAGER/SUPERADMIN **ou** setor DP/RH + módulo GT). GET autenticado continua aberto a quem já lê a lista.
- Create: CPF Módulo 11 (`isValidCpf` + `normalizeCpf`); 409 se CPF já existe; `origem=manual`; `matricula_esocial` vazio copia `matricula`. Enrich `mio_cache` só em background (nunca live MIO).
- Update: parcial; CPF/nome só validados se enviados; FKs por `cargo_nome`/`empresa_nome`/etc. se o id não vier; `persistirCamposEscala` (não inventa 14x14).
- Soft-delete (`deleted_at`) usa o mesmo gate.

### Employee Record Hub (`/api/employee-hub`)
- Single point of truth for employee data, combining personal details, document counts, ASOs, embarques, e-Social event timeline, afastamentos, acidentes (CAT), and trainings.
- Portal user join: `user_id` → `users_unified.tax_id` digits = colaborador CPF → email lowercase exact. Never select `cpf` / `full_name` on `users_unified`. Contract: `src/lib/employee-hub/AGENTS.md`.
- Endpoints: `GET /api/employee-hub/[id]`, `GET /api/employee-hub/[id]/timeline`, `GET /api/employee-hub/search`.

### Global ASO read

- `GET /api/gestao-tripulantes/aso?cpf=` → only `enviado|processado`.
- `algoritmo-back` prefers those ASOs for validity scoring; falls back to any dated `gt_documentos` per candidate without a global ASO.
- **ASO vencimentos (DP)**: `GET /api/gestao-tripulantes/aso/notificar-vencimentos` lists `tipo_documento=aso` with join colaborador (flattened `cargo_nome` / `embarcacao_nome`). `POST` dispara e-mail/in-app. Classificação vencido/vencendo em `src/lib/gestao-tripulantes/aso-vencimentos.ts` por data civil local (`YYYY-MM-DD`), janela = `gt_aso_agendamento_config.antecedencia_dias` (padrão **60**, admin). Cron `/cron/notificar-vencimentos` usa o mesmo helper. Não usar `/auditoria` como fonte da aba DP.

### Agendamento de ASO (DP → logística)

- Config: `GET|PUT /api/gestao-tripulantes/aso/agendamento/config` + aba admin **Agendamento ASO**. Persistido em `gt_configuracoes.chave = gt_aso_agendamento_config` (`antecedencia_dias` default 60, `min_lead_dias`, `max_sugestoes`, `emails_logistica`, `emails_cc`, `gerar_sugestoes_automatico`). Sync com `notif_aso_dias_aviso`.
- Tabelas: `gt_aso_agendamentos` + `gt_aso_agendamentos_log`. RLS ligado, **sem** policy anon (`service_role` / `supabaseAdmin`). Status: `sugerido|solicitado|aprovado|reprovado|cancelado|marcado`. Aprovação da logística grava `marcado`.
- Heurística (`aso-agendamento-sugestoes.ts`): lê `gt_historico_embarques` + `embarque-status.ts` (nunca MIO). Prefere STB (e meio de bloco STB ≥5d); folga/sem marcação; FI/OFF-C/TRE; **bloqueia** ON exato, ON*, DBA, FER/AFAST. Lead mínimo evita os próximos N dias. Cron `GET|POST /cron/aso-agendamentos` (Vercel 10:00).
- APIs: `GET|POST /aso/agendamentos` (lista / DP solicita com assinatura), `GET|POST /aso/agendamentos/sugestoes`, `GET /aso/agendamentos/[id]`, `POST .../aprovar`, `POST .../reprovar` (motivo obrigatório), `POST .../cancelar`.
- **ASO logística auth**: regras puras em `aso-agendamento-logistica.ts`; `podeAprovarAsoLogistica` em `aso-agendamento-auth.ts`. `isLogisticaRole` permanece ADMIN/MANAGER/SUPERADMIN. Libera se (a) `isLogisticaRole` **ou** (b) setor do usuário tem nome logística-like (`ilike` sem acento) **e** `sectors.allowed_modules` inclui `gestao-tripulantes`. Módulo sozinho não basta (QHSE/TI/Treinamento). Sem e-mails hardcoded. Aplica a aprovar, reprovar e cancelar (não-owner). 403 com `mensagemErroAsoLogisticaNegada`. Config admin e cron continuam só `isLogisticaRole`.
- `loadAtorFromUserId`: `users_unified` com `first_name`/`last_name`/`name`/`tax_id` + `displayNameFromUser` (nunca `full_name`/`cpf`). Campo `cpf` do ator = `tax_id`.
- Carimbo: SHA-256 `GT_ASO_AGENDAMENTO:id:data:nome:cpf:iso:ip:acao` (mesmo padrão `GT_FECHAMENTO`). UI usa `useSignature().requestSignature` (não montar segundo SignatureModal).
- Notifica logística por e-mail (`sendEmail`) **e** `notifications` in-app. Reprovação visível no DP (`motivo_reprovacao`).
- UI: DP `/department/dp` aba ASO (`AsoAgendamentoDpPanel`); GT `/department/gestao-tripulantes` aba **ASO Logística** (`AsoAgendamentoInbox`, `?tab=aso-logistica`).

### Dashboard KPIs (`GET /dashboard`)

- Cards da Matriz de Conformidade contam **somente colaboradores ativos** em centros de custo ativos.
- Elegível: `gt_colaboradores.ativo = true` AND `deleted_at IS NULL`. Se `centro_custo_id` está preenchido, exclui quando `gt_centros_custo.ativo = false`. `centro_custo_id` nulo **entra**.
- `total_colaboradores`: conjunto elegível.
- `total_embarcados`: elegível AND célula de **hoje** em `gt_historico_embarques` (e afastamentos) é código **exato `ON`**. Nunca `ON*` / `*` / STB / DBA / UTR / DHC. Fonte: `embarque-status.ts` + `listarIdsEmbarcadosHoje`. Não usar `status_embarque` para este card.
- `total_disponiveis`: elegível AND `standby = true`.
- `total_docs_vencidos` / `total_docs_vencendo`: **somente o registro primário** de cada grupo (`documento-historico.ts` / `somarDocsPorStatusPrimario`). Classificação civil local `YYYY-MM-DD` no primário: vencido = `data_validade < hoje`; vencendo = `hoje ≤ data_validade ≤ hoje+30`. Declaração/certificado antigo do mesmo curso **não** entra se existir um primário válido. Sem validade (permanente) não entra nesses totais. Linhas obsoletas permanecem no banco. Cópias históricas vencidas aparecem em `GET /documentos/alertas` e na ficha (`total_docs_vencidos_historico`).
- Painel: clique no card / filtro **Docs Vencidos** abre a lista com título, tipo, validade e aba. Clique na linha do colaborador com vencidos abre a aba **Ficha unificada**. Tool IA `buscar_documentos_vencidos`. Cards de KPI também aceitam `?kpi=embarcados|disponiveis|docs_vencidos|colaboradores`.
- `asos_pendentes_revisao`: fila operacional (`status_revisao = pendente_revisao`), sem filtro de ativo.
- Implementação: `src/lib/gestao-tripulantes/dashboard-service.ts`. Badges da lista (`qtd_docs_*`) usam a mesma regra de data **e o mesmo agrupamento primário**.

### GET colaborador performance

- `GET /colaboradores/[id]` reads `gt_colaboradores` (not `gt_vw_colaboradores_completo`), excludes `mio_data`/`ocr_texto`/`xml_gerado`, two parallel DB waves. Optional `?include=` (default `profile,documentos,embarques,substituicoes,esocial_asos`).
- `GET /colaboradores` list overlays `status_embarque` / `standby` / `escala_codigo_hoje` from today's scale cell (`overlayStatusEscalaHoje`). `?status=` and `?standby=` / `kpi=disponiveis` filter that live map (not the stale column). `?kpi=embarcados` filtra pelos mesmos IDs de `listarIdsEmbarcadosHoje` (não `status_embarque`).
- `LIST_SELECT` includes `ativo`, `regime_trabalho`, `escala_embarque`, `escala_folga` and `centro_custo(nome, codigo)`. Flatten returns `cargo_nome` / `empresa_nome` / `embarcacao_nome` / `centro_custo_*` — consumers must not expect nested `cargo.nome`.
- Client modal dedupes in-flight GETs (React Strict Mode + `_t` cache-bust). Man Schedule tab is lazy-mounted; `/api/man-schedule/realtime?janela=90d` is cached 60s on the client.

### Man Schedule — tipos / cores / observações

- Table `gt_tipos_evento_escala`: `codigo`, `display_code`, `label`, `bg_color`, `text_color`, `ordem`, `ativo`, `is_system`, `maps_to_db_tipo`.
- Seed system codes: `normal`→ON, `previsto`→ON* (não POB), `fi`→FI, `dba`→DBA, `stb`→STB, `offc`→OFF-C.
- CRUD: `GET|POST /api/gestao-tripulantes/tipos-evento`, `PUT|DELETE /api/gestao-tripulantes/tipos-evento/[id]` (ADMIN/MANAGER for writes).
- Embarques locais: `POST /embarques`, `PUT|DELETE /embarques/[id]` — soft-delete via `deleted_at`; PUT updates `origem='local'` so manual adjustments are preserved against MIO sync pulls without ever calling or writing back to MIO.
- **POST idempotente (2026-09-11)**: antes de inserir, procura linha não-deletada do mesmo `colaborador_id` com `data_embarque` + `data_desembarque` exatamente iguais. Se existir: atualiza essa linha (tipo/locais/observações → `origem='local'`), colapsa duplicatas extras **locais** (soft-delete, mantém a mais recente; linhas MIO não são tombadas) e retorna `merged: true`. Retentativa do mesmo save nunca empilha linhas idênticas (bug antigo inflamava o fechamento NxN). Dedup de legado: `node scripts/dedupe-embarques-locais.js [--apply]`.
- **Correções 2026-09-11 (classe "marcação invisível")**: `pickEventForCivilDay` (POB/status) em camadas — FER/AFAST dominam, depois início no dia, `origem='local'`, tipo específico, id. Célula FER/AFAST da grade não abre edição de embarque (PUT/DELETE `/embarques/<id de gt_afastamentos>` dava 404) — gerenciado no módulo Férias/DP. POST/PUT `/embarques` rejeita `data_desembarque < data_embarque` (400). PUT sem mudança real de campo **não** vira `origem='local'` (linha MIO continua sincronizável). Assinatura de cache do realtime inclui probe de `gt_afastamentos`. `/department/man-schedule` reusa `pickOverlappingRotation` (badge `d.X` compara display code, não tipo cru). Fechamento: afastamento aberto (sem data fim) usa janela 90d; ciclos idênticos colapsados antes do loop NxN (FI fantasma); mês de referência default em BRT (modal, rota e cron). `cron/relatorio-mensal` exige `CRON_SECRET` (branch vazio → 401).
- Storage mapping (`escala-tipos.ts`): UI `offc` persists as `offc` (**never** collapse to `folga_indenizada` / `fi`). Legacy `folga_indenizada|dobra|standby` normalize on read to `fi|dba|stb`.
- `GET /api/man-schedule/realtime`: merge **gt_historico_embarques** (origem mio + local) with colaboradores; extras FI/DBA/STB/OFF-C are materialized at pull time. Return explicit `observacoes` + `tipo_codigo` / `rotation_type`; CPF joins via digits-only normalize.
- Cache in-memory: assinatura inclui `count` + último `updated_at` **e** último `created_at` (insert local sem `updated_at` não pode reusar payload velho). POST/PUT/DELETE embarques chama `invalidateManScheduleCache()` e grava `updated_at`.
- Grade: `allSchedules` é lista plana (`rotation_start`/`rotation_end`). Save otimista **insere/atualiza uma linha**, nunca `row.rotations`. Coluna ON/DBA/FI/TRE conta colunas visíveis; evento novo ganha de STB sobreposto (`pickOverlappingRotation`: início na coluna, depois data de início mais recente, tipo específico, **`origem='local'` vence empate de data idêntica — lançamento manual nunca é sombreado pela linha MIO que sobrepõe**, depois id). `/department/man-schedule` reusa o mesmo `pickOverlappingRotation` (sem cópia local do score).
- **Viewport dia/semana**: checkbox `Visualizar por dia` em `GTManScheduleTab` (`localStorage` `gt-man-schedule-viewport-day`). Desligado = colunas sábado–sexta (atual). Ligado = um dia por coluna. Clique na célula passa a `Date` da coluna. Semanas continuam começando sábado. Toolbar em `ManScheduleTimelineNav` (também em `/department/man-schedule`): **mês de referência** cobre o mês inteiro mesmo sem rotações (`buildScheduleColumns`); setas de coluna = uma coluna; setas de mês mudam o mês; **Hoje** restaura o mês atual e a coluna de hoje; pill = `countPobOnCivilDay` (ON exato no dia civil de **hoje**, independente do mês visível). Destaque amarelo só se a coluna de hoje existir na grade.
- **Scroll da grade**: UI em `src/components/gestao-tripulantes/AGENTS.md` — overflow no wrapper (`min-w-0` + `overflow-x-scroll overflow-y-auto`), sticky na coluna NOME, `border-separate`. Aplica à aba GT e a `/department/man-schedule`.
- **Filtro de data da escala**: UI só aplica `YYYY-MM-DD` completo (ano 1990–2100) via `parseCompleteFilterDate` / `ScheduleDateFilterInput`. Valores parciais do Chrome ao digitar o ano não expandem a timeline. Viewport dia recorta em 400 colunas; semana tem teto de segurança 2000.

### Schema notes

- Migration `20260723_000001_aso_identity_gate.sql`: `cpf_documento`, `identity_match`, expanded `esocial_status` CHECK.
- Migration `20260723_000002_gt_tipos_evento_escala.sql`: tipos table + relax `gt_historico_embarques.tipo` CHECK (allows `fi|dba|stb|offc` + custom).
- Optional SQL backfill of `gt_colaboradores.cpf` to digits-only (documented in root `tasks.md`); app lookups try digits + masked forms.
- `gt_afastamentos` + `gt_acidentes` applied remotely (repo files `20260724_000003` / `000004` were missing on Painel_ABZGroup). Pull writes afastamentos with `origem=mio`.
- **RLS (2026-09-01):** `gt_afastamentos`, `gt_acidentes`, `gt_relatorios_aprovacoes`, `gt_aso_agendamentos`, `gt_aso_agendamentos_log` have RLS enabled and **no** anon/authenticated policies (same as `gt_cargos` / `gt_historico_embarques`). REST with the publishable/anon key returns zero rows. Runtime reads/writes only via `supabaseAdmin` (`service_role`). Migrations `20260901_000001_gt_sensitive_tables_enable_rls.sql` and `20260901_000002_gt_aso_agendamentos.sql`. Do not add `USING (true)` policies to silence `rls_enabled_no_policy`.
- Canonical extras: `gt_documentos.arquivo_ausente*`, `gt_mio_anexo_misses`, `gt_mio_entidades`, `gt_colaboradores.ativo`, `gt_historico_embarques.updated_at`.
- Migration `20260902_000001_gt_desligamentos.sql`: processo de rescisão. `20260902_000002_payroll_codes_rescisao.sql` insere 303–307 só se `payroll_codes` existir.

### Document integrity gate (ALL document types)

- Migration `20260825_000001_gt_documento_integrity.sql`: `gt_documentos.numero_rastreio` (unique, partial index), `arquivo_hash` (sha256), `identity_match` (doc-level mirror of ASO gate) + deterministic backfill of tracking numbers.
- **numero_rastreio = NÚMERO PRÓPRIO DO DOCUMENTO**: the number printed on the file itself — nº do ASO impresso no laudo, nº do passaporte, nº do certificado/treinamento. NEVER an invented internal code when the document has its own numbering.
  - OCR path: `ocr-processor.ts::extrairNumeroDocumentoDoTexto(texto, tipo)` extracts it (ASO nº / "Nº do exame|laudo", Passport No / "Nº do passaporte", Certificado/NR nº; CRM/RQE/CNPJ/CPF are never the doc number); `persistirNumeroProprioRastreio` saves it — overwrites ONLY a `GT-...` fallback or null, never an intrinsic/manual value, and checks uniqueness first. Wired into both `extrairDadosASODoTexto` (ASO) and `aplicarGateIdentidadeDocumento` (all types).
  - Fallback interno (`documento-integrity.ts::garantirNumeroRastreioUnico`, format `GT-<TIPO>-<cpf4>-<YYYY>-<suffix>`) is acceptable ONLY for documents that genuinely have no intrinsic numbering (e.g. metadata-only MIO rows).
  - Manual fix: auditoria POST action `corrigir_rastreio` (ADMIN-only; `{documento_id, numero_rastreio}`, uniqueness-checked) + inline "Editar rastreio" in `AuditoriaDocumentosTab`; fallback values render flagged as "(fallback)".
- **Hard validation on save**: file **upload** may omit `data_emissao`/`data_validade` (status `pendente`; OCR or manual edit fills later). PUT still rejects validade < emissão. ASO upload also allowed without dates so OCR can populate them. Quarantine remains exempt.
- **Anti-duplication & Historical ASO Integrity** (`buscarDuplicado`): before insert, match by `arquivo_hash` → `arquivo_path` → for ASO: `(colaborador_id, 'aso', data_emissao/data_realizacao, data_validade)` → `(colaborador, tipo, titulo, numero_documento)` **only when the number matches** (or both are empty drafts without a file). Never collapse a new file onto the first same-title row.
  - Duplicate ⇒ UPDATE existing row (returns `merged: true`), never a new row.
  - **Preservação de Histórico de ASOs**: exames ocupacionais legítimos de datas distintas (ex: Admissional 2023, Periódico 2024, Periódico 2026) são preservados integralmente em ordem cronológica decrescente. Apenas cópias redundantes do mesmo laudo/exame são colapsadas no registro mais autoritativo (com recibo e-Social > com OCR > mais recente).
- **Identity gate for all types** (`aplicarGateIdentidadeDocumento` in `ocr-processor.ts`, wired into `/documentos/[id]/ocr`): OCR CPF of ANY document type (passaporte, CNH, treinamento…) must match profile CPF when a CPF is extracted; mismatch with no owning colaborador ⇒ quarantine. **No extractable CPF on non-ASO** (passaporte, visto, certificado) ⇒ `identity_match='unknown'`, stay on the current colaborador (user can edit fields). ASO path still quarantines when CPF cannot be extracted. Frozen identities never move.
- **OCR on every upload**: after `POST /documentos/upload` the UI triggers `enviarOcrDocumento` (client text extract → `POST /documentos/[id]/ocr`). Server path for scanned PDF/image: convert PNG **once** → Tesseract/local OCR → regex (`extrairDadosTexto`, passaporte included). Vision LLM only if local OCR is weak **and** `visaoLlmCompativel` (provider matches model: `gemini`+Gemini, `openai`+gpt-4o, `llamacpp`+llava — never `llamacpp`+`gemini`). Structured LLM is a tools-free `/chat/completions` call; skipped on empty text or when passport regex already filled `numero_passaporte`. Extracted `numero_documento` / `orgao_emissor` / dates persist when the row is still empty (`persistirCamposOcrDocumento`). Failure leaves the file saved for manual edit (`identity_match=unknown`). pdf.js uses `CanvasFactory` class (not deprecated `canvasFactory` instance).
- **Upload MIME**: `resolverMimeArquivo` accepts empty/`octet-stream`/`image/jpg` via extension and magic bytes (PDF/JPEG/PNG/WebP). UI tipos `visto`/`ctm`/`habilitacao`/`declaracao` map to CHECK-valid tipos (`documento_pessoal`/`cnh`/`outro`).
- **Auditoria panel**: tab "Auditoria Documentos" in `/admin/gestao-tripulantes` + API `GET|POST /api/gestao-tripulantes/auditoria`. GET returns buckets: sem_emissao, sem_validade, sem_rastreio, duplicados (groups), quarentena, vencidos, vencendo. POST fix actions (ADMIN-only): `gerar_rastreio`, `corrigir_datas`, `resolver_quarentena` (blocks if OCR CPF ≠ target CPF), `mesclar_duplicados`.

### Edição e exclusão de itens do cadastro (Treinamentos/ASO/Documentos/Passaportes) — ACL (2026-09-02)

- Todos esses itens são linhas de `gt_documentos` (+ `gt_documentos_aso`/`gt_documentos_treinamento`). Um único gate cobre as quatro abas: `PUT`/`DELETE /api/gestao-tripulantes/documentos/[id]`.
- Helper `src/lib/gestao-tripulantes/documento-permissions.ts` (`canEditGtDocuments` / `canDeleteGtDocuments`), 1ª camada que autorizar já libera:
  1. Role `ADMIN`/`MANAGER` — bypass total (comportamento implícito que já existia).
  2. Feature JSONB `gestao-tripulantes.documents.edit` / `gestao-tripulantes.documents.delete` (`access_permissions.features`, `src/lib/permissions.ts`) — checkbox em `/admin/users` (catálogo vivo; visível mesmo com o módulo GT desmarcado; ligar a feature liga o módulo).
  3. ACL granular (`acl_permissions`/`user_acl_permissions`/`role_acl_permissions`, resource `gestao-tripulantes`, actions `documents.edit`/`documents.delete`/`manage`/`admin`) via `checkAclPermission` — mesmo mecanismo já usado por férias. Seed em `POST /api/acl/init`.
- Rota `documentos/[id]` trocou `verifyToken` cru por `authenticateUser` (`@/lib/api-auth`) no PUT/DELETE para ter `role` + `access_permissions` disponíveis para o gate; GET continua só autenticado (leitura ampla, sem gate de ação).
- ASO já `enviado`/`processado` no e-Social não pode ser editado/excluído pela aba ASO (`isAsoLockedForEdit` em `ASOTab.tsx`) — evita divergir do evento oficial já transmitido.
- Cliente: `useGtDocumentPermissions()` combina `hasFeature` (role + JSONB + nomes ACL de `GET /api/user/effective-permissions`) com `GET /api/gestao-tripulantes/documentos/permissions` (mesmo `canEdit`/`canDelete` do PUT/DELETE). Grant só via ACL (sem JSONB) **mostra** o botão. Refetch em `permissions-updated`, focus e visibility. Helper compartilhado: `src/lib/effective-feature.ts`.

### Treinamentos — Numeração, Validade, Download e Anexos
- **Separação de Código e Numeração**: `subtipo` armazena a sigla/código do curso (ex: `CIR`, `TBS-I`, `CESS`, `GMDSS`, `STCW OF.NÁUTICA`), enquanto `numero_documento` armazena o número real do certificado/registro da Marinha/Instituição.
- **Controle de Validade e Cursos Permanentes**: Para cursos que não possuem vencimento (`data_validade IS NULL`), o status é `valido` com indicação `Permanente (Sem data de expiração)`. Para cursos com vencimento, exibe data de realização, data de validade e contagem regressiva em dias (`Válido`, `Vencendo em X dias`, `Vencido há X dias`).
- **Download Flexível**:
  - Com arquivo anexado (`arquivo_url`): download direto do PDF/imagem original.
  - Sem arquivo físico: gera instantaneamente a **Ficha Oficial de Registro e Conformidade de Treinamento** (`GET /api/gestao-tripulantes/documentos/[id]/pdf`) com layout ABZ Group, dados do tripulante, dados do curso, QR Code e carimbo de validação digital.
- **Anexo com 1 Clique & Edição**: Cada card possui botão para anexar o arquivo físico ao curso (`documento_id` no `/api/gestao-tripulantes/documentos/upload`) e botão de edição para atualizar número, datas, órgão e carga horária.
- **Exportação XLSX**: `GET /api/gestao-tripulantes/colaboradores/[id]/treinamentos/export` gera planilha profissional estilizada com toda a matriz de treinamentos do colaborador. Client download uses `getToken()` (never `fetchWithToken`, which clones the body) and must not call `onRefresh` or clear modal state.
- **Histórico colapsável (primário vs obsoleto)**: `documento-historico.ts` agrupa por `tipo_documento` + código do curso (`subtipo` / sigla no título / alias, ex. CBSP = “curso básico de segurança de plataforma”). **Não** apagar linhas. Primary = validade civil melhor (permanente/válido > vencendo > vencido), certificado vence declaração, depois data de validade/conclusão mais recente. `GET /colaboradores/[id]` devolve **todas** as linhas (sem dedup por título). `qtd_docs_vencidos|vencendo|validos`, filtro `onlyVencidos` e KPIs `total_docs_vencidos|vencendo` usam **somente o primário** de cada grupo.

### Collaborator modal — Dados Pessoais edit

- Edit mode (`DadosPessoaisTab`) renders inputs/selects for identity (nome, CPF, RG, matrícula, nascimento, nacionalidade, naturalidade, filiação, estado civil, email, telefone) and professional fields (cargo/empresa/embarcação/centro de custo via `SearchableCreatableSelect` + POST create, admissão, próximo embarque, status, standby, **regime de trabalho**) plus address.
- **Regime**: first-class `sem_escala` | `administrativo` | `onshore` | `14x14` | `28x28` | `15x15` | `30x30` | `60x60` (`regime-escala.ts`). Empty/null/no-rotation **never** coerce to 14x14. No-rotation persists `escala_embarque`/`escala_folga` = 0. PUT uses `persistirCamposEscala`.
- CPF: client + PUT validate with `isValidCpf` (Módulo 11); persist digits-only via `normalizeCpf`. Invalid/empty CPF → 400, never silently dropped.
- `matricula` e `matricula_esocial` são editáveis no PUT (whitelist). UI em `DadosPessoaisTab`. Sem `matricula_esocial`, o save copia `matricula`.
- `PUT /api/gestao-tripulantes/colaboradores/[id]` whitelists every editable `gt_colaboradores` column (not PK/system/`mio_*`/e-Social tracking). View aliases (`cargo_nome`…) resolve to FKs instead of being ignored.
- Modal fetch: keep previous `data` on error; ignore abort; do not replace loaded content with skeleton; tab error boundary isolates Treinamentos crashes.

### Document integrity gate (ALL document types)

- Migration `20260825_000001_gt_documento_integrity.sql`: `gt_documentos.numero_rastreio` (unique, partial index), `arquivo_hash` (sha256), `identity_match` (doc-level mirror of ASO gate) + deterministic backfill of tracking numbers.
- **numero_rastreio = NÚMERO PRÓPRIO DO DOCUMENTO**: the number printed on the file itself — nº do ASO impresso no laudo, nº do passaporte, nº do certificado/treinamento. NEVER an invented internal code when the document has its own numbering.
  - OCR path: `ocr-processor.ts::extrairNumeroDocumentoDoTexto(texto, tipo)` extracts it (ASO nº / "Nº do exame|laudo", Passport No / "Nº do passaporte", Certificado/NR nº; CRM/RQE/CNPJ/CPF are never the doc number); `persistirNumeroProprioRastreio` saves it — overwrites ONLY a `GT-...` fallback or null, never an intrinsic/manual value, and checks uniqueness first. Wired into both `extrairDadosASODoTexto` (ASO) and `aplicarGateIdentidadeDocumento` (all types).
  - Fallback interno (`documento-integrity.ts::garantirNumeroRastreioUnico`, format `GT-<TIPO>-<cpf4>-<YYYY>-<suffix>`) is acceptable ONLY for documents that genuinely have no intrinsic numbering (e.g. metadata-only MIO rows).
  - Manual fix: auditoria POST action `corrigir_rastreio` (ADMIN-only; `{documento_id, numero_rastreio}`, uniqueness-checked) + inline "Editar rastreio" in `AuditoriaDocumentosTab`; fallback values render flagged as "(fallback)".
- **Hard validation on save** (upload route, `POST /colaboradores/[id]/documentos`, `PUT /documentos/[id]`, `documento-service`): `data_emissao` + `data_validade` required (422 otherwise). Quarantine (`quarentena=true` / `identity_match='quarantine'`) is the only exemption.
- **Anti-duplication** (`buscarDuplicado`): before insert, match by `arquivo_hash` → `arquivo_path` → `(colaborador, tipo, titulo, numero_documento)`. Duplicate ⇒ UPDATE existing row (returns `merged: true`), never a new row.
- **Identity gate for all types** (`aplicarGateIdentidadeDocumento` in `ocr-processor.ts`, wired into `/documentos/[id]/ocr`): OCR CPF of ANY document type (passaporte, CNH, treinamento…) must match profile CPF; mismatch with no owning colaborador or no extractable CPF ⇒ quarantine (`colaborador_id=null`, `identity_match='quarantine'`). ASO path also mirrors its `gt_documentos_aso.identity_match` onto the doc row. Frozen identities never move.
- **Auditoria panel**: tab "Auditoria Documentos" in `/admin/gestao-tripulantes` + API `GET|POST /api/gestao-tripulantes/auditoria`. GET returns buckets: sem_emissao, sem_validade, sem_rastreio, duplicados (groups), quarentena, vencidos, vencendo. POST fix actions (ADMIN-only): `gerar_rastreio`, `corrigir_datas`, `resolver_quarentena` (blocks if OCR CPF ≠ target CPF), `mesclar_duplicados`.

## Work Guidance

- Filename/title is storage label only — never treat as identity.
- Profile ASO tab: separate disponíveis vs rascunhos; drafts badge “não enviado / rascunho”.
- Escala colors/labels: load from `tipos-evento` API — do not hardcode ON/FI/DBA/STB/OFF-C in the grade. `previsto` (ON*) vem de `embarque-status.ts` / seed; LGP sem Embarque Real persiste `tipo=previsto` + `GT_EMBARQUE=previsto`.
- Local scale edits must PUT when UUID exists; never create-always. Operates strictly on local gt_historico_embarques without writing to MIO.
- **MIO is pull-only**: `mioClient` throws outside `runMioPull()`. Feature modules read **canonical `gt_*` only** (`gt-canonical.ts`). PoliWeb scrape is ingest (`POST /poliweb` / cron), not a runtime dependency — imported ASOs live in `gt_documentos`/`gt_documentos_aso` with `origem=poliweb`. Admin pull: `POST /api/gestao-tripulantes/mio/sync` or cron `/api/gestao-tripulantes/cron/sync-mio`. Files: download bytes from MIO → bucket `gestao-tripulantes-documentos` → `arquivo_url` local. Missing bytes set `arquivo_ausente=true` and enqueue `gt_mio_anexo_misses` (never silent metadata-only). Never upload over MIO.
- Inactive/desligado colaboradores are persisted (`ativo=false`); trainings/ASOs/embarques use `findColaboradorByCpf` (no `ativo` filter).
- **Filtro de Colaboradores Ativos/Inativos**: Tanto a Matriz de Conformidade quanto o Man Schedule suportam filtragem por `ativos`, `inativos` e `todos` (default `ativos`). `GET /api/gestao-tripulantes/colaboradores` e `GET /api/man-schedule/realtime` expõem o status `ativo` para controle da visualização.
- **Modal de Escala Não Intrusivo & Draggable**: O modal de criação/edição de eventos de escala (`GTManScheduleTab`) opera como janela flutuante arrastável (draggable por mouse e touch) sem backdrop escuro bloqueante, permitindo consultar e comparar a planilha ao fundo enquanto interage com o formulário.
- **Alinhamento de Escala e Indicação de Início (`d.X`)**: Semanas da escala iniciam aos sábados (00:00:00 a sexta 23:59:59). Datas `YYYY-MM-DD` utilizam `parseLocalDate` para evitar retrocessos por fuso horário UTC-3. O campo `gt_historico_embarques.exibir_dia_inicio` (toggle no modal) controla se a célula da planilha exibe o número do dia de início (`d.X`) ou apenas a sigla limpa do evento. Checkbox **Visualizar por dia** troca a grade para colunas diárias sem alterar persistência dos eventos.
- Official MIO ASO list: insomnia documents **POST `/sms-aso` as inclusão (write) — never called**. Pull probes GET `/sms-aso-get`, `/sms-aso-registro-get`, `/sms-aso`, exames, etc. Hits persist to `gt_documentos_aso`; misses stored as evidence in `gt_mio_entidades` tipo `aso_probe_evidence`. ASO-like training rows still classified into ASO.
- No secrets in code; use env / `app_secrets` patterns from root DOX.

### Fechamento Mensal de Escalas & Despacho ao Departamento Pessoal (DP)

- **Workflow de Fechamento e Auditoria (`gt_relatorios_aprovacoes`)**:
  - `GET /api/gestao-tripulantes/relatorio-mensal?mesAno=YYYY-MM`: preview consolidado (`totalColaboradores`, `totalON`, `totalDBA`, `totalFI`, `totalFOLGA`, `totalSTB`, `totalTRE`, `totalFER`, `colaboradoresComAlerta`), `calculosFolha` (rubricas de dias para folha), `colaboradoresTotais` (embarques + checagens), `aprovadoresObrigatorios`, `assinaturasColetadas` e registro. Filtro opcional `colaboradorId`. Motor: `fechamento-calculo.ts`.
  - `GET /api/gestao-tripulantes/relatorio-mensal?mesAno=YYYY-MM&download=true`: XLSX oficial com ON, DBA, FI, FOLGA, STB, TRE, FER, check escala/soma + aba **Ciclos NxN** (dt início/dt fim de cada embarque).
  - `POST /api/gestao-tripulantes/relatorio-mensal/aprovar`: autenticado. **Lista nominada** = só quem está nela pode assinar (**qualquer role**, match por user id depois e-mail). ADMIN fora da lista → 403. **Lista vazia** = fallback ADMIN/MANAGER (nunca USER, nunca espera para sempre). Exige `signature_url`. Carimbo SHA-256 `GT_FECHAMENTO:mesAno:nome:cpf:data:ip`. Sem `full_name`/`cpf` em `users_unified` — usar `first_name`+`last_name` e `tax_id`.
  - **100% das assinaturas**: lista vazia → primeira assinatura de gestor/admin conclui e libera e-mail ao DP. Lista com N nomes → exatamente esses N, independente de cargo; extras não contam; e-mail XLSX só em 100%. `fechamento-assinatura.ts` (`podeAssinarFechamento` / `autorizacaoAssinarFechamento`).
  - `GET /api/gestao-tripulantes/cron/relatorio-mensal`: data de corte e pendências.
  - `GET|PUT /api/gestao-tripulantes/relatorio-mensal/config`: dia de corte, e-mails DP/CC, aprovadores, auto-envio, templates. PUT só ADMIN/MANAGER, persistência via `updateConfig` (erro do Supabase volta 500). GET devolve `availableUsers`/`availableManagers` via `listarCandidatosAprovadores()` (portal ativos + `gt_colaboradores` ativos com e-mail). `PUT /configuracoes` só grava chaves gerais — nunca `gt_fechamento_mensal_config`. `listarGestoresPortal()` permanece para ASO logística.
  - UI: admin `WorkflowFechamentoTab`; DP/GT `ModalAprovacaoFechamento` — só o `SignatureModal` global (não montar segundo). Sem assinatura, o modal de cadastro roda e só então o POST. Erros da API vão para o usuário (`error` string), nunca exception crua. Modal lê o ator com `useSupabaseAuth` (não `AuthContext` legado).

### GT Fechamento v2 (2026-09-16) — R1/R2/R5/R7 + R3

- **Migration** `supabase/migrations/20260916_000001_gt_fechamento_v2.sql` (executor `node scripts/apply-gt-fechamento-v2.js`): `gt_fechamento_periodos` (período manual por `mes_referencia` VARCHAR(7) PK + `lista_confirmada`), `gt_fechamento_marcacoes` (UNIQUE mes+colaborador), `gt_escala_edicoes` (auditoria das edições de escala), `ALTER gt_relatorios_aprovacoes ADD data_inicio/data_fim/pendencias` (idempotente, com reparos do shape de 20260831). As três tabelas novas: **RLS ligado, ZERO policies** (só service_role/supabaseAdmin).
- **R2 — período manual**: `GET|PUT /api/gestao-tripulantes/fechamento/periodo?mesReferencia=YYYY-MM`. PUT gated `isFechamentoRole`; body `{mesReferencia, dataInicio: 'YYYY-MM-DD', dataFim, listaConfirmada?}`; upsert em `gt_fechamento_periodos` (valida `dataFim >= dataInicio`). **`listaConfirmada` só é gravado quando o body traz um boolean** — ausente/undefined mantém o valor atual (PUT de período NUNCA desconfirma lista confirmada; `listaConfirmada=false` explícito reabre). Resolução do período usada por `relatorio-mensal` GET e `aprovar` POST: **explicit (query) > config > mês civil** (`resolverPeriodoFechamento`, âncora BRT `mesReferenciaAtualBRT`).
- **R5 — marcados**: `GET /fechamento/marcacoes?mesReferencia` → `{listaConfirmada, marcados:[{colaboradorId, nome, marcado, marcadoPorNome}]}`. `POST /fechamento/marcacoes` body `{mesReferencia, listaConfirmada?, itens:[{colaboradorId, marcado}]}` — batch upsert; gate `isFechamentoRole` **OU** ACL `gestao-tripulantes.fechamento.marcas`; `listaConfirmada=true` exige período definido. Quando `lista_confirmada=true`, **SOMENTE os marcados** entram naquele fechamento (`colaboradorIds` no gerador) — GET e POST aprovar usam a mesma base (`carregarMarcadosDoMes`); lista vazia confirmada = ninguém entra. `lista_confirmada=false` = comportamento legado (todos que passam nos filtros).
- **R7 — auditoria + fila de revisão**: TODA escrita em `gt_historico_embarques` via `POST/PUT/DELETE /embarques` aplica **imediatamente** (comportamento inalterado: `merged:true`, overlap-replace com soft-delete incluindo linhas abertas, `invalidateManScheduleCache` + `sincronizarDatasEscalaColaborador`) e grava linhas em `gt_escala_edicoes` com before/after image (`escala-audit-writer.ts`, BEST-EFFORT — nunca falha o save). Ator = JWT verificado + `x-forwarded-for`/`x-real-ip`; nome/CPF de `users_unified` (`first_name+last_name`/`tax_id`).
  - `GET /escala-edicoes?status=&operacao=&colaboradorId=&embarqueId=&page=&pageSize=` — paginada (range + count), mais novas primeiro (`created_at DESC, id DESC`), resolve `colaboradorNome` em lote (paginado).
  - `POST /escala-edicoes/[id]/rejeitar {motivo}` e `POST /escala-edicoes/[id]/reverter {motivo}` — gate `isFechamentoRole`; rollback mecânico por operação auditada: `create`→soft-delete da linha criada; `update`→restaura campos de `dados_anteriores` (linha viva); `delete`→remove o soft-delete; `restore`→volta o soft-delete. Marca a edição `status='revertida'` + `revisada_*` + motivo e grava a própria linha de auditoria (`operacao` `rejeicao`/`reversao`). Só edições `aplicada` são revertíveis (409 caso contrário). **Guardas anti-clobber (409, nada sobrescrito)**: (1) SUPERSESSÃO — existe edição-fonte (`create|update|delete|restore`; trilha `rejeicao`/`reversao` não conta) mais recente ainda `aplicada` para o mesmo `embarque_id` → recusa, rejeite/reverta as mais novas primeiro; (2) `update` — a linha precisa ainda corresponder a `dados_novos` nos campos restaurados (escrita posterior → recusa); (3) `delete` — un-delete só sem eventos vivos sobrepostos ao período do embarque (nunca dois eventos vivos sobrepostos; rejeite primeiro o evento que sobrepõe). Falha ao verificar edições posteriores = fail-closed (500, reversão não aplicada).
- **R3 — probe de mudança**: `GET /api/gestao-tripulantes/live-probe?escopo=escala|fechamento|colaboradores` (vírgula aceita vários) → `{assinatura}` = COUNT + último `updated_at`/`created_at` por tabela do escopo (`gt_historico_embarques` sem filtro `deleted_at` — soft-delete/restore muda a assinatura; fechamento soma `gt_fechamento_marcacoes`/`gt_fechamento_periodos`/`gt_relatorios_aprovacoes`; colaboradores = `gt_colaboradores`). **Sem cache HTTP** (`no-store`) — a assinatura precisa refletir a escrita imediatamente. Cliente: `src/hooks/useGtLiveProbe.ts` (poll 15s, baseline na 1ª resposta, robusto a erro, pausa com aba oculta).
- **R1/R4 — pendências do próximo período**: o motor (`fechamento-calculo.ts`) recorta a janela de folga ao período definido; o que passa de `data_fim` vira `pendenciasProximoPeriodo {fiDeficit, dbaDias[], folgaAberta, proximoEmbarque?}` por colaborador + `totaisPendencias` no agregado. `relatorio-mensal` GET devolve `pendencias {porColaborador, totais}` (`extrairPendenciasDoRelatorio`, tolerante a motor antigo) e `aprovar` POST grava o snapshot em `gt_relatorios_aprovacoes.pendencias` + `data_inicio`/`data_fim`. Carimbo: `montarHashFechamento` aceita `periodo` opcional — **default (sem período) mantém o formato antigo** (`GT_FECHAMENTO:mes:nome:cpf:data:ip`), com período anexa `:dataInicio:dataFim`.
- **XLSX**: `GET /relatorio-mensal?download=true` aceita `embarcacoes` (vírgula) além de `embarcacao`; filename reflete multi-embarcações + período (`montarNomeArquivoFechamento`).
- Libs do contrato: `src/lib/gestao-tripulantes/escala-audit-writer.ts` (trilha + rollback), `fechamento-periodo-resolver.ts` (período/marcados/pendências), `fechamento-periodos-service.ts` + `escala-edicoes-service.ts` (camada de serviço que envolve a audit-writer). Todas as leituras multi-linha paginadas (`paginarSelect` + ordem determinística) — PostgREST trunca em 1000.
- **UI do v2** (contrato de consumo em `src/components/gestao-tripulantes/AGENTS.md`): workspace de tela cheia `ModalAprovacaoFechamento` (abas Resumo/Tripulantes/Período & Marcados/Fila de revisão) com `fechamento/PeriodoFechamentoEditor` (R2), `MarcadosFechamentoPanel` (R5), `PendenciasProximoPeriodo` (R4), `FilaRevisaoEscala` (R7) e `MultiEmbarcacaoFilter` (R8); grade usa `EscalaEventoForm` + histórico em `HistoricoEmbarquesTab`. Probes cliente: `src/hooks/useGtLiveProbe.ts` (fechamento) **e** `src/components/gestao-tripulantes/use-gt-live-probe.ts` (grade/matriz, com `canProbe`/`notifyLocalWrite`) — atualizar o contrato do endpoint nos dois lugares se mudar.

### Regras Contábeis de Cômputo de Dobra (DBA), FI e Escalas
- Motor único: `src/lib/gestao-tripulantes/fechamento-calculo.ts`. UI, `GET /relatorio-mensal`, XLSX e e-mail ao DP usam os mesmos números (`calculosFolha`).
- Comparativo NxN: embarque N deve folgar N (`14x14`, `28x28`, …). Sempre `data_embarque` + `data_desembarque` (ou prevista). Sem dt fim o embarque **não** entra no automático e gera alerta — nunca inventar janela.
- A escala vem de `extractEscalaDias` em `regime-escala.ts` (`escala_embarque`, `escala_folga`, `regime_trabalho`):
  - **NxN**: dias a bordo acima da escala = `DBA` (ex: 28x28 e 30d a bordo → 28 ON + 2 DBA). Folga real até o próximo embarque < escala = `FI` déficit.
  - **`sem_escala` / `administrativo` / `onshore`** (e vazio/null): **não** viram 14x14. Dias = 0. `aplicaDobraAutomatica = false`. Evento explícito `dba`/`dobra` ainda conta DBA.
  - Eventos FI / TRE / STB / OFF-C mantêm a classificação do tipo. STB no intervalo de descanso conta STB, não folga.
  - Afastamentos e férias (`gt_afastamentos` / `/ferias`) entram como `FER` e não se sobrepõem ao cômputo ON/DBA.
  - Check escala = ciclo bateu N embarque + N folga. Check soma = ON + DBA = intervalo dt início/dt fim.
- **Man Schedule / matriz**: administrativos/onshore existem **sem** rotação ON/STB. A grade não inventa dias ON. A pílula de status continua a célula de hoje (`embarque-status.ts`).
- **MIO pull**: `mesclarRegimeMio` — override local (incl. `sem_escala`) não é sobrescrito. MIO vazio → `sem_escala`; MIO onshore → `onshore`. Nunca gravar 14x14 como default. Nunca PUT de volta ao MIO.

### Cruzamento de Dados e Sincronização Automática
- **Edição de Colaborador** (`CollaboratorModal`, `DadosPessoaisTab`): Ao atualizar matrícula, centro de custo, cargo, empresa, embarcação, regime de trabalho, escalas e datas de embarque/desembarque em `gt_colaboradores`, o motor sincroniza automaticamente os eventos e-Social (S-2200, S-2240, S-2299) e os fechamentos DP.
- **Férias & Man Schedule**: Férias aprovadas no módulo `/ferias` sincronizam automaticamente com `gt_afastamentos` (S-2230) e refletem diretamente na escala visual do Man Schedule e no fechamento DP.

### Matrizes de Treinamento & Conformidade por Cargo

- **Tabelas canônicas**:
  - `gt_matrizes_treinamento`: `id`, `codigo`, `nome`, `descricao`, `centro_resultado`, `cliente`, `contrato`, `responsavel`, `ativo`, `created_at`, `updated_at`.
  - `gt_matriz_treinamento_requisitos`: `id`, `matriz_id`, `cargo_id`, `cargo_nome`, `regime` (Offshore/Onshore/Geral), `treinamento_nome`, `sigla`, `obrigatorio` (boolean), `validade_meses`, `especialidade`.
- **Endpoints de Matrizes**:
  - `GET|POST /api/gestao-tripulantes/matrizes`: lista matrizes com contagem agregada de requisitos e cadastra nova matriz (acesso ADMIN/MANAGER).
  - `GET|PUT|DELETE /api/gestao-tripulantes/matrizes/[id]`: consulta detalhes com requisitos ordenados, substitui requisitos em lote e remove matriz.
  - `POST /api/gestao-tripulantes/matrizes/import`: recebe arquivo multipart `.xlsx` no padrão oficial de exportação do MIO/PoliWeb (abas `Matriz` para metadados e `Registros` para requisitos de Cargo + Regime + Treinamento) e faz upsert automático.
  - `GET /api/gestao-tripulantes/colaboradores/[id]/matriz-conformidade`: calcula o gap analysis do colaborador em relação à matriz de seu cargo e regime (cursos vigentes/válidos, a vencer em 30d, vencidos e faltantes não realizados).
- **Treinamentos — Edição e Exclusão Total de Lançamentos Incorretos**:
  - Itens obsoletos/históricos no card de treinamentos expõem botões de edição e exclusão para operadores autorizados (`useGtDocumentPermissions()`).
  - Edição de treinamentos persiste carga horária, nome do curso, instituição e datas simultaneamente mesmo quando acompanhada de novo anexo de certificado.
- **Lista de Presença para Treinamentos Internos**:
  - `ModalListaPresencaTreinamento.tsx` integra o cadastro de tripulantes ao módulo global `/api/lista-presenca`.
  - Permite emissão de lista oficial para assinaturas digitais e opção de lançamento automático em lote do treinamento concluído no prontuário de cada participante selecionado.
- **Man Schedule — Barra de Rolagem Horizontal Aprimorada e Sincronizada**:
  - CSS customizado `.man-schedule-scroll` (14px de espessura, thumb contrastado `#94a3b8` com track `#f1f5f9`).
  - Hook `useManScheduleScrollSync`: `ResizeObserver` na tabela + scrollport; barra superior e grade compartilham `scrollLeft`. Cadeia flex com `min-w-0` para o overflow horizontal existir de fato.

### Centros de Custo Globais

- **Tabela `gt_centros_custo`**: `id`, `codigo` (ex: `CC-OP-001`), `nome`, `ativo`, `created_at`, `updated_at`.
- **Endpoints Compartilhados**:
  - `GET|POST /api/centros-custo` (global) e `GET|POST /api/gestao-tripulantes/centros-custo` (módulo).
  - `PUT|DELETE /api/gestao-tripulantes/centros-custo/[id]`.
- **Admin UI**: Aba `Centros de Custo` em `/admin/gestao-tripulantes` permitindo busca, cadastro, edição e ativação/desativação rápida.

## Verification

- Cadastro: `npx tsx --test src/lib/gestao-tripulantes/colaborador-cadastro.test.ts`. POST sem CPF válido / sem gate DP → 400/403. `matricula_esocial` vazio copia `matricula`.
- `GET /colaboradores/[id]` should log `[GT GET /colaboradores/<id>] <N>ms` with two waves; opening the modal must not fire two GETs 1ms apart.
- Man Schedule grid must not fetch `/api/man-schedule/realtime` until the tab is selected; switching away keeps the mounted cache.
- Upload ASO with matching CPF → OCR `identity_match=match` → send e-Social allowed.
- Upload passport/CNH/other without dates → 201, status `pendente`; OCR runs (Tesseract → regex; vision only if compatible); fields editable if OCR empty.
- Scanned PDF + `provider=llamacpp` + Gemini model → skip vision (no `llamacpp_image_url` fetch); empty OCR text never hits tools chat.
- Upload wrong-person PDF on profile → reassign or quarantine; never stays on wrong profile.
- Send S-2220 → `gt_documentos_aso.esocial_status=enviado`; consult PROCESSADO → `processado`.
- `GET /api/gestao-tripulantes/aso?cpf=` excludes `nao_enviado`/`pendente`.
- Create OFF-C local event → reload grade still shows OFF-C (not FI); observações appear on hover + icon.
- Admin tab Marcadores Escala: change color → grade/legend/export reflect new colors.
- PUT `/embarques/[id]` updates dates/tipo/obs without duplicating rows.
- CollaboratorModal locks `body` scroll and is vertically centered; top header has frosted backdrop (`bg-gray-50/90 backdrop-blur-md`) preventing content bleed on scroll.
- `GET /api/man-schedule/realtime` does not call `mioClient`; source is `gt_historico_embarques` (`meta.source`).
- Novo ON sobre STB longo aparece nas semanas do período e incrementa a coluna ON. `npx tsx scripts/verify-escala-contagem.ts` → `ESCALA_CONTAGEM_VERIFY_OK`.
- `npm run mio:assert-local-first` exits 0 (`ASSERT_MIO_LOCAL_FIRST_OK`).
- Full pull: `npm run mio:pull` (admin credentials in `.env.local`). Dry-run: `npm run mio:pull:dry`.
- Dados Pessoais edit mode: all identity + professional fields are inputs (not plain text); Save persists via PUT whitelist including CPF (validated) and FK professional columns. Regime `sem_escala` survives reload (`npx tsx --test src/lib/gestao-tripulantes/regime-escala.test.ts`).
- After Treinamentos “Exportar Excel”, modal still shows collaborator data (reopen included); GET 200 is not wiped by export.
- Valid CBSP + expired/declaração CBSP do mesmo colaborador: UI mostra 1 linha primária válida, histórico colapsado “Obsoleto”, `qtd_docs_vencidos` da ficha **não** inclui o CBSP antigo. `npx tsx --test src/lib/gestao-tripulantes/documento-historico.test.ts`.
- `GET /api/gestao-tripulantes/poliweb/asos-pendentes` returns 200 with array `data` (empty + `warning` if Poliweb down); GT page does not show Next.js overlay.
- `GET /api/gestao-tripulantes/aso/notificar-vencimentos` returns `{ vencidos, vencendo, antecedencia_dias }` with `colaborador.nome_completo` (not nested `gt_colaboradores`); `/department/dp` wraps `MainLayout`. Janela default 60d via config.
- `npx tsx --test src/lib/gestao-tripulantes/aso-agendamento-sugestoes.test.ts` → STB before ON; janela 60d + min lead.
- DP escolhe data sugerida (STB) → POST agendamentos → logística vê em ASO Logística → assina aprovar → status `marcado` nos dois painéis. Reprovar exige motivo visível no DP. USER do setor Logística com módulo GT consegue aprovar/reprovar; USER de TI/QHSE com o mesmo módulo toma 403. `npx tsx --test src/lib/gestao-tripulantes/aso-agendamento-auth.test.ts src/lib/gestao-tripulantes/aso-agendamento-sugestoes.test.ts`.
- `GET /dashboard` totals exclude `ativo=false` and inactive cost centers; docs vencidos/vencendo count **primary per group** only (`somarDocsPorStatusPrimario`).
- Man Schedule checkbox “Visualizar por dia” renders one column per day; unchecked keeps Saturday weeks. Toolbar Hoje restores the current month and today’s column; month arrows change the reference month (grid covers that month even with no rotations). Pill interpolates `{count}` as civil-today POB (`countPobOnCivilDay`), independent of the reference month.
- `GET /api/gestao-tripulantes/dashboard`: `total_colaboradores` ignora inativos e CC inativo; `total_embarcados` = ON exato hoje (`embarque-status.ts`); `total_docs_vencidos` conta só o primário por grupo.
- Fechamento: `POST .../relatorio-mensal/aprovar` com lista nominada espera só quem está nela (USER incluso; ADMIN fora → 403). Lista vazia + 1 assinatura ADMIN/MANAGER → `aprovado`/`enviado`. `GET .../config` `availableUsers`/`availableManagers` = usuários ativos com e-mail. `npx tsx --test src/lib/gestao-tripulantes/fechamento-assinatura.test.ts`.
- Cálculo DP: 14x14 com 16d a bordo → 14 ON + 2 DBA; retorno 6d depois → 8 FI. Sem dt fim → 0 automático + alerta. `GET /relatorio-mensal` devolve os mesmos totais do XLSX (`calculosFolha.rubricas`). `npx tsx --test src/lib/gestao-tripulantes/fechamento-calculo.test.ts`.
- `GET /documentos/alertas` lista título/tipo/aba; `npx tsx scripts/verify-docs-alertas.ts` → `DOCS_ALERTAS_VERIFY_OK`.
- Typing year digits in Man Schedule Data Início does not rebuild the grid until a complete 1990–2100 date.
- Clique no card Embarcados filtra `GET /colaboradores?kpi=embarcados` ao mesmo conjunto. Linhas ON hoje devolvem `status_embarque=embarcado` (não Folga stale). `npx tsx --test src/lib/gestao-tripulantes/embarque-status.test.ts`.
- Advisor `rls_disabled_in_public` is empty for `gt_afastamentos`, `gt_acidentes`, `gt_relatorios_aprovacoes`, `gt_aso_agendamentos`. Anon REST `GET /rest/v1/<table>?select=id&limit=1` → `[]`. Service-role / API routes still return rows.
- USER sem feature/ACL de GT → `PUT`/`DELETE /api/gestao-tripulantes/documentos/[id]` retorna 403 (`canEditGtDocuments`/`canDeleteGtDocuments`). MANAGER/ADMIN sempre passam. USER com JSONB `.edit`/`.delete` **ou** ACL `gestao-tripulantes.documents.edit`/`.delete` (ou manage/admin) passa no PUT/DELETE **e** vê o botão (`GET .../documentos/permissions` + `hasFeature`). `npx tsx --test src/lib/effective-feature.test.ts`.
- `SELECT ... FROM acl_permissions WHERE resource='gestao-tripulantes'` deve incluir `documents.edit` e `documents.delete` (seed 2026-09-02); `role_acl_permissions` tem MANAGER com `documents.edit` e ADMIN com todas.
- ASO com `aso_data.esocial_status` em `enviado`/`processado`: botões Editar/Excluir da aba ASO ficam ocultos (mensagem "Já enviado ao e-Social — não editável"); ASO em `nao_enviado`/`pendente`/`quarentena` mostra os botões quando `canEdit`/`canDelete`.
- `POST /colaboradores/[id]/desligamento` (ADMIN/MANAGER ou setor DP/RH + módulo GT) inativa o colaborador, cria `gt_desligamentos`, dispara S-2299 e tenta a folha sem falhar o GT. USER de TI com o mesmo módulo toma 403. `npx tsx --test src/lib/gestao-tripulantes/desligamento.test.ts src/lib/gestao-tripulantes/desligamento-auth.test.ts`.
- **Matrizes de Treinamento por Cargo (Acesso e Permissões por Setor / ACL)**:
  - Rotas: `GET|POST /api/gestao-tripulantes/matrizes`, `GET|PUT|DELETE /api/gestao-tripulantes/matrizes/[id]`, `POST /api/gestao-tripulantes/matrizes/import`, `GET /api/gestao-tripulantes/matrizes/permissions`.
  - Gate unificado em `src/lib/gestao-tripulantes/matriz-permissions.ts` (`podeGerenciarMatrizesTreinamento` / `podeVisualizarMatrizesTreinamento`):
    1. Role: ADMIN, ADMINISTRADOR, SUPERADMIN, MANAGER (acesso irrestrito).
    2. Setores autorizados: Setor DP, RH, Treinamento, Operações, SMS/QHSE ou Gestão de Tripulantes com o módulo `gestao-tripulantes` habilitado em `sectors.allowed_modules`.
    3. ACL granular: `acl_permissions` resource `gestao-tripulantes` com action `matrizes.manage` (ou `matrizes.view`), seed em `POST /api/acl/init` associado a MANAGER/ADMIN e atribuível a USERs.
    4. Feature JSONB: `gestao-tripulantes.matrizes.manage` configurável em `/admin/users` no editor de usuário.
  - Disponível nativamente na aba e no botão do header de `/department/gestao-tripulantes` (respeitando visivelmente o ACL — só é renderizado quando o usuário possui permissão de leitura/gestão).

## Child DOX Index

- `src/lib/document-catalog/AGENTS.md` — catálogo global; aba QHSE / EPI do perfil GT (módulo `epi`)
