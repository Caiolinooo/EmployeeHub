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
- `resolveVinculoByUser` / `resolveVinculoByExternalId` (`vinculo.ts`) são o gate. CPF (`users_unified.tax_id` ou `gt_colaboradores.cpf`), e-mail e telefone (últimos 11 dígitos de `phone_number` / `telefone` / `telefone_2`) só preenchem elo vazio com um match. Dois matches = `ambiguo`. Não cria segunda pessoa e não cria `payroll_employees`. Troca `user_id` já preenchido só quando o elo atual é o login do e-mail pessoal gravado no cadastro, o login atual tem o mesmo telefone e pelo menos dois nomes em comum (`podeReassumirLogin`).
- Motivos: `sem_colaborador`, `ambiguo`, `sem_user`, `flag_inativa`, `sem_empresa`, `sem_people_map`, `sem_folha`.
- Batida: `POST/GET /api/pontoflow/punch` só com cadeia completa e JWT. Cliente chama `POST /api/integration/v1/punches` e `GET /api/integration/v1/punches/today`. `Idempotency-Key` obrigatório. `source=portal`. O horário da batida é o relógio do servidor (`America/Sao_Paulo` na tela). O body não aceita `at` do browser.
- Biometria: `POST` sem asserção WebAuthn válida não grava batida. O browser pede a passkey já cadastrada (`POST /api/auth/webauthn/sign/options`, `userVerification: required`) e manda a asserção no mesmo `POST /punch`. `verificarAssercaoPonto` confere desafio, credencial do usuário e flag UV. Prova em `ts_punch_biometric` (`method=webauthn`, `credential_id`, `user_verified`, `device_type`, `origin`). Sem template, sem `clientDataJSON`, sem assinatura. RLS ligado, sem policy anon.
- Expediente: dois botões. Sem início, só início. Com início aberto, só fim. Com fim, os dois ficam desligados. `rejeitarBatida` repete essa regra na API.
- Almoço: `calcularJornada` desconta a sobreposição com 12:00–13:00 (meio-aberto). Turno fora dessa janela não perde hora. Não há batida de almoço no PontoFlow.
- Aviso: dia encerrado com líquido menor que 8h mostra aviso na tela `/ponto`. Não bloqueia a batida. 8h exatas não avisam. Dia em aberto não avisa.
- `Hoje:` usa `horaIni`/`horaFim` do PontoFlow, ou o instante da batida em `America/Sao_Paulo` quando o retorno vier sem relógio.
- `GET|PUT /api/pontoflow/settings`: ADMIN ou grant `ponto.settings.manage` (default ADMIN). Batida/SSO seguem só JWT + cadeia (ações `ponto.punch`/`view_own` não viram gate).
- SSO `POST /api/pontoflow/sso` também exige a cadeia completa. GET devolve o elo que falta (não 404 genérico).
- `timesheet.approved` traz `lines: [{ code, quantity }]`. Códigos: `DIAS`, `HORAS`, `HE50`, `NOTURNO`, `FALTA` (FALTA só em escala semanal). O portal não recalcula.
- O mapa do ponto é `payroll_codes.codigo_timesheet` (`DIAS`, `HORAS`, `HE50`, `NOTURNO`, `FALTA`), único, o mesmo cadastro do financeiro e do DP (`/folha-pagamento/configuracoes/codigos` e `/department/dp?tab=rubricas`). Sem código na rubrica = aviso em `folha_motivo`, sem rubrica inventada.
- Itens: `payroll_sheet_items.origem='timesheet'`. Regrava só essa origem, na sheet `draft` da competência de `period_end`. Sheet `approved`, `paid` ou `calculated` não muda (`sheet_fechada`). Sem folha vinculada: resumo `folha_status=pendente`, motivo `sem_folha`.
- Sync WK continua apagando só `origem='wk'`.
- Cron noturno (`reconcile=true`) preenche login e `employee_id` vazios e enfileira quem tem flag e ainda não tem `ts_people_map`, antes do drain.

## Work Guidance

- Não gravar batida bruta no Supabase do portal. A prova biométrica (`ts_punch_biometric`) não substitui a batida.
- O líquido do dia na tela não regrava `payroll_sheet_items`. Rubricas continuam vindo de `timesheet.approved`.
- Não mandar hora para o WK Radar.
- Não trocar `payroll_employees.employee_id` já preenchido. `user_id` já preenchido só muda em `podeReassumirLogin`.

## Verification

- `npx tsx --test src/lib/timesheet-integration/vinculo.test.ts src/lib/timesheet-integration/folha-lancamento.test.ts src/lib/timesheet-integration/jornada.test.ts`

## Child DOX Index

- (nenhum)
