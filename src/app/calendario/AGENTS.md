# Calendário — DOX

## Purpose

`/calendario` mostra feriados oficiais (Brasil/Macaé ou UK) e eventos do calendário compartilhado da empresa (ICS). Não mistura operação GT/MIO.

## Ownership

- UI: `src/app/calendario/page.tsx`
- ICS: `GET /api/calendar/company/events` (`src/app/api/calendar/company/events/route.ts`)
- Config admin: `GET /api/admin/calendar/company/settings`, `settings.company_calendar`
- Widget do dashboard: `EventsWidget` (futuros, `rangeDays=30`) — contrato separado

## Local Contracts

- **Viewport**: raiz preenche a coluna do `MainLayout`; grade + lista do mês em `flex-1 min-h-0 overflow-auto` (preferir `dvh` no shell).
- **Não** chamar `/api/mio/calendar`, `gt_historico_embarques`, treinamentos/ASO ou qualquer evento operacional
- Fontes permitidas: feriados (BrasilAPI / scrape / estático + municipais Macaé; `en-US` = UK) + ICS da empresa
- Lista e bolinhas do mês: só essas fontes. Legenda: nacional, municipal, calendário compartilhado
- Dedupe de exibição (não apaga o ICS): título semelhante + mesmo início (minuto / dia inteiro) + local compatível → um evento; fica o registro mais rico (descrição, participantes, url). Ver `src/lib/calendar-event-dedupe.ts`
- Datas civis locais (`YYYY-MM-DD`), sem `toISOString().split('T')[0]`
- Página do ano: `GET /api/calendar/company/events?from={ano}-01-01&to={ano}-12-31` (inclui eventos já ocorridos no ano)
- Sem `from`/`to`, a API continua filtrando a partir de hoje + `rangeDays` (dashboard / testes admin)

## Work Guidance

- Visual: header e cards no padrão do portal (`rounded-2xl`, `border-gray-200`, ícone em `bg-blue-50` / `text-abz-blue`)
- Não reintroduzir tipos Embarque / Curso / vencido nesta tela

## Verification

- `/calendario` não lista EMBARQUE, CURSO nem documentos vencidos
- Agosto (ou mês corrente) lista feriados + eventos ICS; clique no dia destaca a lista
- Eventos com nome semelhante no mesmo horário e local aparecem uma vez
- Dashboard EventsWidget segue mostrando só futuros do ICS

## Child DOX Index

_(none)_
