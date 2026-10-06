# Plano de Implementação — Ponto (Time-Sheet / PontoFlow) no Portal ABZ

Status: PLANO (nenhum código implementado). Data: 2026-10-05.
Repos: **Portal** = `painel-abz` · **TS** = `D:\Projeto\Finalizados\2_Time-Sheet - Manager ABZ Group` (PontoFlow).
Método: grounding por 4 scouts (Kimi K3) + arena de 3 desenhos estruturalmente distintos (A contrato/API, B engine+SDK com UI nativa, C pull federado) → síntese (seção 12).

---

## 1. Requisitos

1. Pessoal **offshore (14x14/28x28)** e **onshore** marca ponto no Time-Sheet, acessado a partir do portal.
2. Cadastro do colaborador (portal) tem opção **sim/não "Contabilizar no Time Sheet"**.
3. Time-Sheet é **produto externo**: zero dependência do portal; vendável a terceiros.
4. Portal só conhece o TS via **contrato público versionado** (mesmo que um cliente externo usaria).

## 2. Estado atual (grounding verificado)

**TS (PontoFlow)**: Next 14 + Supabase próprio, multi-tenant (`tenants`, `tenant_user_roles`), `employees(profile_id, tenant_id)` **sem external_id/cpf**; fluxo de convite (`admin/invitations`, `accept-invite`); escalas em `employee_work_schedules` (7x7,14x14,21x21,28x28,custom); status `rascunho→enviado→aprovado|recusado→bloqueado`; auth própria HS256 (`timesheet_session`); **sem API pública, sem API keys, sem SSO, sem webhooks de saída**. Acoplamentos ABZ: footer `© ABZ Group` (`invitations/[id]/route.ts:219`), prazo dia 16 (`periods/route.ts:98`, `manager/pending-timesheets/route.ts:64`), entrega DP em bucket `dp-folhas` (`lib/dp/delivery.ts`), sync `users_unified` + export HMAC, fallback de login bcrypt em `users_unified` (`custom-auth.ts:107-148`), formato Omega, `appId com.abzgroup.com.br`, `jwt.ts:39-52` fallback inseguro sem `JWT_SECRET`, **LICENSE (MIT) × LICENSE-COMMERCIAL.md (sem revenda)**. Drift de schema: `timesheet_entries.tipo` CHECK (3 versões), colunas de `approvals`, status pt/en.

**Portal**: `gt_colaboradores` (uuid PK, `user_id→users_unified`, `cpf` UNIQUE, whitelist em `src/lib/gestao-tripulantes/colaborador-cadastro.ts:8-62`); regime em `regime-escala.ts` (`14x14`/`28x28`/`onshore`/`administrativo`/`sem_escala`); `payroll_employees` espelha folha (merge por CPF); módulo `ponto` (`src/config/modules.ts:135`) hoje só link-out p/ Ahgora (`src/app/ponto/page.tsx`); padrões prontos: `getCredential`, `safe-url`, cron `CRON_SECRET` (`avaliacao/cron/criar-avaliacoes`), `{success,data,error}`, migrations idempotentes `supabase/migrations/YYYYMMDD_*.sql`.

## 3. Decisões de arquitetura (síntese)

| # | Decisão | Motivo |
|---|---|---|
| D1 | **TS publica "Integration API v1"** (chave por tenant, OpenAPI, idempotente, webhooks). Portal = **adaptador fino**. | Produto vendável: qualquer cliente usa a mesma API. Direção de dependência: portal → TS, nunca o contrário. |
| D2 | **Push via outbox** (portal envia mudanças do flag), com **reconciliação periódica** (portal reenvia delta/snapshot) + `dryRun`. | Provisionamento ≤ minutos; falha do TS nunca bloqueia salvar cadastro. |
| D3 | Chave de identidade: **`external_id = gt_colaboradores.id`** (uuid imutável). `email` = login/convite; `cpf` só reconciliação/dedup. | Email muda; CPF é dado sensível e pode faltar; uuid é estável. |
| D4 | **Marcação acontece na UI do TS** (web/mobile), aberta do portal via **SSO de uso único** (token 60 s). Portal **não** reimplementa UI de ponto. | Evita refatorar o monólito TS (engine extraction do desenho B) agora; entrega valor em semanas, não trimestres. |
| D5 | Dados que voltam ao portal: **somente resumo derivado** (dias/horas aprovadas por período) via webhook `timesheet.approved` + pull de reconciliação. **Nenhuma batida bruta** no portal. | Uma só fonte da verdade; sem duplicar domínio. |
| D6 | Flag off ⇒ `active:false` no TS (nunca delete). Histórico preservado; timesheet em curso continua submetível. | Auditoria/legislação trabalhista. |
| D7 | Escala derivada **no portal** e enviada **sempre explícita** (`pattern daysOn/daysOff/anchor` para NxN; `weekly seg–sex` para quem não tem escala). TS nunca conhece vocabulário ABZ. | Sem vazamento de modelo do portal no produto; sem depender de default do tenant. |
| D10 | **1 tenant TS por empresa** (`empresa_id`); credenciais e webhook por empresa. | Decisão do negócio (#2). |
| D11 | **Tenant `sso_only`**: login só pelo portal, sem senha nem convite. | Decisão do negócio (#5). |
| D8 | Engine extraction `@pontoflow/engine` (desenho B): **fora de escopo agora**; SDK tipado `@pontoflow/sdk` gerado do OpenAPI **dentro de escopo** (fase 5). | Menor módulo profundo suficiente; SDK dá a ergonomia sem refactor gigante. |
| D9 | Conector genérico de "roster pull" (desenho C) vira **recurso opcional do produto** (fase 7, pós-MVP) para clientes sem capacidade de push. | Aumenta vendabilidade; não é caminho crítico do ABZ. |

## 4. Uso (visão do chamador — contrato a implementar)

**DP no cadastro** (`ColaboradorCadastroForm.tsx`): checkbox "Contabilizar no Time Sheet" → `PUT /api/gestao-tripulantes/colaboradores/[id]` com `contabilizar_timesheet: true|false`. Efeito assíncrono; status visível no próprio form (`pendente | ativo | inativo | erro`).

**Colaborador** (portal `/ponto`): botão "Abrir Time Sheet" → `POST /api/pontoflow/sso` → redireciona para `{TS}/sso?token=…` → cookie de sessão TS → tela de ponto. Se flag=false: mensagem "Seu cadastro não está habilitado para Time Sheet".

**Portal → TS (adapter)**:
```ts
// src/lib/timesheet-integration/client.ts
const ts = await getTimesheetClient();            // getCredential + parseSafeUrl
await ts.putPerson({ externalId, email, displayName, cpf, active, schedule }, { idempotencyKey });
const { url } = await ts.createSsoLink({ externalId });
const sheets = await ts.listTimesheets({ externalId, from, to });   // leitura p/ resumo
```

**TS → Portal (webhook)**: `POST /api/webhooks/pontoflow` com `X-PontoFlow-Signature: t=…,v1=hmac_sha256(t.body)`; eventos `person.provisioned|person.deactivated|timesheet.submitted|timesheet.approved|timesheet.rejected|period.locked`.

## 5. Tipos (esboço — corpos "not implemented")

```ts
// ===== TS: packages ou web/src/lib/integration/v1/types.ts (contrato público) =====
export type ISODate = string; // YYYY-MM-DD
export type WorkSchedule =
  | { kind: 'pattern'; daysOn: number; daysOff: number; anchor: ISODate } // 14x14, 28x28…
  | { kind: 'weekly'; workdays: (1|2|3|4|5|6|7)[] };                       // onshore 5x2
export interface PersonUpsert {
  externalId: string;        // obrigatório, único por tenant
  email: string;
  displayName: string;
  cpf?: string;              // 11 dígitos; só reconciliação
  active: boolean;
  schedule?: WorkSchedule;   // ausente => default do tenant
  managerExternalId?: string;// v1.1
  attributes?: Record<string, string>; // livre (empresa, embarcação…) — opaco ao TS
}
export interface PersonResult { employeeId: string; externalId: string; state: 'invited'|'active'|'inactive'; created: boolean }
export type IntegrationEvent =
  | { id: string; type: 'person.provisioned'|'person.deactivated'; externalId: string; at: string }
  | { id: string; type: 'timesheet.submitted'|'timesheet.rejected'; externalId: string; timesheetId: string; periodStart: ISODate; periodEnd: ISODate; at: string }
  | { id: string; type: 'timesheet.approved'; externalId: string; timesheetId: string; periodStart: ISODate; periodEnd: ISODate; workedDays: number; workedMinutes: number; at: string };

// ===== Portal: src/lib/timesheet-integration/types.ts =====
export type SyncState = 'none'|'pending'|'active'|'inactive'|'error';
export interface OutboxJob { id: string; colaboradorId: string; desired: 'active'|'inactive'; attempts: number; nextAttemptAt: string }
export interface TimesheetClient {
  putPerson(p: PersonUpsert, o: { idempotencyKey: string }): Promise<PersonResult>;   // throw new Error('not implemented')
  createSsoLink(p: { externalId: string }): Promise<{ url: string; expiresAt: string }>;
  listTimesheets(p: { externalId: string; from: ISODate; to: ISODate }): Promise<TimesheetSummary[]>;
}
export function mapColaboradorToPerson(c: ColaboradorRow, active: boolean): PersonUpsert; // pseudocódigo: seção 6
export async function enqueueSync(colaboradorId: string, desired: 'active'|'inactive'): Promise<void>; // upsert outbox (1 pendente/colab)
export async function drainOutbox(limit = 25): Promise<{ ok: number; failed: number; dead: number }>; // SKIP LOCKED
export function verifyWebhook(rawBody: string, header: string, secret: string, toleranceSec = 300): boolean; // timingSafeEqual
```

`mapColaboradorToPerson` (pseudocódigo):
```
email = users_unified.email via user_id ; sem user_id ou sem email → erro "sem_login" (job dead, status=error)  // payroll_employees não tem login
empresa = c.empresa_id ; sem config em ts_empresa_config → erro "empresa_sem_tenant"
se regime em {14x14,21x21,28x28,7x7} (NxN, parseNxNPair) e escala_embarque/folga > 0:
  schedule = pattern(on=escala_embarque, off=escala_folga, anchor = data_embarque do evento de embarque mais recente (gt_historico_embarques))  // sem evento → erro "sem_ancora"
senão (onshore, administrativo, sem_escala, sem escala): schedule = weekly([1,2,3,4,5])   // administrativo normal, sempre explícito
active = flag && c.ativo (desligado = false)
```

## 6. Mapa de módulos

### 6.1 Time-Sheet (produto) — novo/alterado
| Arquivo | Mudança |
|---|---|
| `web/migrations/ADD-INTEGRATION-API-V1.sql` | external_id, api keys, idempotência, webhooks, sso tokens (seção 7) |
| `web/src/lib/integration/v1/{types,auth,idempotency,people,webhooks,sso}.ts` | domínio da API (puro + store) |
| `web/src/app/api/integration/v1/people/route.ts` | `PUT` upsert; `GET` lista |
| `web/src/app/api/integration/v1/people/[externalId]/route.ts` | `GET`, `PATCH active` |
| `web/src/app/api/integration/v1/sso/route.ts` | `POST` cria link; `web/src/app/sso/route.ts` consome token e seta cookie via `generateToken` existente |
| `web/src/app/api/integration/v1/timesheets/route.ts` | `GET` leitura (por externalId/período) |
| `web/src/app/api/integration/v1/webhook-endpoints/route.ts` | CRUD endpoints |
| `web/src/app/api/cron/webhook-dispatch/route.ts` | entrega outbox (backoff 2^n, dead após 8) |
| `web/src/app/api/integration/v1/openapi.json/route.ts` | spec |
| `web/src/app/[locale]/admin/integrations/**` | UI TENANT_ADMIN: gerar/revogar chave (mostrada 1x), endpoints, últimos eventos |
| `packages/sdk` (fase 5) | cliente tipado gerado do OpenAPI |
| Hooks: transições `submit/approve/reject/lock` | emitem linha no `integration_webhook_events` (mesma transação) |

### 6.2 Portal — novo/alterado
| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20261006_000001_timesheet_integration.sql` | seção 7.2 |
| `src/lib/gestao-tripulantes/colaborador-cadastro.ts` | `contabilizar_timesheet` em `ALLOWED_COLAB_FIELDS` + `BOOLEAN_COLAB_FIELDS` |
| `src/components/gestao-tripulantes/ColaboradorCadastroForm.tsx` | checkbox + badge de `timesheet_sync_status` |
| `src/app/api/gestao-tripulantes/colaboradores/route.ts` e `[id]/route.ts` | após persistir: se flag mudou → `enqueueSync` (best-effort, não falha o save) |
| `src/lib/timesheet-integration/{types,mapper,client,outbox,worker,webhooks,settings}.ts` | adaptador (pure libs) |
| `src/app/api/cron/timesheet-sync/route.ts` | drena outbox + reconciliação noturna (CRON_SECRET / admin Bearer) |
| `src/app/api/webhooks/pontoflow/route.ts` | ingress HMAC, dedup `ts_webhook_events_seen`, upsert `ts_timesheet_resumo` |
| `src/app/api/pontoflow/sso/route.ts` | `verifyRequestToken` → colaborador → `createSsoLink` |
| `src/app/ponto/page.tsx` | troca link-out Ahgora por: botão Abrir Time Sheet + resumo do período corrente |
| `src/app/admin/integracoes/timesheet/page.tsx` | settings (URL, chave, segredo webhook), status da fila, botão "Sincronizar agora" (dryRun) |
| `src/i18n/locales/{pt-BR,en-US}.ts` | strings; rodar `npm run validate:i18n` |
| `src/config/modules.ts:135` | descrição/href do módulo `ponto` |

Credenciais: `getCredential('timesheet.base_url' | 'timesheet.api_key' | 'timesheet.webhook_secret')`; URL validada por `parseSafeUrl` (allowlist de host).

## 7. Migrations

### 7.1 TS — `ADD-INTEGRATION-API-V1.sql`
```sql
alter table public.employees
  add column if not exists external_id text,
  add column if not exists cpf text,
  add column if not exists active boolean not null default true,
  add column if not exists deactivated_at timestamptz;
create unique index if not exists employees_tenant_external_uidx
  on public.employees (tenant_id, external_id) where external_id is not null;

alter table public.tenants
  add column if not exists auth_mode text not null default 'password' check (auth_mode in ('password','sso_only'));

create table if not exists public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null, key_prefix text not null,
  key_hash text not null unique,                     -- sha256; segredo mostrado 1x
  scopes text[] not null default '{people:write,timesheets:read,sso:create}',
  allowed_cidrs text[], revoked_at timestamptz, last_used_at timestamptz,
  created_at timestamptz not null default now());

create table if not exists public.integration_idempotency_keys (
  tenant_id uuid not null, key text not null, request_hash text not null,
  response_json jsonb not null, created_at timestamptz not null default now(),
  primary key (tenant_id, key));                     -- TTL 24h (limpeza no cron)

create table if not exists public.integration_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null, secret_enc text not null, event_types text[] not null,
  enabled boolean not null default true, created_at timestamptz not null default now());

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, endpoint_id uuid not null references public.integration_webhook_endpoints(id) on delete cascade,
  type text not null, payload_json jsonb not null,
  attempts int not null default 0, next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz, dead_at timestamptz, last_error text,
  created_at timestamptz not null default now());
create index if not exists iwe_pending_idx on public.integration_webhook_events (next_attempt_at)
  where delivered_at is null and dead_at is null;

create table if not exists public.integration_sso_tokens (
  token_hash text primary key, tenant_id uuid not null, employee_id uuid not null,
  expires_at timestamptz not null);                  -- consumo: DELETE … RETURNING, expires_at > now()
```
Obs.: congelar CHECK de `timesheet_entries.tipo` e vocabulário de status numa migration canônica (fase 0).

### 7.2 Portal — `20261006_000001_timesheet_integration.sql`
```sql
alter table public.gt_colaboradores
  add column if not exists contabilizar_timesheet boolean not null default false,
  add column if not exists timesheet_sync_status text not null default 'none'
    check (timesheet_sync_status in ('none','pending','active','inactive','error')),
  add column if not exists timesheet_sync_error text,
  add column if not exists timesheet_synced_at timestamptz;

create table if not exists public.ts_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.gt_colaboradores(id) on delete cascade,
  desired text not null check (desired in ('active','inactive')),
  attempts int not null default 0, next_attempt_at timestamptz not null default now(),
  last_error text, dead_at timestamptz, created_at timestamptz not null default now());
create unique index if not exists ts_outbox_one_pending
  on public.ts_integration_outbox (colaborador_id) where dead_at is null;   -- coalesce: último desired vence

create table if not exists public.ts_empresa_config (          -- 1 tenant TS por empresa
  empresa_id uuid primary key, ts_tenant_slug text not null,   -- credenciais em app_secrets: timesheet.<empresa_id>.{base_url,api_key,webhook_secret}
  enabled boolean not null default true, created_at timestamptz not null default now());

create table if not exists public.ts_people_map (
  colaborador_id uuid primary key references public.gt_colaboradores(id) on delete cascade,
  empresa_id uuid not null, ts_employee_id uuid not null, last_payload_hash text, synced_at timestamptz not null default now());

create table if not exists public.ts_webhook_events_seen (event_id uuid primary key, received_at timestamptz not null default now());

create table if not exists public.ts_timesheet_resumo (
  colaborador_id uuid not null references public.gt_colaboradores(id) on delete cascade,
  period_start date not null, period_end date not null, ts_timesheet_id uuid not null,
  status text not null, worked_days int, worked_minutes int, updated_at timestamptz not null default now(),
  primary key (colaborador_id, period_start, period_end));
```
RLS: tabelas `ts_*` só service-role (padrão do portal).

## 8. Contrato API v1 (TS)

Auth: `X-API-Key: pf_live_…` (hash sha256 lookup; escopo; CIDR opcional). Erros: `{ error: { code, message, details? } }`. Todas respostas `X-PontoFlow-Api: v1`.

| Método/rota | Comportamento |
|---|---|
| `PUT /api/integration/v1/people` | upsert por `(tenant, externalId)`; `Idempotency-Key` obrigatório. Ordem de busca: external_id → cpf → email (se achar por email sem external_id, **vincula**; se email pertence a outro external_id → 409 `email_conflict`). Em tenant `password` cria convite (fluxo existente); em `sso_only` cria só employee+perfil, sem convite/senha. `active:false` ⇒ `deactivated_at`, bloqueia timesheets novos. Idempotente. Suporta `?dryRun=true`. |
| `GET /people/{externalId}` | estado (`active/inactive`). |
| `POST /sso` `{externalId}` | cria token único (`DELETE…RETURNING`, 60 s) → `{url}`; 404 se inativo. |
| `GET /timesheets?externalId&from&to` | resumo (status, período, workedDays, workedMinutes). |
| `POST/GET/DELETE /webhook-endpoints` | gerenciamento (ou só via UI admin). |
| Eventos | HMAC `X-PontoFlow-Signature: t=<unix>,v1=<hex>`; entrega at-least-once; consumidor dedup por `id`; backoff `2^n`, dead após 8. |
| `GET /openapi.json` | contrato. |

Mudança de contrato breaking ⇒ `/v2` (v1 mantido).

## 9. Fluxos

1. **Flag on**: save cadastro → `enqueueSync(active)` + status `pending` → cron/worker (25/lote, `FOR UPDATE SKIP LOCKED`; também dispara logo após o save via `after()`) → resolve a empresa (`ts_empresa_config` por `empresa_id`) → `putPerson` no tenant da empresa → grava `ts_people_map`, status `active`. **Sem convite e sem senha**: tenant em `sso_only`, acesso só via SSO do portal.
2. **Flag off**: `enqueueSync(inactive)` → `active:false`. Reativar = mesmo `externalId` (sem duplicar). **Troca de empresa**: desativa no tenant antigo e cria no novo.
3. **Alteração de dados** (email/escala/regime/nome): mudança de hash do payload → `enqueueSync`.
4. **Abrir ponto**: `/ponto` → `POST /api/pontoflow/sso` → `createSsoLink` → redirect.
5. **Retorno**: `timesheet.approved` → webhook → `ts_timesheet_resumo`; reconciliação noturna puxa `GET /timesheets` do período corrente/anterior (cobre webhook perdido).
6. **Reconciliação noturna**: para todos `contabilizar_timesheet=true` com hash ≠ último enviado ou `error` → reenfileira; guarda anti-massa: se > 20% dos ativos passariam a inativos num run, aborta e alerta.
7. **Falhas**: TS fora ⇒ salvar cadastro nunca falha; job tenta com backoff; `dead` após 8 → `timesheet_sync_status='error'` visível; botão "Reprocessar". Webhook com assinatura inválida/skew > 5 min → 401. Replays → no-op.

## 10. Fases (cada uma com critério de aceite verificável)

| Fase | Entrega | Check |
|---|---|---|
| **0 — Desacoplar TS** (TS repo) | rodapé/branding por tenant; prazo default configurável (remover 16 fixo); entrega DP → config por tenant (remover default ABZ); sync users_unified e fallback bcrypt desligados por padrão (opt-in "legacy import"); `JWT_SECRET` fail-fast; appId do Capacitor por config; Omega como exportador opcional; `tenants.auth_mode` (`password`\|`sso_only`); `web/vercel.json` com `crons` (webhook-dispatch); congelar schema canônico (`tipo`, status) | Projeto Supabase novo sobe via setup-wizard sem string "ABZ"; boot sem `JWT_SECRET` falha; tenant `sso_only` rejeita login por senha; testes TS existentes verdes |
| **1 — Integration API v1** (TS) | migration 7.1, auth por chave, idempotência, `people` PUT/GET, openapi, UI admin de chaves | `curl` sem chave→401; mesmo `Idempotency-Key` 2× → mesma resposta, 1 employee; email conflitante → 409; `dryRun` não grava |
| **2 — SSO + leitura + webhooks** (TS) | `sso` (token 60s, único uso), `timesheets` GET, webhook endpoints + dispatcher | token reutilizado→401; expirado→401; evento approve gera 1 linha/endpoint; dispatcher retenta e marca dead |
| **3 — Flag + outbox no portal** | migration 7.2, whitelist+checkbox+i18n, `enqueueSync`, cron `timesheet-sync`, settings admin | `PUT colaborador` flag true cria 1 job; toggle 2× converge a 1 job; TS offline → save OK + job com `attempts>0`; `npm run validate:i18n` verde |
| **4 — Ponto no portal** | `/ponto` com SSO + resumo; webhook ingress; `ts_timesheet_resumo` | piloto 5 pessoas (2 offshore 14x14/28x28, 3 onshore): abrir via portal, bater ponto, submeter, aprovar → resumo aparece; replay do webhook = no-op; HMAC inválido → 401 |
| **5 — SDK** | `@pontoflow/sdk` gerado do OpenAPI; portal troca fetch manual pelo SDK | contrato testes do portal passam contra TS real (staging) |
| **6 — Cutover** | desligar link Ahgora; reconciliação noturna ativa; runbook | 1 período completo dual-run: workedDays TS × relatório Ahgora do grupo piloto conciliam |
| **7 — Produto (opcional)** | roster-pull genérico (conector CSV/JSON com `dryRun`, `deactivateAfterAbsences`, guarda 20%); signup self-service de tenant; docs públicas | tenant novo cria chave+pessoa+timesheet sem o portal presente |

Ordem crítica: 0 ∥ 1 → 2 → 3 → 4 → 6; 5 e 7 fora do caminho crítico.

## 11. Checklist de desacoplamento (aceite "produto externo")

- [ ] `grep -ri "abz"` no TS retorna só histórico/changelog/branding opcional.
- [ ] Nenhum código TS lê tabela do portal; nenhuma env do portal.
- [ ] Auth do TS funciona sem `users_unified`.
- [ ] Portal usa só rotas `/api/integration/v1/*` + webhooks (nunca DB do TS).
- [ ] `LICENSE` e `LICENSE-COMMERCIAL.md` alinhados com a titularidade do dono (antes da 1ª venda).
- [ ] OpenAPI publicado + changelog de versão.

## 12. Síntese da arena

- **A (contrato/API)** = base: único que casa "produto externo" com integração real sem refactor do monólito.
- **B (engine+SDK, UI nativa)**: rejeitado como base (refactor enorme do TS antes de qualquer valor; UI de ponto duplicada com biometria/offline no mobile). Aproveitado: SDK gerado (fase 5), separação de portas, `workedDays` calculado no TS.
- **C (pull federado)**: rejeitado como caminho primário (latência e login separado); aproveitados: `dryRun`, guarda anti-desativação em massa (20%), hash de payload/no-op, conector roster-pull como feature de produto (fase 7), nunca deletar.
- Telas red-flag: sem módulo raso (portal tem 1 `enqueueSync` + 1 `createSsoLink`), sem vazamento (TS não conhece `gt_colaboradores`), sem decomposição temporal.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Arquivos `LICENSE`/`LICENSE-COMMERCIAL.md` divergentes | venda só pelo dono; alinhar os arquivos antes da 1ª venda (baixa prioridade) |
| Troca de empresa do colaborador (tenant por empresa) | desativa no tenant antigo, cria no novo (mesmo `externalId`); histórico fica no tenant antigo |
| App mobile do TS sem senha (modo `sso_only`) | pendência B |
| Chave de integração vazada | escopos mínimos, CIDR opcional, hash, rotação, last_used_at |
| Colisão de e-mail entre pessoas | 409 + status `error` visível; resolução manual |
| Escala sem âncora (data início do ciclo) | job `dead` com motivo `sem_ancora`; exigir campo no cadastro |
| Soft-tenancy no TS (service-role) | toda rota v1 filtra `tenant_id` da chave; teste de isolamento obrigatório (fase 1) |
| Drift de schema TS | congelar migration canônica na fase 0 |
| LGPD (CPF/regime a segundo operador) | CPF opcional na API; ABZ decide enviar; revisar DPA antes da fase 4 |
| Webhook perdido | reconciliação noturna |

## 14. Decisões do negócio (respondidas em 2026-10-05) e pendências

| # | Decisão | Impacto no plano |
|---|---|---|
| 1 | Onshore só em `payroll_employees` **não entra**. Verificado no código: `payroll_employees` não tem e-mail nem login (`colaborador-merge.ts:20-21`); o login mora em `gt_colaboradores.user_id → users_unified`. Sem GT/login não há SSO. Quem precisa de ponto tem que ter cadastro no GT. (Não consultei contagens no banco.) | Flag só em `gt_colaboradores`. Mapper recusa quem não tem `user_id`/e-mail (`sem_login`). |
| 2 | **1 tenant do TS por empresa** (`gt_colaboradores.empresa_id`). | Tabela `ts_empresa_config`; credenciais e webhook por empresa; `ts_people_map` e outbox chaveados por empresa; troca de empresa = desativa no tenant antigo + cria no novo. |
| 3 | **Gerente/aprovador configurado no TS.** | `managerExternalId` sai do escopo (fica fora do v1). |
| 4 | A **escala cadastrada no portal vai para o TS**; quem **não tem escala** é tratado como **administrativo normal** (seg–sex). | Mapper sempre envia `schedule` explícito (nunca "default do tenant"). Âncora do ciclo: ver pendência A. |
| 5 | **Só login do portal** nos dois sistemas. | Tenants integrados em `auth_mode='sso_only'`: sem senha, sem convite por e-mail, sem login por senha no TS. Ver pendência B (app mobile). |
| 6 | Tudo roda na **Vercel**. | TS passa a ter `web/vercel.json` com `crons` (hoje é `{}`); sem Netlify/Express. Ver pendência C. |
| 7 | O que decide quem entra é **só o check** no cadastro (não o regime). | Offshore, onshore e administrativo com check entram; sem check não entram. |
| 8 | Licença: venda só pelo dono/criador. | Tirado do caminho crítico. Resta só alinhar os arquivos `LICENSE` antes de vender (baixa prioridade). |

### Pendências reais (únicas que ainda travam algo)

- **A — Âncora do ciclo NxM.** O portal guarda só *quantos dias* (`escala_embarque`/`escala_folga`), não a data de início. A data existe no histórico: `gt_historico_embarques.data_embarque` / `data_desembarque` (`embarque-status.ts`), além de `data_ultimo_embarque` e `data_proximo_embarque` no cadastro. Proposta: âncora = `data_embarque` do evento de embarque mais recente (ou o corrente). Sem nenhum evento ⇒ job com erro `sem_ancora`, visível no cadastro. Confirma?
- **B — App mobile do TS (biometria/offline).** Com "só login do portal", o app não terá senha. Opções: (1) mobile abre o portal por deep link/webview para SSO; (2) mobile fica fora do escopo e o ponto é marcado só pelo web via portal. O portal hoje não tem shell mobile próprio. Qual?
- **C — Plano Vercel.** Crons a cada poucos minutos exigem plano Pro (Hobby só diário). Se for Hobby, o portal tenta enviar logo após salvar o cadastro (`after()`), e o cron diário só repesca falhas. O plano é Pro?
