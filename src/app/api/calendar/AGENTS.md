# Calendar API — DOX

## Purpose

Endpoints do calendário compartilhado (ICS) usados pelo portal e pelo admin.

## Ownership

- `src/app/api/calendar/company/events/route.ts`
- Settings: `src/app/api/admin/calendar/company/settings`

## Local Contracts

- `GET /api/calendar/company/events`
  - Sem `from`/`to`: eventos a partir de hoje até `rangeDays` (default 365)
  - Com `from` e/ou `to` (`YYYY-MM-DD`): janela civil explícita (página `/calendario` usa o ano inteiro)
  - Cache em memória 5 min, chave inclui URL + janela
  - Resposta: `{ events, duplicatesHidden }` — dedupe de agregação (não apaga o ICS): título semelhante + mesmo início + local compatível; fica o registro mais rico (`src/lib/calendar-event-dedupe.ts`)
  - Fetch ICS só `https:` + host allowlist: `calendar.google.com` (DEFAULT_GCAL_URL) e o host de `COMPANY_CALENDAR_ICS_URL` se for https público. `?url=` / settings fora disso → 400 `ICS URL não permitida.`
- Não servir embarques, cursos ou `gt_*` nestas rotas

## Work Guidance

- Widget do dashboard e teste admin não devem passar `from`/`to` a menos que queiram histórico

## Verification

- `rangeDays=30` sem `from` → só futuros
- `from`/`to` no ano corrente → inclui eventos passados daquele intervalo
- ICS com VEVENTs duplicados (mesmo horário/local, título quase igual) → um item em `events`
- `npx tsx --test src/app/api/calendar/company/events/events.test.ts` — Google ICS passa; host estrangeiro / IP privado / `javascript:` não disparam fetch

## Child DOX Index

_(none)_
