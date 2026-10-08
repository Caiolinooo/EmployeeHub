# Catálogo vivo de módulos e permissões — DOX

## Purpose

Fonte única de módulos do portal + superfícies de permissão (flag de módulo, features JSONB, ACL).

## Ownership

- Registry: `src/config/modules.ts` (`SYSTEM_MODULES`, `EXTRA_ACL_RESOURCES`)
- Ações granulares por módulo: `src/config/module-grants.ts` (`MODULE_GRANTS`, `EXTRA_RESOURCE_GRANTS`), mescladas em `SYSTEM_MODULES`/`EXTRA_ACL_RESOURCES` por `modules.ts`
- Sidebar adapter: `src/constants/modules.ts` (reexporta o mesmo registry)
- APIs: `GET /api/admin/available-modules`, `GET /api/admin/permission-catalog`, `POST /api/acl/init`
- UI: UserEditor “Módulos do Sistema”, `CatalogFeatureToggles`, ACL tree, RolePermissionsEditor

## Local Contracts

- Novo módulo: adicionar **um** item em `SYSTEM_MODULES` (key, href, defaultRoles, `features`, `acl`). Sidebar, checkboxes e seed ACL passam a entender sem segunda lista morta.
- `src/constants/modules.ts` não duplica dados — só adapta `id`/`label`/`href`/`visible`.
- Cards extras na tabela `cards` entram em available-modules / permission-catalog como módulo sem features/ACL até alguém registrá-los no catálogo.
- ACL seed é insert-if-missing (`POST /api/acl/init`). Não apaga linhas existentes (GT / e-social / academy / social).
- Módulo `financeiro` (2026-09, design financeiro §8): key `financeiro`, href `/folha-pagamento` (casca com áreas + hub `?tab=`), category `business`, ACL granular `financeiro.view|edit|admin` (nível 1/2/3, STAFF/STAFF/ADMIN). Gates das rotas `/api/financeiro/**` usam esses nomes via `garantirNivelFinanceiro`. Visual em `src/components/financeiro/AGENTS.md`.
- Módulo `contratos` (alias `contracts`): `contratos.view_all` (STAFF) / `view_own` (sem default) definem o escopo; ações granulares `contratos.create|edit|delete|dispatch|send|cancel|resend|download|download_signed|templates.view|manage|use|signers.manage|audit.view|export` (feature + ACL, mesmo nome). `download`/`download_signed` ficam fora do UserEditor (`userEditor=false`, padrão liberado). Regra em `src/lib/contracts/AGENTS.md`.
- `loadEffectivePermissions` ignora grants `user_acl_permissions` com `expires_at` vencido.
- Ids de módulo: `resolveModuleKey(id)` mapeia recurso ACL (`news`→`noticias`, `reimbursement`→`reembolso`), `aliases` (`folha`→`financeiro`) e labels legados de `sectors.allowed_modules` para a chave do catálogo. Setor, ACL e sidebar nunca comparam ids crus.
- Composição única: `composeEffectiveModules` (`src/lib/effective-feature.ts`), precedência por módulo: (1) revogação do usuário (`modules[k] === false` ou `aclDenied` com action `view|read|access`) > (2) grant do usuário (`modules[k] === true` ou ACL `source: 'user'`) > (3) papel/setor (ADMIN tudo; MANAGER setor ∪ defaults ∪ ACL do papel; USER com setor = setor estrito, ACL `source: 'role'` não abre módulo do catálogo; USER sem setor = defaults + ACL do papel). Features: `false` no JSONB e `granted=false` removem a key de `effective_features`/`aclNames` (role bypass de `hasEffectiveFeature` continua antes). `aclNamesWithinModules` descarta nomes ACL de módulo do catálogo fechado. Cliente (`SupabaseAuthContext.hasAccess`) usa `effective_modules` do servidor para USER assim que carrega (MANAGER mantém bypass de página exceto `admin`). `loadEffectivePermissions` (`src/lib/effective-permissions-server.ts`) alimenta `GET /api/user/effective-permissions` **e** os gates de rota (`userHasModule`, `userHasGrant`). Gate de rota nunca é só role: módulo/feature JSONB/ACL são o mesmo grant; ADMIN/MANAGER bypass só onde o contrato do módulo diz.
- Feature com nome ≠ ACL (`esocial.*`↔`e-social.*`, `contracts.*`↔`contratos.*`, `reimbursement_approval`↔`reimbursement.approve`) fica em `FEATURE_IMPLIED_BY_ACL` (effective-feature.ts).
- Módulo `gestao-tripulantes`: `gestao-tripulantes.cadastro.manage` (feature + ACL, STAFF) abre o cadastro DP (colaboradores, departamentos, cargos, empresas, embarcações, centros de custo, afastamentos). Implícita por ACL GT `manage|admin` e `dp.manage|admin`.
- EPI: gerir (catálogo, kits, estoque, responsáveis) = `snapshotPodeGerenciarEpi` (MANAGER/ADMIN, módulo `epi` explícito no usuário, módulo `epi` no setor, ou `epi.manage|admin`). `src/lib/epi-access.ts`. `podeGerenciarEpi(userId, role, acao)` soma o grant granular `epi.<acao>` por rota (`view_all`, `deliver`, `delete`, `stock.view|edit|import`, `kits.manage`, `types.manage`, `sector_responsibles.manage`, `ca_lookup`); `POST /api/epi/reset` = ADMIN ou `epi.reset`.
- Grants granulares (`<modulo>.<acao>` / `<modulo>.<escopo>.<acao>`): uma linha em `module-grants.ts` gera feature JSONB **e** ACL com o mesmo nome (prefixo = recurso ACL do módulo: `news.*`, `reimbursement.*`). Defaults nunca concedem algo novo a USER: `A` só em ação pessoal que o USER já faz e só em módulo que já tinha ACL de USER; `S` = ADMIN/MANAGER; `O` = ADMIN; `N` = sem default. Módulos ADMIN_ONLY (`admin`, `feedback`, `metrics`, `engagement`, `integracao-erp`) só `O` (ACL de MANAGER abriria o módulo na sidebar). Ação criada e ainda não ligada em rota fica conservadora; rever o default ao aplicar. Feature/ACL novo ligado em rota usa **nome novo** (nunca reaproveitar nome já semeado com outro default: o seed de MANAGER alargaria o acesso).
- Gate de rota: `canWithGrant(userId, role, keys, bypass)` (`src/lib/permission-gate.ts`): `staff` (ADMIN/MANAGER), `admin` (só ADMIN) ou `none` (só grant). Soma o grant ao gate de papel existente, nunca o remove. Aplicado: reembolso (`reimbursement.reject|mark_paid|delete|view_all`, `reimbursement_approval`/`.approve` agora também por ACL), avaliação (`avaliacao.*` em avaliacoes/criterios/evaluations/settings/lixeira/relatórios), compras (`compras.delete|config|generate_po|approve_any`), `wkradar.*`, `kpi.bi.*` (dashboard-bi), academy (`update_any|delete_any|questions.manage|progress.view_all`), chat (`chat.moderate|channels.create`), IA (`config|feature_toggles|sessions.cleanup|knowledge.manage`), `lista-presenca.manage_any`, `news.comments.moderate`, `admin.users.access_history.*|permissions.view`. As demais entradas de `module-grants.ts` existem no UserEditor/ACL e **ainda não** estão ligadas a rotas.
- Também ligados (helpers de módulo aceitam `grants` extras: `garantirNivelFinanceiro`/`garantirNivelPayroll`/`podeNivelRecrutamento`; `withPermission`/`withAdmin` viram `withPermissionOrGrant(permission, grants, handler)` em `src/lib/api-auth.ts`): férias (`view_all|pdf_all|reject`), financeiro (`faturas.*|nfse.*|bancos.manage|certificado.manage|cobrancas.generate|conciliacao.run|clientes.manage|templates.manage|export|folha.import|folha.export|rubricas.manage`), `contracheque.view_all` (DP), recrutamento (`vagas.view|candidatos.view|vagas.sync|inhire.configure`), `ponto.settings.manage`, `calendario.company.config`, calendário pessoal (`calendario.manage|create|update|delete`, só para agir em evento de terceiro) e `calendario.notify` (company/notify, além de `CRON_SECRET`), news (`create|update|update.all|delete|delete.all|viewers.view|categories.manage|attachments.upload`, `comments.moderate` para editar/excluir comentário de outro autor; `POST` de comentário em `news/posts/[postId]/comments` e `news/[id]/comments` exige login e grava o autor do token, `user_id`/`userId` divergente no body = 403), notifications (`push.manage|templates.manage|broadcast|manage`, `send`/`delete`/`purge` só para alvo ≠ usuário logado; `GET /api/notifications` exige login, sem `user_id` = usuário do token, outro `user_id` = staff ou `notifications.manage`), biblioteca (`create|update|delete|manage`, exceto upload-auth), `social.delete.any`. Nome base já semeado (news/notifications/biblioteca.manage) só entra quando o seed existente ⊆ quem já passa. Cada grant ligado entra em `WIRED` de `src/config/route-grants.test.ts` com os papéis que passavam antes.
- ACL de leitura global (`ferias.read`: férias/PDF de qualquer colaborador) nunca tem default USER, nem na ACL nem no JSONB `DEFAULT_PERMISSIONS_BY_ROLE.USER` (`src/lib/permissions.ts`). O acesso pessoal vive no caminho do dono da rota (e em `*.view_own`/`*.pdf_own`), não no `read` do recurso.
- `users_unified` não tem coluna `cpf`. Identidade de portal é `tax_id` + e-mail.

## Work Guidance

Ao criar módulo novo:

1. Entrada em `SYSTEM_MODULES` com `features` (UserEditor) e `acl` (resource/actions + `defaultRoles`)
2. Se o resource ACL ≠ key (ex. noticias → `news`), setar `aclResource`
3. Rodar `npx tsx --test src/config/modules.test.ts`
4. Em preview, `POST /api/acl/init` para semear permissões novas

## Verification

- `npx tsx --test src/config/route-grants.test.ts` — grant ligado em rota nunca semeia papel além de quem já passava no gate (USER nunca; MANAGER fora de gate ADMIN-only)
- `npx tsx --test src/app/api/auth-required-routes.test.ts` — calendar/events, company/notify, news categories/upload/comentários, notifications POST/DELETE/purge e push subscriptions/count respondem 401 sem token, sem tocar banco/storage
- `npx tsx --test src/config/modules.test.ts src/lib/permission-gate.test.ts` — ids únicos, feature ↔ módulo, defaults de USER limitados a escopo pessoal, módulos ADMIN_ONLY só `O`
- `/admin/users` Módulos do Sistema inclui `gestao-tripulantes`, `e-social`, `dp`, `epi`, `ferias`, `kpi`
- Features do catálogo aparecem no UserEditor mesmo com o módulo desmarcado; ligar a feature liga o módulo
- `hasFeature` / `GET /api/user/effective-permissions` tratam nome ACL = feature key (JSONB nulo não esconde o grant)
- `npx tsx --test src/lib/effective-feature.test.ts` — USER + ACL `gestao-tripulantes.documents.delete` sem JSONB = canDelete
- `GET /api/acl/init` lista resources do catálogo; GT `documents.edit` / e-social `view` permanecem
- `npx tsx --test src/lib/effective-feature.test.ts src/lib/epi-access.test.ts` — USER com módulo marcado fora do setor acessa; sem grant não; ACL `news`/`reimbursement`/`folha` habilitam `noticias`/`reembolso`/`financeiro`; matriz de precedência (revogação vence setor/papel/grant; setor estrito bloqueia ACL do papel USER; grant explícito abre; ADMIN bypass)
- Impacto de mudança na composição (read-only): `npx tsx --env-file=.env.local scripts/acl-effective-modules-snapshot.ts snapshot before.json` antes e `... after.json` depois, `... diff before.json after.json`

## Child DOX Index

_(none)_
