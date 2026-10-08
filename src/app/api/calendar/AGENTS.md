# Calendar API — DOX

## Purpose

Endpoints do calendário compartilhado (ICS) usados pelo portal e pelo admin.

## Ownership

- `src/app/api/calendar/company/events/route.ts`
- `src/app/api/calendar/company/notify/route.ts`, `src/app/api/calendar/events/route.ts`
- Settings: `src/app/api/admin/calendar/company/settings`

## Local Contracts

- `GET /api/calendar/company/events`
  - Auth obrigatória **antes** de settings, fetch ICS ou cache: `Authorization: Bearer` via `extractTokenFromHeader`, fallback cookie `abzToken` / `token`, validado com `verifyToken`. Sem token ou sem `payload.userId` → 401 `{ error: 'Unauthorized' }`. Cache em memória não é servido sem auth.
  - Sem `from`/`to`: eventos a partir de hoje até `rangeDays` (default 365)
  - Com `from` e/ou `to` (`YYYY-MM-DD`): janela civil explícita (página `/calendario` usa o ano inteiro)
  - Cache em memória 5 min, chave inclui URL + janela
  - Resposta: `{ events, duplicatesHidden }` — dedupe de agregação (não apaga o ICS): título semelhante + mesmo início + local compatível; fica o registro mais rico (`src/lib/calendar-event-dedupe.ts`)
  - Fetch ICS só `https:` + host allowlist: `calendar.google.com` (DEFAULT_GCAL_URL) e o host de `COMPANY_CALENDAR_ICS_URL` se for https público. `?url=` / settings fora disso → 400 `ICS URL não permitida.`
  - Não servir embarques, cursos ou `gt_*` nestas rotas

- `GET|PUT /api/admin/calendar/company/settings`: ADMIN/MANAGER ou grant `calendario.company.config` (`withPermissionOrGrant`)
- `GET|POST|PUT|DELETE /api/calendar/events` (agenda pessoal `calendar_events`): `requireAuth` (401 sem token). Dono (`userId` default = logado; PUT/DELETE pelo `user_id` do evento) sempre; terceiro só ADMIN/MANAGER ou grant `calendario.manage` / `calendario.create|update|delete`. Callers usam `fetchWithToken`
- `POST /api/calendar/company/notify` (lembrete por e-mail): `CRON_SECRET` (`Authorization: Bearer` ou `x-cron-secret`, `hasCronOrSetupSecret`) **ou** login ADMIN/MANAGER / grant `calendario.notify`. Agendador legado `netlify/functions/company-notify.ts` envia o `CRON_SECRET`; não há cron Vercel para esta rota

## Work Guidance

- Widget do dashboard e teste admin não devem passar `from`/`to` a menos que queiram histórico

## Verification

- `rangeDays=30` sem `from` → só futuros
- `from`/`to` no ano corrente → inclui eventos passados daquele intervalo
- ICS com VEVENTs duplicados (mesmo horário/local, título quase igual) → um item em `events`
- `npx tsx --test src/app/api/calendar/company/events/events.test.ts` — Google ICS passa; host estrangeiro / IP privado / `javascript:` não disparam fetch; sem token / token inválido → 401; cache quente sem token → 401
- `npx tsx --test src/app/api/auth-required-routes.test.ts` — calendar/events (4 métodos) e company/notify sem token → 401 sem tocar banco; notify com `CRON_SECRET` errado 401, certo passa do gate

## Child DOX Index

_(none)_
