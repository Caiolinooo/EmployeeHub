# Time Sheet no portal — DOX

## Purpose

Liga a mesma pessoa no login, no GT, no PontoFlow (`ponto.groupabz.com`) e na folha. A batida mora no PontoFlow. A hora aprovada entra na folha do portal.

## Ownership

- `src/lib/timesheet-integration/`
- Rotas `src/app/api/pontoflow/` e `src/app/api/webhooks/pontoflow/`
- Cron `src/app/api/cron/timesheet-sync/`
- Tela `src/app/ponto/page.tsx`
- Mapa admin `src/app/admin/integracoes/timesheet/`

## Local Contracts

- Chave: `gt_colaboradores.id` = `externalId` = `ts_people_map.colaborador_id`. `payroll_employees.employee_id` guarda esse mesmo id. Empresa = `ts_empresa_config`.
- `resolveVinculoByUser` / `resolveVinculoByExternalId` (`vinculo.ts`) são o gate. CPF (`users_unified.tax_id` ou `gt_colaboradores.cpf`) e e-mail só preenchem elo vazio com um match. Dois matches = `ambiguo`. Não cria segunda pessoa e não cria `payroll_employees`.
- Motivos: `sem_colaborador`, `ambiguo`, `sem_user`, `flag_inativa`, `sem_empresa`, `sem_people_map`, `sem_folha`.
- Batida: `POST/GET /api/pontoflow/punch` só com cadeia completa. Cliente chama `POST /api/integration/v1/punches` e `GET /api/integration/v1/punches/today`. `Idempotency-Key` obrigatório. `source=portal`.
- SSO `POST /api/pontoflow/sso` também exige a cadeia completa. GET devolve o elo que falta (não 404 genérico).
- `timesheet.approved` traz `lines: [{ code, quantity }]`. Códigos: `DIAS`, `HORAS`, `HE50`, `NOTURNO`, `FALTA` (FALTA só em escala semanal). O portal não recalcula.
- O mapa do ponto é `payroll_codes.codigo_timesheet` (`DIAS`, `HORAS`, `HE50`, `NOTURNO`, `FALTA`), único, o mesmo cadastro do financeiro e do DP (`/folha-pagamento/configuracoes/codigos` e `/department/dp?tab=rubricas`). Sem código na rubrica = aviso em `folha_motivo`, sem rubrica inventada.
- Itens: `payroll_sheet_items.origem='timesheet'`. Regrava só essa origem, na sheet `draft` da competência de `period_end`. Sheet `approved`, `paid` ou `calculated` não muda (`sheet_fechada`). Sem folha vinculada: resumo `folha_status=pendente`, motivo `sem_folha`.
- Sync WK continua apagando só `origem='wk'`.
- Cron noturno (`reconcile=true`) preenche login e `employee_id` vazios e enfileira quem tem flag e ainda não tem `ts_people_map`, antes do drain.

## Work Guidance

- Não gravar batida bruta no Supabase do portal.
- Não mandar hora para o WK Radar.
- Não trocar `user_id` ou `payroll_employees.employee_id` já preenchidos.

## Verification

- `npx tsx --test src/lib/timesheet-integration/vinculo.test.ts src/lib/timesheet-integration/folha-lancamento.test.ts`

## Child DOX Index

- (nenhum)
