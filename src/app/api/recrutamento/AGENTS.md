# Recrutamento / InHire

## Purpose
Módulo de recrutamento: espelha vagas e candidatos do InHire (`rc_vagas`, `rc_prospectos`) e converte prospectos.

## Local Contracts

### Auth InHire — comportamento real (difere do manual docs.inhire.com.br/guides/auth)
- `POST https://auth.inhire.app/login` exige header `X-Tenant` (sem ele: `400 Missing required request parameters: [X-Tenant]`).
- `POST /refresh` aceita **somente** `refreshToken` no body; enviar `accessToken` junto = `400` schema. Resposta traz novo `accessToken` + `refreshToken`.
- Respostas camelCase: `accessToken`, `refreshToken`. TTL: access 1h, refresh 30 dias.
- Tenant errado = `500 Internal server error`; tenant certo + credencial errada = `401 Invalid username or password`.
- Tenant ABZ: `abzservicos` (subdomínio `abzservicos.inhire.app`).
- Credenciais: `app_secrets` keys `inhire_email`, `inhire_password`, `inhire_tenant` (+ opcionais `inhire_api_url`, `inhire_auth_url`).

### API InHire
- Base `https://api.inhire.app` **sem** prefixo `/v1` (com `/v1` = 403 genérico de gateway).
- Vagas paginadas: `POST /jobs/paginated/lean` body `{ limit, exclusiveStartKey? }` → `{ results: [], startKey }`. Vaga: `id`, `name`, `description`, `status`, `tenantClient.name`.
- Candidatos da vaga: `POST /job-talents/:jobId/talents/paginated` body `{ limit }` → `{ jobTalents: [] }`. Pessoa em `jobTalents[].talent` (`name`, `email`, `phone`, `id`); id composto da candidatura em `jobTalents[].id`.
- Alguns GETs falham com 403 "Invalid key=value pair in Authorization" (gateway); usar os POSTs `/paginated` documentados.

### Endpoints do portal
- `POST /api/recrutamento/inhire/sync` — pull vagas + candidatos → `rc_vagas`/`rc_prospectos`. Falha de auth devolve 200 com `warning` (não derruba painel). Registros com `deleted_at` preenchido **não** são ressuscitados pelo sync.
- `POST /api/recrutamento/inhire/test-auth` — diagnóstico admin: login, refresh e chamada autenticada; nunca devolve tokens.
- `GET/POST /api/recrutamento/vagas` + `PUT/DELETE /api/recrutamento/vagas/[id]` — CRUD vagas. DELETE = soft (`deleted_at`); bloqueia (409) se houver prospecto ativo na vaga.
- `GET/POST /api/recrutamento/prospectos` + `PUT/DELETE /api/recrutamento/prospectos/[id]` — CRUD prospectos. DELETE = soft; prospecto `convertido` não pode ser excluído (409). PUT valida CPF (módulo 11), status no enum e vaga ativa. GETs filtram `deleted_at IS NULL`.
- Soft delete: coluna `deleted_at` (migration `20261002_000001_rc_recrutamento_soft_delete.sql`). Unicidade de CPF só entre ativos (`uq_rc_prospectos_cpf_ativo`).
- Permissão: `podeNivelRecrutamento(userId, role, 'manage')` para escrita, `'view'` para leitura (`src/lib/recrutamento/recrutamento-auth.ts`). 4º arg = grants que somam: `recrutamento.vagas.view` (GET vagas), `candidatos.view` (GET prospectos), `vagas.sync` (sync), `inhire.configure` (test-auth). Converter segue o gate do cadastro DP; `candidatos.advance|reject` / `precadastro.send` sem rota (o PUT edita o prospecto inteiro).
- Client InHire: `src/lib/recrutamento/inhire-client.ts` (cache de sessão em memória, retry 1x em 401, `limparSessaoInhire`).
- UI: `/department/recrutamento` — modais de edição inline + botões Editar/Excluir por linha (feature `recrutamento.manage`).

## Verification
- `node scripts/test-inhire-auth.js` com `INHIRE_EMAIL`/`INHIRE_PASSWORD`/`INHIRE_TENANT` no ambiente — prova login + refresh + `POST /jobs/paginated/lean` contra API real.
- `npx tsc --noEmit` sem erros nos arquivos do módulo.
