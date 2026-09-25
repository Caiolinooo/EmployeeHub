# Changelog

## [Unreleased]

## [5.88.0] - 2026-09-25

### Segurança, correções e limpeza (PRs #100, #102, #98, #106, #107, #103, #101, #96, #114)

#### Segurança

1. **Middleware no bundle e rotas de debug/admin fechadas** (#100, `bc124831`): o manifesto de produção do Next 15.5 saía sem middleware (`pages/` na raiz fazia o finder procurar no lugar errado). O `middleware.ts` volta a ir no bundle (arquivo na raiz, ao lado do `pagesDir`). GETs públicos de debug/admin — `ensure-admin`, `test-users`, `supabase-status`, `acl/init`, `execute-sql` — passam a exigir JWT ADMIN ou `CRON_SECRET`. Login deixa de chamar `GET /api/auth/ensure-admin` no mount.
2. **Mídias dos editores de notícias** (#102, `37b8ad77`): `img`/`video` `src` passam por `toSafeMediaUrl` (`src/lib/security/safe-media-url.ts`). Aceita `blob:`, `https:` e caminhos relativos; bloqueia `javascript:`, qualquer `data:` e `http:`. Sem mudança visual no fluxo válido.
3. **e-Social com TLS validado, logos e CA seguros** (#106, `36c0d0e5`): o cliente do e-Social valida a cadeia TLS por padrão (CAs do Node + raízes públicas ICP-Brasil). Logos em `/admin/settings` passam por `safeImageSrc`. Link de consulta de CA só sai de dígitos (`buildConsultaCaHref`). Sanitizers de HTML (PoliWeb e e-mail da IA) e format strings das férias deixam de interpolar dado do usuário na string de formato.
4. **Allowlist anti-SSRF nas buscas externas** (#107, `1d82e588`): fetch de saída só aceita host da allowlist. Helper em `src/lib/security/safe-url.ts`; cada rota resolve o próprio host (PoliWeb, consulta CA / CAEPI, ICS da empresa, extração de PDF). Host estrangeiro, IP privado, não-https e `javascript:` são recusados.
5. **Login sem mint ADMIN e debug PII fechado** (#96, `78d5888e`): `/login` não chama `fix-token` nem `ensure-admin`. Token no storage vai para `verify-token`. `POST /api/auth/fix-token` só entra depois que o refresh falha **e** existe sessão Supabase; sem token, JWT morto ou user 404 devolve 401/404 — não mintava mais JWT ADMIN. Também fecha `generate-token`, `fix-auth`, `debug-supabase-auth`, `execute-sql`, `test-token`, `test-users` e `test-supabase-users`.
6. **Auth no calendário e no pdf-extract** (#114, `31f9eb3b`): `GET /api/calendar/company/events` e `GET /api/pdf-extract` exigem JWT (`Authorization: Bearer` ou cookie `abzToken`/`token`, `verifyToken`) **antes** de settings, cache, allowlist ou fetch. Sem token, token inválido ou sem `userId` → **401** `{ error: 'Unauthorized' }`. Allowlist SSRF da #107 permanece.

#### Corrigido

1. **“Colaborador não encontrado” na aba QHSE/EPI** (#98, `51803cf9`): o catálogo selecionava `cargo_nome` em `gt_colaboradores` — coluna que só existe na view. PostgREST falhava e a aba devolvia 404. O select agora usa as colunas da tabela + join `cargo:gt_cargos(nome)`, no mesmo padrão da ficha e da lista.
2. **HTTP 500 na visão geral financeira com “Todas as empresas”** (#101, `ef075361`): `GET /api/financeiro/visao-geral` aplicava `.eq('empresa_id', empresaId)` mesmo sem uuid. Sem `empresaId` (vazio, `todas`, `null`) a rota agora soma todas as empresas, igual às outras rotas financeiras. Auth e shape da resposta não mudam.

#### Removido

1. **Scratch e scripts que só geravam alerta** (#103, `71bd3534`): apagados `scratch/mio_api_doc.html`, `scratch/test-ocr-aso.ts` e `scripts/discover-mio.js` (não entram no runtime). Os scripts que precisam ficar (`run-translation`, `test-evaluation-end-to-end-complete`, `test-push-notifications`) foram endurecidos no lugar — escape de string, `crypto.randomUUID` / `randomInt`, log sem valor de token.

#### Atenção ao atualizar

- Logo com URL `http://` cai no logo padrão. Só URL segura entra (`https`, relativa, `blob:`, `data:image/*`).
- e-Social exige cadeia TLS válida. `NODE_TLS_REJECT_UNAUTHORIZED=0` é só escape de emergência, não configuração normal.
- Buscas externas só aceitam host da allowlist em `src/lib/security/safe-url.ts` (e o resolvedor de cada rota). Host fora da lista deixa de responder.
- Sessão morta no storage não “recupera” via mint ADMIN. Login usa `verify-token`; `fix-token` só depois do refresh falhar com sessão Supabase viva. Relogin em `/api/auth/login`.
- Visão geral financeira sem empresa (filtro “Todas as empresas”) soma todas as empresas; não devolve mais 500.
- `GET /api/calendar/company/events` e `GET /api/pdf-extract` deixam de responder a anônimo. Sem autenticação válida → **401**.

## [5.87.2] - 2026-09-23

### UI Folha/Financeiro no padrão ABZ e rotas restauradas

1. **MainLayout na folha**: `src/app/folha-pagamento/layout.tsx` passa a usar `MainLayout` (sidebar + topbar, alinhado a `/department/dp`), mantendo o gate `ProtectedRoute moduleName="folha_pagamento"`. O menu lateral volta a ser exibido em `/folha-pagamento`.
2. **Fim do loop de redirect nas rotas da folha**: `/folha-pagamento/sheets`, `/nova`, `/funcionarios` e `/empresas` deixam de chamar `redirect('/folha-pagamento?tab=...')`.
   - `sheets` e `nova` renderizam `DpFolhaPanel` (o motor operacional da folha).
   - `funcionarios` renderiza a lista de colaboradores via `EmployeeList` autenticado (`fetchWithToken`).
   - `empresas` renderiza o CRUD completo via `EmpresasTab`.
3. **Cards brancos no padrão ABZ**: `FIN_CARD_CLASS` em `shared.tsx` agora usa `bg-white` (sem `dark:bg-gray-800`), eliminando o contraste escuro no tema claro. Links de folhas recentes e nova folha apontam diretamente para `/department/dp?tab=folha`. A página do DP passa a reconhecer o parâmetro `?tab=` via deep-link.

## [5.87.1] - 2026-09-23

### TypeScript da onda A1/NFS-e fecha de verdade

1. **Rota do A1 compilava no caminho errado**: GET /api/financeiro/certificado-a1 importava ../../_lib/http (cai em api/_lib, que nao existe). Agora usa ../_lib/http — o helper compartilhado de /api/financeiro.
2. **Parser das CompNfse**: o fallback ?? [] virava never[] e o blocos.push quebrava o tsc. Tipado como string[]. npx tsc --noEmit integral 0 erros; 57/57 testes A1+NFS-e.

## [5.87.0] - 2026-09-23

### Certificado A1 unico, NFS-e Macae no padrao SPE e skills do Cursor no repo

1. **A1 unico da empresa**: o mesmo certificado ICP-Brasil do e-Social (tabela esocial_certificados) autentica a SPE de Macae. Sem segundo upload no financeiro; rota /api/financeiro/certificado-a1 so le metadados (nunca a senha).
2. **RPS alinhado as 30 notas reais da SPE**: nacional usa tag Endereco (nao Logradouro), LC 116 17.01 com ponto, CNAE 7020400, NBS 114011300, IBSCBS e competencia YYYY-MM-DD. Exportacao: MotivoNifNaoInformado, CodigoPais, exigibilidade 4, ISS 0, NBS 114011900, sem IBSCBS. Parser le o tomador da declaracao -- nao o prestador.
3. **Consulta somente-leitura**: ConsultarNfseServicoPrestado em janelas de 30 dias, mTLS do A1, operacoes Recepcionar/Gerar/Cancelar bloqueadas. URLs oficiais da SPE em fin_municipios 3302403. Emissao continua desligada.
4. **Skills do Cursor no projeto**: 30 skills oficiais + do usuario (incluindo sobe-o-git) em .cursor/skills, versionadas com o repo.

## [5.86.0] - 2026-09-21

### Folha paga administrativos, salários preenchidos e contracheque imprimível

1. **Administrativos na folha**: colaborador sem rotação (escala 0 — administrativo, onshore, sem escala) sem movimento offshore no mês recebe a rubrica 001 com os dias ativos do período (mês cheio ou proporcional admissão/demissão). Caio, Aislan, Ericka e os demais da ABZ passam a calcular junto com os marítimos. Offshore com escala NxN que ficou em casa o mês inteiro não entra — a folga continua informativa.
2. **57 salários preenchidos**: moda da remuneração mensal do backup WK repetida ≥2x nos últimos 12 meses (sinal forte de salário fixo — incluindo os aprendizes de R$ 761,55). Offshore variável (moda única) fica vazio de propósito: um valor qualquer corromperia a diária da folha. Verificação: 18/18 checks de `verify-modulos-internos.ts`.
3. **Salário com contexto**: `gt_colaboradores` ganha `salario_moeda` (BRL/USD/EUR/GBP), `salario_periodo` (hora/dia/mes/ano) e `salario_natureza` (bruto/liquido) — editáveis no cadastro do colaborador (aba Remuneração) e exibidos na ficha. PJ em dólar e horista agora têm onde registrar.
4. **Contracheque (holerite) em HTML**: `GET /api/dp/folha/contracheque?sheetId=&employeeId=` — modelo CLT com dados do empregado, rubricas em proventos/descontos/informativos, totais, bases INSS/IRRF/FGTS e assinatura. Imprimível em A4 direto do navegador; gate folha `view`.

## [5.85.0] - 2026-09-21

### Importação WK Radar dentro do portal: matrícula eSocial e enriquecimento de fichas

1. **Matrícula e-Social padronizada e completa**: as 251 fichas do GT agora têm `matricula_esocial` no formato `CNPJ.000000` (ex.: `17784306000189.000803`) — o mesmo que o módulo e-Social envia no XML (S-2200/S-2220/S-2230). Casos confirmados manualmente no e-Social (ex.: VINICIUS 803 → `…000783`) ficam intactos: o sistema nunca sobrescreve valor existente.
2. **Fichas completas com o que o WK tem**: PIS/PASEP, data de nascimento, salário fixo (incluindo jovens aprendizes) e cargo preenchidos de duas fontes — RadarAPI ao vivo (768 funcionários: cargo e departamento) e backup do WK (cards de identidade com CPF/PIS/admissão/nascimento). Payroll ganhou `position` para 169 colaboradores.
3. **Nova rota `POST /api/dp/wk/enriquecer`** (gate payroll `edit`, mesmo do sync): dry-run por padrão, `aplicar=true` grava. Fonte API (JSON) ou fonte backup (multipart com os cards `DF/CRMINFP*.dat` extraídos do zip). Idempotente — reexecutar não muda nada.
4. **Integração RadarAPI de verdade**: o cliente do portal (`src/lib/wkradar/api-client.ts`) agora faz login (POST `/login` → JWT de 12h em cache, renovado automaticamente) com credenciais `wkradar_api_usuario/senha/empresa` em app_secrets, paths reais verificados ao vivo (`/v1/cards/empresarial/funcionarios` etc.) e paginação completa. O HTTPS do WK usa certificado autoassinado da WK — tratado isoladamente no cliente.
5. **Ferramentas de importação**: `scripts/wk-extrair-api.ts` (extrator completo da RadarAPI), `scripts/enriquecer-portal-wk.ts` (enriquecimento offline por backup), `scripts/importar-wk-backup.ts` e o leitor de backup `src/lib/payroll/wk-backup.ts` compartilhado entre script e rota. Férias do WK seguem fora: o endpoint da RadarAPI responde 304 e os arquivos `FPFER*.xml` são cifrados sob licença do WK.


## [5.84.0] - 2026-09-21

### Folha calcula pelos dados do portal, com INSS e IR de 2026

1. **Calcular pelos dados**: na aba Rubricas & Folha, o botão consolida embarque, dobra, folga indenizada e férias que o portal já tem e mostra o relatório por colaborador e por centro de custo (dias, bruto, INSS, IRRF, FGTS e líquido). A folga realizada aparece no quadro e não vira rubrica paga.
2. **Tabelas de 2026**: competência a partir de janeiro/2026 usa o INSS da Portaria Interministerial MPS/MF nº 13/2026 (mínimo R$ 1.621,00, teto R$ 8.475,55) e o redutor da Lei 15.270/2025 — imposto zerado até R$ 5.000,00 de rendimento e redução até R$ 7.350,00. Competência de 2025 continua na tabela antiga (teto R$ 8.157,41). A dedução simplificada de R$ 607,20 substitui INSS e dependentes; não se soma a eles.
3. **Fora desta folha**: ICMS, ISS e DIRF não entram no cálculo. Não há robô gravando alíquota. O 13º continua sem retenção de IR neste motor.


## [5.83.2] - 2026-09-21

### 🏢 Folha por empresa e centro de custo reais (GT como fonte da verdade)

1. **Fim da confusão do protótipo Luz Marítima**: `payroll_companies` passa a espelhar `gt_empresas` — "ABZ Group" ativa (única empresa GT) e "LUZ MARÍTIMA LTDA" (protótipo, sem contraparte GT) desativada e fora do select. Select da folha agora filtra `is_active=true`.
2. **Centros de custo na folha**: sync `gt_centros_custo` ativos → `payroll_departments` (ABZ ADM com 17 colaboradores, MATRIX - SS07 com 4). Novo select "Centro de custo" na aba Rubricas & Folha do DP — sheet, colaboradores e sincronização WK passam a ser por centro; "Todos os centros" consolida na sheet geral da empresa.
3. **Consolidação por centro**: `fontes-dp.ts` ganha filtro `centroCusto` — uma sheet de centro de custo coleta só o pessoal daquele centro (match por CPF continua). Nova rota `GET /api/payroll/departments` (gate `folha.view`).
4. **Script idempotente**: `scripts/sync-payroll-empresas.ts` — reexecutável, upsert por CNPJ/nome e por empresa+código, desativa o que saiu do GT. Verificação: 18/18 checks de `verify-modulos-internos.ts` verdes após a mudança.

## [5.83.1] - 2026-09-21

### 🖥️ Correções de visualização DP e sidebar R&S

1. **Sidebar do portal no R&S**: criado `layout.tsx` em `src/app/department/indicadores/` com `MainLayout`, igualando ao padrão de todas as outras páginas de departamento.
2. **DP compactado para notebook**: header menor, badges inline, botões icon-only abaixo de `lg`, filtros `w-32`, colunas Centro de Custo e Escala hidden em telas menores.
3. **DpFolhaPanel responsivo**: cabeçalho e ações unificados em 1 card, grid de KPIs `grid-cols-3 lg:grid-cols-6`, labels de botões hidden em mobile, tabela WK `min-w-[580px]`.

## [5.83.0] - 2026-09-21

### 🧾 Módulo DP completo: Rubricas, WK Radar, motor de folha e aprovação multi-assinatura

1. **Aba "Rubricas & Folha" no DP**: fluxo completo em uma tela — sincronizar WK Radar (API ou importação de arquivo), consolidar verbas, calcular a folha e enviar para aprovação multi-assinatura (padrão do fechamento GT v2: aprovadores configuráveis em `settings`, hash SHA-256, rejeição com motivo e reenvio).
2. **Integração WK Radar sem duplicar banco**: colaboradores e lançamentos caem direto nas tabelas `payroll_*` existentes (zero tabelas novas — apenas 3 colunas: `payroll_codes.codigo_wk`, `payroll_sheet_items.origem`, `payroll_sheets.aprovacao`). Re-sync idempotente que preserva lançamentos manuais; códigos não mapeados abortam a sincronização com lista acionável.
3. **Motor de cálculo corrigido**: IRRF progressivo aplicando o menor entre tabela legal e dedução simplificada; fórmulas reais `dsr`/`reflexo`/`reflexo_he` (sem eval); perfis de cálculo (teto de VT, flags de INSS/IRRF/FGTS); tributos calculados por natureza (mensal, 13º, férias, rescisão); rescisão completa (verbas 301–307) agora consumida pelo fluxo de desligamento.
4. **Os módulos conversam**: dias de escala/embarque (ON/DBA/FI/STB/TRE do fechamento) e férias aprovadas (`gt_afastamentos`) entram na folha automaticamente na consolidação (`origem='gt'`); se o mesmo colaborador+rubrica vier do WK, o valor do WK vence e o descarte é auditado.
5. **CRUD de rubricas com ACL do portal**: cadastro real em Configurações → Rubricas (criar, editar, desativar, mapear Código WK), módulo "Folha de Pagamento" no catálogo de permissões (`folha.view/edit/approve/admin`) e gate em 3 camadas (ADMIN → ACL → setor DP) em todas as rotas de folha.
6. **KPIs do Indicadores R&S**: nova página de KPIs com avaliação de eficácia do processo, motor validado contra as 2.133 linhas reais e artigo de ajuda dedicado.
7. **Verificação**: 119 checks em 4 scripts (`verify-payroll-motor`, `verify-dp-wk`, `verify-modulos-internos`, `verify-codes-crud`) + testes de desligamento/fechamento verdes; auditoria de sync/aprovação gravada em `payroll_audit_log`.

## [5.82.0] - 2026-09-18

### 📊 Novo módulo Indicadores R&S: importação dinâmica de planilhas e gestão em modal

1. **Módulo dedicado ao Recrutamento & Seleção**: nova página `/department/indicadores` no menu (categoria departamento), com catálogo e permissões próprias — `indicadores.view`, `indicadores.edit`, `indicadores.import` (+ admin) aplicadas via `POST /api/acl/init`; acesso liberado para ADMIN/MANAGER, por ACL, ou por setor R&S-like com o módulo permitido (mesmo padrão do gate ASO logística).
2. **Importação 100% dinâmica de planilhas**: wizard em 3 passos (arquivo → abas detectadas com preview e linha de cabeçalho ajustável → nome do dataset e modo novo/substituir). O sistema descobre abas, cabeçalho (linha com maior densidade de células entre as 30 primeiras — sobrevive às legendas do topo) e tipos por amostragem: data serial do Excel vira dia civil `YYYY-MM-DD`, números, percentuais (rótulo com %/índice/eficácia/retenção) e texto.
3. **Alimentação dentro do portal, sem planilha**: cada aba abre um workspace em modal fullscreen com grade dinâmica — ordenação, busca e paginação server-side, formatação por tipo (dd/mm/aaaa, número pt-BR, percentual ×100) e **Nova linha / Editar / Excluir** com formulário por tipo (percentual editado como 0–100). Exclusões com modal de confirmação; reimportar substitui o dataset; tudo paginado no servidor, nada de carregar 900 linhas no cliente.
4. **Planilhas atuais já semeadas**: Controle de Vagas e Indicadores 2026 (candidatos 884 + vagas 747), Indicador de Eficácia 2026 (vagas 217, Eficácia 9, KPI Eficácia 21) e Indicadores Auditoria 2026 (255) — 2.133 linhas verificadas no banco via `scripts/seed-rs-indicadores.ts` (idempotente, re-executável).
5. **Infra**: 4 tabelas `rs_planilhas`/`rs_abas`/`rs_linhas`/`rs_importacoes` (RLS ligado, zero policies, migration `20260918_000001_rs_indicadores.sql` idempotente com executor `scripts/apply-rs-indicadores.js`), 9 rotas em `/api/indicadores/**` (shape `{success,data,error}`, paginação `paginarSelect`, soft-delete de linhas, histórico de importações) e lib pura de parsing `src/lib/indicadores/xlsx-import.ts`.
6. **Verificação**: gates 8/8 em `GATES.md` (migration, lib vs planilhas reais com contagens independentes 217/884/9/21/747 e headers 8/14/5/5/8, seed com contagens no banco, 401 em 7 rotas + página 200 + ACL ativa, tsc 0, build com a rota no manifest, lint 0 erros, revisão de integração frontend↔backend). 50 testes ✅ incluindo o catálogo de módulos.

## [5.81.0] - 2026-09-18

### 🧮 GT: fechamento com a regra do desembarque (folga no dia 1), planilha com o período fechado + pendências, edição em tempo real e ACL granular

1. **Dia do desembarque é o 1º dia de folga (regra do dono)**: o motor do fechamento (`fechamento-calculo.ts`) não computa mais o desembarque como dia a bordo — a janela ON vai do embarque até a véspera do desembarque e a folga nasce no próprio dia do desembarque ("14 embarcado" = desembarque no 15º dia civil). Dobra automática, FI déficit, check escala/soma, rubricas de folha e totais consolidados seguem a nova base; o modelo recortado entre períodos (R1/R4) continua aditivo — o mês seguinte computa só a fatia dele. `dias_totais` do ciclo = dias a bordo.
2. **Planilha oficial reflete o período fechado**: o subtítulo do XLSX mostra as datas reais do período resolvido (filtro > manual > mês civil), não só o mês de referência. Duas colunas novas na aba **Fechamento DP**: **PEND. FI PRÓX. PERÍODO** e **PEND. PRÓX. (DBA/FOLGA)** — o que fica para o mês seguinte agora faz parte do documento assinado que vai ao DP, igual já aparecia no preview.
3. **Edição em tempo real dentro do módulo de fechamento**: cada linha da aba Tripulantes ganhou botão **Editar** que abre os embarques do colaborador na janela do período (`GET /api/gestao-tripulantes/embarques`, novo, paginado) com edição inline de datas (`PUT /embarques/[id]`) e exclusão com confirmação — tudo com a trilha de auditoria da v5.79 (reversível pela Fila de Revisão) e o preview recalculando na hora (refetch local + probe de 15s).
4. **Permissões do fechamento no ACL**: `gestao-tripulantes.fechamento.periodo`, `.marcas` e `.revisao` catalogadas em `src/config/modules.ts` e aplicadas via `POST /api/acl/init` (grants ADMIN/MANAGER; outras roles via UI admin). Servidor aceita **role do fechamento OU permissão ACL** em período, marcações, rejeitar/reverter edições (fail-closed; autodesfazer do autor intacto); o workspace libera abas/painéis pela mesma regra (`hasFeature`). Antes `.marcas` era checada sem existir no catálogo — ninguém sem role conseguia de fato.
5. **Contratos atualizados**: regra do desembarque, colunas novas do XLSX, `GET /embarques` e gates ACL documentados nos `AGENTS.md` da API e de componentes.
6. **Verificação**: 50 testes ✅ (motor 25 — incl. desembarque=folga, ciclos adjacentes, mesmo dia, aditividade set/out; assinatura; catálogo ACL), `tsc --noEmit` 0, lint 0 erros, build de produção ✅, smoke do XLSX real 26/26 asserts, ACL aplicada ao vivo com as 3 permissões ativas no banco, gates devolvendo 401 sem token.

## [5.80.0] - 2026-09-18

### ✂️ GT: recorte de marcações, exclusão parcial com confirmação e histórico global reversível

1. **Remarcar não apaga mais o evento inteiro (recorte)**: salvar um evento sobre uma marcação same-type existente recorta a antiga em torno do novo período — as pontas antes/depois ficam (ex.: ON 1–14 remarcado do dia 8 em diante mantém 1–7); no meio, o evento vira dois blocos. Checkboxes **Apagar marcações anteriores/posteriores** no painel flutuante (só em clique sobre marcação existente, default desmarcado) descartam a ponta correspondente de propósito. Mantidos: substituição same-tipo, merge de período idêntico e linhas abertas.
2. **Exclusão com confirmação e escopo do visor**: o delete da grade abre modal — sem a caixa **Apagar evento completo** marcada, apaga só o dia (visor dia) ou a semana sáb–sex (visor semana) clipada ao evento; marcada, apaga o evento inteiro como foi criado. Ficha do colaborador usa o mesmo modal (sempre evento inteiro). Tudo soft-delete + trilha — reversível.
3. **Desfazer no toast**: todo save/exclusão mostra toast com botão **Desfazer** que reverte a própria ação na hora; o autor pode desfazer o próprio lance sem ser gestor (guarda de supersessão fail-closed segue valendo). Ordem de reversão corrigida para saves que recortam (evento salvo primeiro) — segunda rodada de revisão/QA pegou o 409 no meio da cadeia.
4. **Histórico global de alterações**: nova aba **"Histórico de alterações"** na página GT (`?tab=historico`) sobre a trilha `gt_escala_edicoes`, com filtros status/operação/colaborador/**período de-até** (filtro novo no `GET /escala-edicoes`, janela BRT inclusiva, 400 em data inválida), diff antes→depois e Reverter/Rejeitar com motivo para gestores. A ficha do colaborador também ganhou Reverter/Rejeitar por lance.
5. **Fragmentos íntegros**: recorte de linha aberta preserva `data_prevista_desembarque` (fragmento não sai do automático do fechamento); falha na divisão é **tudo-ou-nada** com trilha "RECORTE NÃO APLICADO" para a fila de revisão — nunca resta original apagada com meia ponta viva.
6. **Verificação**: suíte GT 196 testes ✅ (recorte 23, período BRT 10, grade 4 mjs), `tsc --noEmit` 0, lint 0, build de produção ✅, E2E via API (recorte/fragmentos/trilha, rollback LIFO restaurando o original, exclusão parcial de linha aberta, bordas do filtro de/ate, RBAC do autodesfazer) 100% pass.

## [5.79.1] - 2026-09-17

### 🔒 Dependências: 44 vulnerabilidades zeradas (2 críticas), sem quebra de função

1. **Next.js 15.5.21 → 15.5.25 (crítico)**: RCE não autenticado (windows-media-type / otimização de imagem) e as falhas encadeadas de `postcss`/`sharp` que vinham junto na árvore do Next. Mesma linha 15.x — zero mudança de API.
2. **SheetJS `xlsx` 0.18.5 → 0.20.3**: prototype pollution + ReDoS. O npm não publica mais a linha corrigida do SheetJS — fix via tarball oficial do CDN (`cdn.sheetjs.com`) fixado em `dependencies` + `overrides`. Smoke de roundtrip real (gera → lê → compara células) passou nos mesmos moldes dos importers/exporters do portal.
3. **puppeteer 24 → 25.11**: cadeia do `extract-zip` (symlink path traversal). O gerador de relatórios PDF usa só API estável (launch/newPage/setContent/pdf); duas quebras de tipagem adaptadas sem mudança de comportamento — `page.pdf()` agora devolve `Uint8Array` (o único caller grava com `fs.writeFile`, que aceita nativamente) e `setContent` tipa `waitUntil: 'load'` (o HTML é inline, sem rede; os gráficos continuam esperados por `waitForFunction(window.chartsReady)`).
4. **Demais diretas**: `nodemailer` 9.1.1 (bypass de allow-list IDN + ReDoS), `sharp` 0.35.4 (libheif), `@netlify/functions` 6 (SDK de deploy — produção é Vercel), `postcss` 8.5.28 e `@netlify/zip-it-and-ship-it` novo. Overrides de transitivos sem fix por range dos pais: `esbuild` 0.28.2, `toml` 5, `brace-expansion` atualizado por subárvore.
5. **Tipagem de resposta de arquivo**: `next` 15.5.25 apertou o `BodyInit` — os 6 pontos que devolvem PDF/XLSX (`documentos`, `relatorio-mensal`, `ia/dashboard`, `leave` x2, `reembolso`) passam a envolver o buffer em `new Uint8Array(...)`; bytes idênticos no cliente.
6. **Verificação completa**: 163 testes GT ✅, `tsc --noEmit` 0 erros, lint 0 erros, build de produção ✅, smoke real de XLSX (roundtrip) e PDF (launch → `%PDF-`), `npm audit` = **0 vulnerabilidades** (antes: 44 alertas — 2 críticos, 25 high, 15 moderados, 2 low).

## [5.79.0] - 2026-09-17

### 🚀 GT v2: fechamento com período manual, marcados por mês, edição auditada com rollback, tudo live — e portal usável no celular

1. **Período do Fechamento DP definido à mão (dd/mm/aa a dd/mm/aa)**: nova tabela `gt_fechamento_periodos` por mês de referência — o período deixa de ser o mês civil automático. O período escolhido é usado de forma determinística pelo preview, XLSX, aprovação e e-mail, é **gravado no registro assinado** (`gt_relatorios_aprovacoes.data_inicio/data_fim`) e entra no hash GT_FECHAMENTO, garantindo que a planilha aprovada é a planilha que se reabre depois.
2. **Colaboradores marcados por fechamento**: nova tabela `gt_fechamento_marcacoes` — checkbox na Matriz (com marcar em lote por filtro) e painel no modal de fechamento, com "confirmar lista" por mês. Lista confirmada → só os marcados entram; sem lista confirmada → comportamento legado (todos os filtrados). Marcas não são sobrescritas por PUT sem o flag (bug de reset silencioso pego na revisão adversarial).
3. **FI respeita o período; o que corta vira pendência visível**: a janela de folga (desembarque → próximo embarque) agora é recortada na data de fechamento — só os dias dentro do período entram no mês. O restante aparece no bloco **Pendências do próximo período** (FI em déficit, DBA marcado além do corte, folga aberta aguardando embarque), sem entrar nos totais do mês fechado. Regras do dono de 14/09 preservadas (FI só com folga interrompida; DBA não é ciclo; dia de DBA na folga mantém o déficit).
4. **Edição de ON/DBA/FI auditada, rastreável e reversível**: todo save/edição/exclusão de evento grava `gt_escala_edicoes` com antes/depois, autor, papel, IP e hash — sem travar a operação (edição imediata, decisão do dono). Aprovadores do fechamento têm **Fila de Revisão** (aba admin + ficha do colaborador): rejeitar reverte automaticamente para o estado anterior, e qualquer edição aplicada pode ser revertida; a reversão também é auditada.
5. **Marcador nunca mais apaga a rotação (bug do Rômulo)**: adicionar um DBA de 1 dia dentro da rotação ON em andamento apagava o ON inteiro — a substituição de sobrepostos (v5.76.1) não distinguia tipo. Agora rotação substitui rotação; marcador (DBA/FI/STB/OFF-C/ON\*) só substitui o **mesmo tipo** e coexiste com o ON (a grade já resolvia o empate por dia). 15 testes novos em `escala-overlap.test.ts`.
6. **Tudo live**: novo probe leve (`GET /live-probe`, 15s) — grade Man Schedule (aba GT e `/department/man-schedule`), Matriz, cards e Fechamento reagem a alterações de outros usuários sem recarregar, preservando os guards de geração da v5.77.1 (nada de "marca apaga 1s depois").
7. **Fechamento em tela cheia + multi-embarcação**: o modal de fechamento virou workspace 100dvh (tabela com scroll de verdade, filtros colapsáveis no celular, rodapé sticky com assinatura); embarcação virou **multi-seleção** na grade, na Matriz e no fechamento (chips com busca na lista completa de `gt_embarcacoes` — corrige o dropdown que só mostrava opções da página já filtrada); XLSX reflete várias embarcações.
8. **Editar escala direto da ficha**: a aba Embarques do colaborador ganhou editar/excluir (mesmo contrato do grid, férias/afastamento continuam bloqueados) e um histórico de alterações por embarque alimentado pela auditoria.
9. **Portal usável no celular (R9)**: shell global com safe-area (PWA standalone), alvos de toque ≥44px, backdrop no drawer do admin, e as piores telas refeitas para mobile — grade (modal de evento vira bottom-sheet), Matriz (coluna de nome sticky, legenda que quebra linha, filtros colapsáveis), gestão de usuários, ACL, avaliação, folha, reembolso, academy e e-Social.
10. **Higiene geral**: 128 erros de ESLint e 40 erros de TypeScript pré-existentes resolvidos em todo o portal (incl. migração Next 15 `params: Promise` nas rotas de API); repairs idempotentes na migration do fechamento (mojibake `jsonb` e UNIQUE faltante em `gt_relatorios_aprovacoes`); nova migration `20260916_000001_gt_fechamento_v2.sql` (3 tabelas com RLS e zero policies) já aplicada no Supabase.

## [5.78.0] - 2026-09-14

### 💰 Fechamento DP: DBA/FI sobre 100% dos dados; ficha do colaborador mostra a escala real

1. **Totais de DBA/FI agora cobrem todos os embarques**: o gerador do relatório mensal lia `gt_historico_embarques` sem paginação — o PostgREST trunca em 1000 linhas e o preview/XLSX/aprovação/painel DP calculavam sobre um subconjunto arbitrário (a tabela já passou de 2800 linhas vivas, com viés contra as marcações recentes). É a mesma correção da v5.77.1, agora no fechamento: helper extraído para `supabase-paginacao.ts` com `.order('id')` determinístico, `dashboard-service` migrado para o helper, e erro de banco agora interrompe o relatório em vez de gerar totais de subconjunto em silêncio.
2. **Dobra explícita não infla mais a Folga Indenizada (pagaria dobrado)**: evento DBA marcado na grade era tratado como ciclo de rotação — zerava a folga do ciclo anterior e abria janela de folga própria (cenário real: 6 FI viravam 20). Agora DBA é trabalho extra: não é ciclo, reduz a folga realizada e o dia de DBA dentro da folga conta como folga faltante (regra confirmada pelo DP: 8 dias folgados + 2 DBA = 6 FI + 2 DBA). Válida também para janelas que cruzam o mês e para os tipos legados `dobra`/`folga_indenizada`.
3. **Ficha do colaborador deixa de mostrar escala antiga**: `último embarque`/`último desembarque`/`próximo embarque` eram lidos de colunas de `gt_colaboradores` congeladas no último pull MIO (desligado na v5.77.0). A ficha agora deriva as datas dos eventos vivos de `gt_historico_embarques` (fonte canônica) e cada save/edição/exclusão de embarque ressincroniza as colunas — o que também corrige a senioridade do algoritmo de BACK.
4. **Cadastros e histórico corrigidos**: trocar o regime no cadastro (ex.: 14x14 → 28x28) agora preenche os dias do par escolhido (antes mantinha 14/14 silenciosamente e a ficha continuava "antiga"); regimes sem rotação zeram os dias. Cards "Dobras"/"Folgas Indenizadas" do histórico passam a contar as gravações novas (`dba`/`fi`), as datas do histórico não mostram mais véspera no fuso BRT e o cadastro e-Social aceita "14x21" nos campos de escala sem erro 400.

## [5.77.1] - 2026-09-14

### 🗓️ Man Schedule: a causa real do "não marca alterações" — truncamento de 1000 linhas

1. **GET `/api/man-schedule/realtime` pagina as leituras de `gt_historico_embarques`** (e colaboradores/afastamentos). O PostgREST devolve no máximo 1000 linhas por requisição (`db-max-rows`) e trunca em silêncio: com 2825 linhas vivas na tabela, toda marcação nova/alterada ficava no fim do heap e **nunca entrava na resposta** — o save gravava (toast, linha viva no banco), o refetch 1s depois voltava sem a marca e a célula apagava. Reproduzido em produção: resposta sem `fb87c5ab` (marca viva do Sérgio de 17/10→31/10); após o fix, count 1057→2857 e todas as 4 linhas que sumiam presentes. Nenhum dos fixes anteriores (v5.76.0–v5.77.0) podia resolver porque a linha nunca chegava ao browser.
2. **Paginação determinística**: `.order('id')` antes de `.range(from, to)` em cada página — sem ordenação estável as páginas poderiam pular/duplicar linhas.
3. **Follow-up (não bloqueia)**: `dashboard-service` e `/api/mio/calendar` também podem ler muitas linhas de embarques sem paginação; contagens por colaborador (fichas, ASO, employee-hub) não são afetadas.

## [5.77.0] - 2026-09-14

### 🗓️ Man Schedule: causa raiz do "não marca alterações" + escala 100% local

1. **Refetch pós-save não desfaz mais a marcação**: cada save/delete inicia uma nova geração de refetch — a resposta antiga em voo (snapshot pré-save) não sobrescreve mais o estado otimista nem contamina o cache de 60s do módulo. Era a causa primária do "salvei, apareceu o toast e a célula voltou vazia".
2. **Portal é a única fonte de verdade da escala**: importação de escala do MIO encerrada — `syncEmbarquesFromMIO` é no-op (cron 03:00 UTC, botões admin e rotas manuais não gravam mais em `gt_historico_embarques`). Linhas já importadas permanecem intactas; edição/exclusão local nunca é revertida.
3. **Substituição cobre eventos "abertos"**: sobrepostos com `data_desembarque` NULL (rotação MIO em andamento) agora entram na substituição do save (`or(is.null, gte)` no POST e no PUT) — antes escapavam da query de sobreposição e sombreavam a marcação nova indefinidamente.
4. **Lançamento local domina a pintura**: no grid, `origem='local'` vence qualquer MIO sobreposta, independente de quem começa antes/depois (antes o termo "início mais recente ×10" vencia o bônus +6 do local e a marcação gravada nunca era pintada). Testes de regressão em `escala-contagem.test.ts` (5 casos).
5. **Docs corrigidos**: CLAUDE.md dizia que o `/api/man-schedule/realtime` lia `mio_cache` — na verdade lê `gt_historico_embarques`; a documentação errada tinha guiado as duas tentativas de fix anteriores (v5.76.1/v5.76.2) para a camada errada.

## [5.76.2] - 2026-09-11

### 🗓️ Man Schedule: grade pula para o mês do evento salvo

1. **Marcar em outro mês não "desaparece" mais**: ao salvar um evento cujo mês difere do mês de referência da grade, a view pula automaticamente para o mês do evento (antes: o save gravava, mas a grade continuava em setembro e o operador não via a marcação de outubro).

## [5.76.1] - 2026-09-11

### 🗓️ Man Schedule: save substitui eventos sobrepostos

1. **O save do operador é a verdade**: ao salvar (POST/PUT) um evento de escala, todo evento do mesmo colaborador que sobreponha o período é substituído (soft-delete — o pull MIO preserva exclusões locais e não ressuscita). Período exatamente igual atualiza a linha existente (id estável no grid). A resposta traz `substituidos` e o grid informa "Substituiu evento sobreposto: OFF-C 24/10→20/11". Fim da classe "marquei e não apareceu": nenhum evento antigo sombreia um novo.

## [5.76.0] - 2026-09-11

### 🗓️ Man Schedule: marcações invisíveis corrigidas + auditoria do módulo

1. **Marcação que sumia ao salvar**: ON lançado sobre um evento MIO com datas idênticas (ex.: OFF-C 17/10→31/10) ficava invisível — o desempate de sobreposição dava +5 ao tipo específico e a linha MIO vencia em todas as colunas, embora o save gravasse no banco. Agora o lançamento manual (`origem='local'`) vence empate de data idêntica em `pickOverlappingRotation`; FER/AFAST dominam a escolha do dia civil (nunca viram POB); `/department/man-schedule` reusa o mesmo seletor (o copião antigo deixava tipo específico ganhar de início mais recente).
2. **POST `/embarques` idempotente**: retentar o mesmo save atualiza o evento (colaborador + período exato) em vez de empilhar linhas idênticas. Colapsa só linhas locais — linhas MIO não são tombadas. Legado limpo: `node scripts/dedupe-embarques-locais.js` removeu 26 linhas duplicadas de 14 grupos (duplicatas inflamavam FI/folga indenizada e a aba Ciclos NxN do fechamento).
3. **Fechamento DP**: ciclos idênticos colapsados antes do loop NxN (sem FI fantasma por cópia); afastamento aberto (sem `data_fim`/previsão) entra como FER/AFAST pela janela de 90d — igual ao overlay da grade — em vez de contar ON para quem está de licença; mês de referência default em BRT no modal, na rota e no cron (não vira mais o mês às 21h do fim de mês).
4. **Célula FER/AFAST na grade** não abre mais o editor de embarque (PUT/DELETE `/embarques/<id de gt_afastamentos>` dava 404 silencioso). Toast orienta resolver no módulo de Férias/DP.
5. **Integridade de datas e cache**: `data_desembarque < data_embarque` = 400 no POST e no PUT; "Próximo Embarque" da Matriz não retrocede mais um dia (parse UTC→BRT); save sem mudança real não converte linha MIO em `origem='local'` (continua sincronizável); assinatura de cache do realtime inclui probe de `gt_afastamentos` (mudanças do DP aparecem sem esperar o TTL); `cron/relatorio-mensal` exige `CRON_SECRET` (branch de auth estava vazia).
6. **Time de agentes Claude Code** em `.claude/agents/`: 8 subagentes do projeto (`abz-tech-lead`, `abz-architect`, `abz-dev-frontend`, `abz-dev-backend`, `abz-qa`, `abz-bughunter`, `abz-reviewer`, `abz-security`) + skill `/sobe-o-git` (verifica → versiona → changelog → commit/push).

## [5.75.0] - 2026-09-10

### Departamento Pessoal, fechamento NxN e matrícula e-Social

1. **Cadastro DP do zero**: `/department/dp/novo` (e GT `/novo`) criam colaborador em `gt_colaboradores` via `POST /api/gestao-tripulantes/colaboradores`. Sem tabela paralela. A ficha (Dados Pessoais → Editar) altera qualquer campo do cadastro (`PUT`). Gate ADMIN/MANAGER/SUPERADMIN ou setor DP/RH + módulo `gestao-tripulantes`. CPF Módulo 11; CPF duplicado = 409; `matricula_esocial` vazio copia `matricula`.
2. **Fechamento fidedigno**: motor `fechamento-calculo.ts` compara embarque N / folga N com dt início e dt fim. Dobra = excedente a bordo; FI = evento + déficit sem duplicar; exporta também folga e STB. Mesmos números na UI, `GET /relatorio-mensal` (`calculosFolha`) e XLSX (aba Ciclos NxN). Sem dt fim não inventa janela.
3. **e-Social matrícula**: campo sempre visível em `EventoRevisao`. `POST /api/e-social/corrigir-matricula` grava evento + XML + cadastro GT. Evento processado com recibo fica travado.

## [5.74.2] - 2026-09-09

### 📅 e-Social S-2220: datas sempre PT-BR (DD/MM)

1. **Swap dia/mês**: exames no mesmo ASO vinham uns como `2026-08-10` e outros como `2026-10-08` (leitura MM/DD inglesa de `10/08/2026`). O e-Social rejeitava. Parse agora é sempre DD/MM; `dtExm` que é inversão de `dtAso` alinha em `dtAso`. Nomes de mês PT e EN (`10 de agosto` / `August 10`) viram o mesmo ISO.
2. **Validar Auto-Correção / pré-envio**: corrige `dados_evento` e o XML gerado. OCR de ASO usa o mesmo alinhamento. Evento já gravado no Supabase o usuário corrige na base; eventos novos não repetem o erro.

## [5.74.1] - 2026-09-09

### 🩺 e-Social S-2220: auto-correção de `nmMed` / `TS_nome`

1. **Schema XSD**: OCR colava cargo (`Médica`), quebra de linha e lixo (`à Á`) em `nmMed`. O e-Social rejeitava com `The Pattern constraint failed`. **Validar Auto-Correção** agora sanitiza o nome (`Thalia Leal Dibo`), rebuilda o XML e limpa `protocolo_envio` quando a rejeição foi só de schema (sem recibo).
2. **Envio**: botão **Enviar ao e-Social** no modal e na lista (status `erro`). Pré-envio usa o mesmo sanitizer. OCR ASO e `POST .../documentos/[id]/esocial` já gravam o nome limpo.

## [5.74.0] - 2026-09-03

### 🎓 Matrizes de Treinamento, Lista de Presença e Responsividade Global (Mobile & PC)

1. **Matrizes de Treinamento por Cargo & Setores (ACL)**:
   - Configuração completa em `/admin/gestao-tripulantes` e atalho direto em `/department/gestao-tripulantes` (aba e botão de cabeçalho).
   - Importador oficial de planilhas XLSX do MIO (`Matriz - Modelo 002`).
   - Cruzamento automático por cargo e regime na ficha do colaborador (`MatrizConformidadeColaboradorCard`) com barra de conformidade, listagem de cursos vigentes/a vencer/vencidos/faltantes e ação rápida "Lançar / Anexar" em 1 clique.
   - Visibilidade e gestão condicionadas a Setores autorizados (DP, RH, Treinamento, Operações, SMS/QHSE com módulo `gestao-tripulantes`), Roles (ADMIN/MANAGER), ACL granular (`matrizes.manage`/`matrizes.view`) e feature JSONB configurável em `/admin/users`.
2. **Edição e Exclusão Total de Treinamentos**:
   - Correção e exclusão auditável de lançamentos incorretos de cursos e certificados, operando tanto no certificado primário quanto no histórico colapsado (`obsoleto`) na ficha do colaborador.
3. **Lista de Presença para Treinamentos Internos**:
   - Modal integrado na ficha do colaborador (`ModalListaPresencaTreinamento`) permitindo emitir listas oficiais de presença em `/lista-presenca` para assinaturas digitais, download em PDF e opção de lançamento automático imediato da conclusão em lote nos prontuários de todos os participantes.
4. **Man Schedule (Scroll e Timeline)**:
   - Adicionada barra de rolagem de alto contraste e largura confortável (14px) no CSS global e barra superior de rolagem sincronizada em tempo real via `ResizeObserver`.
5. **Responsividade Global e Viewport (Mobile & PC)**:
   - Auto-close do menu drawer no mobile ao navegar (`pathname`).
   - Padding responsivo do `<main>` (`px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6 touch-scroll`), recuperando mais de 50px de altura útil.
   - `GtPageShell` atualizado para rolagem vertical suave no mobile (`overflow-y-auto lg:overflow-hidden`) com scrollports mantendo altura mínima segura (`min-h-[320px]` / `min-h-[360px]`), garantindo que tabelas nunca mais colapsem para 0px.
   - Cards de KPI em grade compacta 2x2 no mobile (`grid-cols-2 lg:grid-cols-4`) ocupando apenas ~110px de altura.
   - Filtros, abas de navegação (`no-scrollbar`) e tabelas com largura mínima (`min-w-[...]`) permitindo visualização fluida e cliques precisos em qualquer dispositivo.
   - Modais com botões de ação fixos no rodapé (`sticky bottom-0`).

## [5.73.0] - 2026-09-02

### 🚪 Desligamento, ACL de documentos GT e Man Schedule

1. **Desligamento / rescisão**: processo em `gt_desligamentos` pela aba/botão do `CollaboratorModal` (não na lista DP). Permissão ADMIN/MANAGER ou setor DP/RH com módulo `gestao-tripulantes`. Folha é fail-soft; e-Social S-2299 reusa `autoGenerateESocialEvents` (`motivo_demissao` = `mtvDeslig`).
2. **Editar e excluir itens do cadastro**: Treinamentos, ASO, documentos e passaportes passam pelo gate `PUT`/`DELETE /api/gestao-tripulantes/documentos/[id]` (`canEditGtDocuments` / `canDeleteGtDocuments`). ADMIN/MANAGER liberados; USER precisa da feature `gestao-tripulantes.documents.edit` / `.delete` ou ACL no recurso `gestao-tripulantes`. ASO já `enviado`/`processado` no e-Social não é editável/excluível na aba.
3. **Man Schedule**: mês de referência (default = mês civil; `localStorage`) gera colunas do 1º ao último dia mesmo sem rotações, para planejar o futuro. Setas do rótulo mudam o mês; setas laterais andam uma coluna.

## [5.72.1] - 2026-09-02

### 🔒 Segurança e qualidade de tipos (employee-hub, GT, IA e e-mail)

1. **Vazamento PII na ficha unificada**: `resolvePortalUser` exige corroboração de identidade (nome ou segundo identificador) antes de mesclar férias/reembolsos de outro usuário do portal ou fazer backfill de `user_id`. Match solto por e-mail/CPF editável no GT não expõe mais dados de terceiros.
2. **TypeScript real zerado**: corrigidos ~140 erros de tipo em gestão-tripulantes/e-Social (flatten de joins Supabase), IA/e-mail (`await` em `resolveEmailAuth`, `LLMMessage` com `tool`, schemas de tools) e pontos residuais (catálogo lista-presença, mascote Companion).
3. **Build confiável**: `tsconfig` exclui `scratch/` e `scripts/` de verificação; `npx tsc --noEmit` passa sem erros de código-fonte.

## [5.72.0] - 2026-09-02

### 🪪 Ficha do colaborador, regime sem escala e viewport do portal

1. **GT não cai mais em branco**: `ModalAprovacaoFechamento` usa `useSupabaseAuth` (o portal não monta o `AuthProvider` legado).
2. **Ficha**: vínculo de portal por `user_id` → `tax_id` → e-mail (não `cpf`/`full_name`). QHSE/EPI deixa de listar ASO; exames ocupacionais ficam só na aba ASO. Modal preenche a tela; cada aba rola o conteúdo internamente.
3. **Administrativo / onshore**: regimes `sem_escala`, `administrativo` e `onshore` (dias 0). Token vazio + 0/0 não vira 14x14. DBA automático não trata quem não tem rotação.
4. **Viewport**: Matriz, DP, Man Schedule, e-Social e listas do portal (férias, reembolso, academy, admin) preenchem `h-dvh`; filtros ficam, a tabela rola.

## [5.71.3] - 2026-09-01

### 🔧 Fechamento isolado, colunas reais de `users_unified` e ASO logística por setor

1. **Salvar fechamento**: a aba admin grava só `PUT /relatorio-mensal/config`. O PUT geral `/configuracoes` não toca mais em `gt_fechamento_mensal_config`. Adicionar/remover aprovador persiste na hora; o seletor busca nome/e-mail (`SearchableCreatableSelect`).
2. **Colunas reais**: ASO ator, alerta de vencimentos, token de voz e sync de férias → `gt_afastamentos` leem `first_name`/`last_name`/`tax_id` (nunca `full_name`/`cpf` em `users_unified`).
3. **ASO logística**: USER do setor Logística com módulo `gestao-tripulantes` pode aprovar/reprovar/cancelar. ADMIN/MANAGER segue liberado. USER de TI/QHSE com o mesmo módulo continua 403. Fechamento nominado não muda.

## [5.71.2] - 2026-09-01

### ✍️ Fechamento: espera exatamente quem está na lista, independente do cargo

1. **Lista nominada**: o e-mail ao DP só sai quando **as pessoas cadastradas** tiverem assinado. USER na lista pode assinar; ADMIN fora da lista recebe 403. O cargo no portal não substitui a lista.
2. **Dropdown**: passa a listar usuários ativos com e-mail (`listarUsuariosPortalAtivos`), não só ADMIN/MANAGER.
3. **Lista vazia**: fallback inalterado — um gestor/administrador assina uma vez e conclui.

## [5.71.1] - 2026-09-01

### 🔧 Fechamento de escalas: assinatura digital, dropdown de gestores e lista vazia

1. **Assinatura no modal**: `ModalAprovacaoFechamento` passa a aguardar a Promise de `requestSignature()` em vez do callback obsoleto `onSign`. O cadastro de assinatura POSTa `/aprovar`; quem já tem assinatura envia `signature_url` no body (antes o POST ia sem a URL).
2. **Dropdown de gestores**: a lista usa `first_name` / `last_name` / `tax_id` de `users_unified` (não `full_name` / `cpf`). O PostgREST deixava `availableManagers=[]` e o placeholder do select parecia duplicado.
3. **Lista vazia de aprovadores**: sem nomes cadastrados, uma assinatura de ADMIN/MANAGER conclui o fechamento e libera o e-mail ao DP. Lista nominada continua exigindo 100% das N assinaturas.

## [5.71.0] - 2026-09-01

### ⚓ GT/DP: status real da escala, Man Schedule usável e agendamento de ASO

1. **Status = célula de hoje**: a pílula da Matriz/DP/ficha deixa de usar `status_embarque` velho (Anderson ON hoje aparecia Folga). ON exato hoje = Embarcado; STB = StandBy. O KPI Embarcados Agora e o filtro usam o mesmo mapa.
2. **Man Schedule**: scroll interno da grade com nomes/QTD/cargo sticky (`border-separate`); Hoje, setas e `Hoje: NP a bordo` interpolam o POB (ON civil de hoje) e saltam por coluna (dia ou semana sáb–sex). i18n aceita `{count}` e `{{count}}`.
3. **Workflow ASO DP ↔ logística**: antecedência configurável no admin (padrão 60 dias). O sistema sugere datas pela escala (preferência STB, bloqueio de ON). DP escolhe a data; logística aprova/reprova com assinatura digital, log, e-mail e notificação no portal. Aprovado vira **Marcado** nos dois painéis (`gt_aso_agendamentos`).
4. **RLS**: `gt_afastamentos`, `gt_acidentes`, `gt_relatorios_aprovacoes` com RLS ligado e sem policy anon (só `service_role` / APIs).

## [5.70.0] - 2026-09-01

### ⚓ GT, QHSE/EPI e Calendário: POB só ON, histórico de docs, catálogo e dedupe

1. **Filtro de data (Man Schedule)**: o `input type=date` do Chrome disparava `0002-01-01` enquanto o ano era digitado e a grade montava centenas de milhares de colunas. Agora só entra `YYYY-MM-DD` completo (1990–2100), com teto de colunas (`filter-date.ts`, `ScheduleDateFilterInput.tsx`).
2. **POB / Embarcados Agora**: conta só o código de escala **exato `ON`** no dia civil — não `ON*`, `*`, STB, DBA, FI, etc. (caso 3P do Aislan: 2 ON + 1 ON*). Cards de KPI clicáveis com `?kpi=embarcados|disponiveis|docs_vencidos|colaboradores` (`embarque-status.ts`).
3. **Histórico de treinamentos/documentos**: agrupa por tipo de curso (CBSP etc.); a linha primária é o certificado/validade mais recente; versões antigas ficam em Histórico/Obsoleto com download. KPIs e resumos usam só o primário, para declaração vencida não gerar pendência falsa.
4. **Catálogo global de documentos** + aba nativa **QHSE / EPI** na ficha GT, `/profile` e `/admin/users`. Liberado pelo módulo **EPI** (`epi`) já existente — sem ACL extra de catálogo. Ficha AN-HSE-005, entregas e lista de presença QHSE. A aba Documentos do GT deixa de despejar “outros módulos”.
5. **Calendário**: deduplica título semelhante + mesmo início + local compatível (só feriados + ICS; sem eventos MIO). Hint para duplicatas ocultas (`calendar-event-dedupe.ts`).

## [5.69.3] - 2026-08-31

### 🛠️ GT: documento vencido visível + lançamentos de escala na coluna ON

1. **Matriz de Conformidade**: o KPI de documentos vencidos lista título, tipo, validade e aba; só o vigente de cada slot entra no número. Ficha unificada (Employee Hub) junta `gt_*`, portal, férias e reembolso.
2. **Man Schedule**: novo evento de escala (ON/FI/DBA…) aparece na grade e soma na coluna ON na hora. Insert local invalida o cache; lançamento recente prevalece sobre STB longo.

## [5.69.2] - 2026-08-31

### 🛠️ GT: lookup criável, KPIs só ativos e viewport diário no Man Schedule

1. **Cargo / Empresa / Embarcação / Centro de Custo**: busca com opção de cadastrar novo (`SearchableCreatableSelect`) no modal, cadastro e filtros.
2. **Cards da Matriz**: total, embarcados e back consideram só colaboradores `ativo=true` e centros de custo ativos.
3. **Documentos vencidos**: contagem por `data_validade` civil (não só `status_validacao`) nos ativos.
4. **Man Schedule**: checkbox **Visualizar por dia** (ligado = coluna por dia; desligado = semana sáb–sex).

## [5.69.1] - 2026-08-31

### 🛠️ Departamento Pessoal: menu lateral, cadastro e vencimentos de ASO

Correção da tela `/department/dp`:
1. **Menu lateral**: `layout.tsx` com `MainLayout`, no mesmo padrão de GT / e-Social / Man Schedule.
2. **Cadastro**: tabela usa campos achatados da API (`cargo_nome`, `empresa_nome`, `centro_custo_*`, `ativo`, regime/escala) em vez de nested `cargo.nome`.
3. **ASO**: lista só `tipo_documento=aso` via `GET /aso/notificar-vencimentos` (helper `aso-vencimentos.ts`, data civil local). A aba não mistura mais treinamentos da auditoria nem mostra colaborador como N/A.
4. **Fechamento**: preview de totais ON/DBA/FI/TRE do mês na própria aba.

## [5.69.0] - 2026-08-31

### 🚀 Integração Global do Departamento Pessoal (DP), Permissões de Setores, Motor de Dobras e Cruzamento de Dados

Esta grande versão integra o Departamento Pessoal (DP) em todo o ecossistema do Portal ABZ:
1. **Permissões de Setores & Módulos do Sistema**: Módulo `dp` (Departamento Pessoal) registrado no catálogo oficial (`SYSTEM_MODULES`), ícones, cartões e gerenciador de permissões de setores (`/admin/sectors`), permitindo controle granular por setor (TI, DP, RH, Operações, etc.).
2. **Motor Estrito de Dobras por Escala Individual**: O fechamento de escalas e a planilha oficial calculam dobras considerando a escala específica cadastrada de cada colaborador (`14x14`, `28x28`, `15x15`, `30x30`, `60x60`), convertendo dias contínuos excedentes à escala regular em `DBA` (Dobra).
3. **Cruzamento Global de Dados sem Retrabalho**:
   - **Férias & Afastamentos**: Ao aprovar férias em `/ferias`, registros são sincronizados automaticamente com `gt_afastamentos` (código e-Social 15), Man Schedule e Fechamento DP.
   - **e-Social**: Alterações em colaboradores refletem em tempo real nos eventos S-2200, S-2220 e S-2240.
   - **Alertas de ASO**: Disparo automático de e-mails detalhados para o DP e notificações in-app para tripulantes e gestores.

## [5.68.4] - 2026-08-31

### 🏢 Módulo do Departamento Pessoal (DP), Alertas de Vencimento de ASO & Correção Defensiva Final no Admin

Esta versão entrega a central do Departamento Pessoal e os alertas automáticos de conformidade ocupacional:
1. **Novo Módulo DP (`/department/dp`)**: Central unificada com consulta, busca em tempo real e edição de todos os colaboradores, controle de regimes de escala (`14x14`, `28x28`), integração com Fechamento Mensal DP e e-Social.
2. **Alertas Automáticos de Vencimento de ASO (E-mail & Portal)**: Endpoints dedicados (`/api/gestao-tripulantes/aso/notificar-vencimentos` e cron) para envio de e-mails detalhados com a lista de ASOs vencidos/vencendo e criação de notificações in-app para colaboradores e gestores.
3. **Proteção Total contra Erros no Painel Administrativo**: Garantia de tratamento defensivo em todas as categorias de auditoria de documentos e sincronizações no painel administrativo (`/admin/gestao-tripulantes`).

## [5.68.3] - 2026-08-31

### 🎓 Gestão de Tripulantes: Correção no Cálculo de Treinamentos (TRE) do Fechamento

Esta versão corrige a contagem indevida de dias de treinamento no fechamento mensal:
1. **Origem Estrita de Eventos de Treinamento**: A coluna e cômputo de **Dias TRE** agora considera estritamente **eventos de treinamento lançados na escala** (`gt_historico_embarques.tipo = 'tre' | 'tf'`) que ocorreram no mês de fechamento.
2. **Desacoplamento de Certificados Plurianuais**: Eliminada a verificação equivocada na tabela de certificados arquivísticos (`gt_documentos`), cuja validade plurianual (ex: cursos com validade de 2 a 5 anos) gerava falsa contagem de 30/31 dias de treinamento todos os meses.

## [5.68.2] - 2026-08-31

### 🛡️ Gestão de Tripulantes: Correção de Defensiva em Auditoria, Centros de Custo e Painel Admin

Esta versão corrige a exceção `Cannot read properties of undefined (reading 'length')` que ocorria ao acessar o painel de configurações administrativas (`/admin/gestao-tripulantes`):
1. **Auditoria de Documentos**: Proteção com optional chaining e fallback seguro para `data?.duplicados` e `data?.resumo`.
2. **Centros de Custo e Fechamento DP**: Blindagem contra arrays indefinidos em contagens e listas de aprovadores obrigatórios.
3. **Logs de Integrações MIO e PoliWeb**: Tratamento seguro para `cronLogs` e `scrapeResult.erros`.

## [5.68.1] - 2026-08-31

### 📊 Gestão de Tripulantes: Cálculo Diário Estrito de Embarques/Dobras, Layout com Células Mescladas e Edição de Escala no Cadastro

Esta versão aperfeiçoa a precisão contábil e a apresentação visual do Fechamento Mensal DP e amplia o cadastro de tripulantes:
1. **Motor de Cálculo Diário Estrito**: Os totais de **Dias ON**, **Dias DBA (Dobra)**, **Dias FI (Folga Indenizada)** e **Dias TRE (Treinamento)** agora são calculados dia a dia dentro do período do fechamento mensal.
2. **Cálculo Inteligente de Dobras por Escala**: Considera o regime cadastrado no colaborador (ex: `14x14`, `28x28`, `15x15`, `30x30`) — qualquer permanência a bordo que ultrapassar a escala máxima contínua é automaticamente categorizada como **DBA (Dobra)**.
3. **Melhoria Visual e Alinhamento no XLSX**: Aplicação de mesclagens de células (`!merges`) para o cabeçalho principal, subtítulo de filtros, total consolidado e chancelas de assinaturas digitais, eliminando compressão de texto e bordas desalinhadas.
4. **Campos de Escala e Datas no Cadastro do Colaborador**: Aba de dados pessoais atualizada com suporte à edição de **Regime de Trabalho / Escala de Embarque e Folga**, **Último Embarque/Desembarque**, **Próximo Embarque** e **Centro de Custo**.

## [5.68.0] - 2026-08-31

### ⚓ Gestão de Tripulantes: Filtros Dinâmicos na Planilha DP, Multi-Assinaturas Obrigatórias, Histórico Completo & Vínculo de Matrícula/Centro de Custo

Esta versão aprimora todo o ciclo de visualização histórica e fechamento mensal da Gestão de Tripulantes:
1. **Histórico Completo de Escala**: Carregamento irrestrito de todo o histórico passado e futuro (`janela=all`), com recálculo dinâmico das colunas de semanas e datas do cronograma baseado nos filtros de data inicial e final.
2. **Exportação & Fechamento com Filtros Ativos**: O gerador de XLSX e a prévia do Fechamento DP respeitam rigorosamente todas as seleções ativas (Embarcação, Empresa, Cargo, Status Ativo/Inativo, Intervalos de Datas e Busca).
3. **Conferência de Integrantes e Múltiplas Assinaturas Obrigatórias**: Painel administrativo para cadastrar os gestores que são obrigados a assinar digitalmente o fechamento. O envio oficial por e-mail com anexo para o DP só é liberado quando **100% dos integrantes obrigatórios** concluírem suas assinaturas.
4. **Vínculo de Matrícula & Centro de Custo**: Inclusão de colunas em destaque de Matrícula e Centro de Custo vinculados a cada colaborador tanto na visualização do modal quanto na planilha oficial XLSX enviada ao DP.

### Added
- Colunas de Matrícula e Centro de Custo nos relatórios consolidados e prévias da folha/DP.
- Painel de Aprovadores Obrigatórios com checagem de pendências e badges de conferência individual.
- Tabela `gt_relatorios_aprovacoes` criada com suporte a arrays de assinaturas digitais com carimbo criptográfico.

### Fixed
- Visualização de datas passadas no Man Schedule com suporte a seleção de intervalos retroativos.
- Filtros dinâmicos respeitados na geração de relatórios XLSX e rotas de fechamento mensal.

## [5.67.1] - 2026-08-31

### 🛠️ Gestão de Tripulantes: Correção de Importações de Token e Ajuste de Sintaxe no Man Schedule

Esta versão corrige a resolução de módulos do helper `fetchWithToken` (redirecionado para `@/lib/tokenStorage`) nos componentes de Centros de Custo, Fechamento DP e Modal de Aprovação, e restaura o fechamento de dependências do hook `useMemo` na linha de escalas do Man Schedule.

### Fixed
- **Resolução de Imports `fetchWithToken`**:
  - Atualizados `CentrosCustoAdminTab.tsx`, `WorkflowFechamentoTab.tsx` e `ModalAprovacaoFechamento.tsx` para importar `fetchWithToken` a partir de `@/lib/tokenStorage`.
- **Sintaxe de Hooks em `GTManScheduleTab.tsx`**:
  - Fechamento estrito do hook `useMemo` com a lista completa de dependências na renderização de linhas de tripulantes (`ScheduleRow`).

## [5.67.0] - 2026-08-31

### ⚓ Gestão de Tripulantes: Fechamento Mensal DP, Totais de Escala (ON/DBA/FI/TRE), Centros de Custo Globais & Histórico Completo

Esta versão implementa o workflow completo de fechamento mensal de escalas para o Departamento Pessoal com aprovação auditável e assinatura digital, adiciona o cômputo e colunas individuais e totais de ON (A bordo), DBA (Dobra), FI (Folga Indenizada) e TRE (Treinamento Indenizado) na planilha de escalas em formato unificado de folha única, disponibiliza a gestão global de Centros de Custo compartilhados entre os 4 departamentos e garante a exibição do histórico completo de escalas sem truncamento.

### Added
- **Workflow de Fechamento Mensal & Envio ao Departamento Pessoal (DP)**:
  - Tabela `gt_relatorios_aprovacoes` e configuração `gt_fechamento_mensal_config` no Supabase.
  - Endpoints `/api/gestao-tripulantes/relatorio-mensal`, `/aprovar`, `/config` e cron `/cron/relatorio-mensal`.
  - Modal `ModalAprovacaoFechamento` para visualização dos KPIs do mês, detalhamento dos tripulantes, assinatura digital com carimbo criptográfico (hash SHA-256) e disparo de e-mail corporativo com anexo XLSX oficial para o DP.
  - Nova aba `Fechamento DP` (`WorkflowFechamentoTab`) no `/admin/gestao-tripulantes` para configurar data de corte (ex: dia 25), e-mails de destino e auditoria de fechamentos anteriores.
- **Cômputo e Exportação de ON, DBA, FI e TRE por Colaborador**:
  - Motor oficial de geração de planilhas `relatorio-escala-generator.ts` em aba única (`Schedule`) com cálculo individual de dias/semanas para ON, DBA, FI e TRE.
  - Colunas dedicadas e estilizadas integradas visualmente na tabela de escalas (`GTManScheduleTab`) e no fluxo de `Exportar XLSX`.
- **Gestão Global de Centros de Custo**:
  - Tabela `gt_centros_custo` e rotas API `/api/centros-custo` e `/api/gestao-tripulantes/centros-custo`.
  - Nova aba `Centros de Custo` (`CentrosCustoAdminTab`) no `/admin/gestao-tripulantes` permitindo cadastro, edição, busca e ativação/desativação rápida para uso conjunto em Gestão de Tripulantes, Folha/DP, Finanças e Logística.

### Fixed
- **Histórico Completo de Colaboradores e Escala (MIO + Local)**:
  - Corrigido o tratamento de `janela=all` em `src/app/api/man-schedule/realtime/route.ts` para evitar `Invalid Date` decorrente de `Infinity`, retornando todo o histórico passado de embarques e eventos sem limitação de datas.

## [5.66.0] - 2026-08-28

### 🗓️ Gestão de Tripulantes (Man Schedule) — Alinhamento de Troca de Turma & Controle de Indicação de Início (d.X)

Esta versão corrige o cálculo e enquadramento de datas da escala na troca de turma aos sábados, elimina o recuo indevido gerado por fuso horário UTC em datas ISO e introduz o botão/toggle de controle para exibição opcional do dia de início do evento na célula (`d.X`) diretamente no modal flutuante de escala.

### Added
- **Controle de Indicação do Dia de Início na Célula (`d.X`)**:
  - Adicionado toggle no modal flutuante de escala (`GTManScheduleTab`) permitindo habilitar ou desabilitar a exibição do dia de início na célula da planilha.
  - Quando ativado, o marcador com o dia inicial (ex: `d.29`) é exibido estritamente na célula da semana em que o evento se inicia, enquanto as semanas subsequentes da mesma rotação mantêm a sigla limpa do evento (ex: `ON`).
  - Persistência na coluna `exibir_dia_inicio` na tabela `gt_historico_embarques` com suporte integral em `GET /api/man-schedule/realtime`, `POST /api/gestao-tripulantes/embarques` e `PUT /api/gestao-tripulantes/embarques/[id]`.
  - Indicador `d.X = Dia inicial do evento` sincronizado na legenda inferior.

### Fixed
- **Alinhamento de Semanas e Troca de Turma aos Sábados**:
  - Implementado parser local de datas (`parseLocalDate`) que evita o deslocamento de 3 horas para trás (para sexta-feira 21:00 UTC-3) ao instanciar strings `YYYY-MM-DD`.
  - Embarques que iniciam no sábado da troca de turma (ex: 29 de agosto) agora são contabilizados rigorosamente a partir da respectiva semana de início (`29-Ago-26`), sem sobrepor incorretamente a semana anterior (`22-Ago-26`).

## [5.65.0] - 2026-08-27

### 🚢 Gestão de Tripulantes: Filtro Ativos/Inativos, Modal Draggable de Escala, Bubbles Animados de Comentários & Indicador de Dia Inicial

Esta versão adiciona suporte completo a filtros de colaboradores ativos e inativos na Matriz e no Man Schedule, transforma o modal de escala em uma janela flutuante arrastável (não obstrutiva), implementa balões animados (*speech bubbles*) ao passar o mouse sobre observações e exibe o dia inicial do evento diretamente na planilha de escalas.

### Added
- **Filtro de Colaboradores Ativos / Inativos / Todos**:
  - Novo seletor de status na Matriz de Conformidade (`GTMatrixFilters.tsx`) e na barra de ferramentas superior do Man Schedule (`GTManScheduleTab.tsx`).
  - Suporte nas rotas de API `/api/gestao-tripulantes/colaboradores` e `/api/man-schedule/realtime`.
- **Modal de Escala Móvel e Flutuante (*Draggable Window*)**:
  - Modal de escala transformado em janela flutuante arrastável por mouse e touch, eliminando o backdrop escuro bloqueante e mantendo a planilha sempre visível.
  - Alça visual de movimentação (`FiMove`), acabamento em `backdrop-blur`, sombra em relevo e preservação integral de todas as opções de criação e edição de eventos.
- **Bubbles Animados de Comentários ao Passar o Mouse**:
  - Marcador animado pulsante (`animate-ping`) nas células da escala que possuem observações cadastradas.
  - Balão flutuante em *dark glassmorphism* (`fade-in zoom-in-95`) com dados do tripulante, data inicial, embarcação, texto integral da observação e seta indicadora.
- **Dia Inicial do Evento na Planilha (`d.X`)**:
  - Indicadores na grade de escalas exibem o código do evento e o dia inicial da rotação/embarque no mês (ex: `d.15`, `d.01`).
  - Colunas ajustadas para 36px de largura e legenda informativa atualizada.

## [5.64.0] - 2026-08-27

### 🔄 Persistência de Assets de Inicialização (Splash & Áudio), Sincronização em Tempo Real do Admin & PWA

Esta versão corrige a persistência e visualização das configurações de Splash Screen e Áudio no gerenciador de usuários, implementa atualização imediata da lista de usuários sem necessidade de recarregar a página (F5) e resolve o conflito de roteamento de manifest PWA no Next.js.

### Added
- **Badges de Splash e Áudio na Tabela de Usuários**:
  - Indicadores visuais na tabela de usuários (`UnifiedUserManager` e `/admin/users`) mostrando se o usuário possui Splash ou Áudio customizado e seu estado ativo/inativo.

### Fixed
- **Persistência e Edição de Splash Screen e Áudio de Usuário**:
  - Corrigida a omissão dos campos `startup_splash_*` e `startup_sound_*` ao abrir o editor de usuário (`UserEditor`), garantindo que fotos e áudios previamente cadastrados sejam carregados e não sobrescritos por valores vazios.
  - Sincronização reativa com `useEffect` no `UserEditor` para atualizar o preview de mídia sempre que a prop `user` for alterada.
  - Ajustada a remoção de assets no backend (`PUT /api/users/[id]` e `POST /api/users`) convertendo URLs vazias em `null` no banco de dados.
- **Atualização Imediata no Gerenciador de Usuários (sem F5)**:
  - Adicionado `cache: 'no-store'` e parâmetro de timestamp (`_=${Date.now()}`) no hook `useAllUsers` para anular cache HTTP do navegador em `/api/users`.
  - Implementada atualização otimista imediata ao excluir usuários e espera da sincronização com o servidor ao salvar ou alterar usuários.
- **Conflito de Rota PWA (`manifest.webmanifest`)**:
  - Removido arquivo duplicado em `public/manifest.webmanifest`, eliminando o erro 500 no Next.js e mantendo a geração dinâmica em `src/app/manifest.ts`.

## [5.63.0] - 2026-08-27

### 📱 PWA Mobile Durável, Splash & Áudio de Inicialização por Usuário & Gestão de Tripulantes Fullscreen

Esta versão corrige a inicialização mobile em tela inicial (PWA standalone) e persistência de sessão, implementa telas de splash e sons de abertura customizados por colaborador configuráveis via painel de administração, e aprimora o layout dinâmico em tela inteira da Gestão de Tripulantes.

### Added
- **Splash Screen e Som de Abertura Personalizados por Usuário**:
  - Nova seção no modal de edição de usuário (`UserEditor`) permitindo envio de imagem de splash e arquivo de áudio (`.mp3`, `.wav`, `.ogg`, `.m4a`).
  - Toggles dedicados para habilitar/desabilitar splash e som de forma independente.
  - Novo endpoint de upload seguro `POST /api/admin/users/upload-startup-asset` integrado ao bucket público `user-startup-assets`.
  - Componente global `StartupExperience` com animação suave de abertura, temporizador automático, toque para avançar e reprodução de som respeitando políticas de autoplay.
- **Suporte Oficial a Web App Manifest (PWA)**:
  - Criação de `src/app/manifest.ts`, `public/manifest.json` e `public/manifest.webmanifest` com configurações standalone, tema `#0B72E7` e ícones multi-resolução para Android e iOS.

### Fixed
- **Inicialização e Persistência de Sessão Mobile (Tela Inicial / PWA Standalone)**:
  - Corrigido travamento de tela em branco quando o app é aberto a partir do ícone da tela inicial do dispositivo.
  - Ampliada a expiração padrão do token local para 30 dias com renovação contínua via refresh token.
  - Ajustado `ProtectedRoute` para exibir loader de transição e redirecionar imediatamente para `/login` quando o usuário estiver deslogado, eliminando o falso "Acesso Negado" ou tela branca.
- **Gestão de Tripulantes (Man Schedule) em Tela Cheia**:
  - Cabeçalho de datas sincronizado com todas as 52+ semanas do ano, alinhando colunas e corrigindo visualização que limitava a Agosto/Setembro.
  - Layout dinâmico `100vh` sem barra de rolagem externa da janela e rolagem interna suave com centralização automática na semana atual ("Hoje").

## [5.62.0] - 2026-08-27

### ⚡ Gestão de Tripulantes, Setores no Admin & Resiliência de APIs

Esta versão introduz a criação dinâmica de setores com permissões modulares no Admin, desbloqueia a edição e exclusão local de lançamentos da escala na Gestão de Tripulantes com garantia de isolamento do MIO, corrige efeitos colaterais de renderização no posicionamento de assinaturas e otimiza a resiliência de endpoints críticos.

### Added
- **Criação Dinâmica de Setores no Admin** (`/admin/sectors` + `POST /api/sectors`):
  - Botão "+ Novo Setor" com modal interativo para cadastro imediato de setores corporativos.
  - Seleção em lote de módulos permitidos organizados por categoria (Geral, RH, Departamento, Conhecimento, etc.).
  - Integração instantânea com o fluxo do sistema: o novo setor passa a ficar disponível imediatamente no dropdown de edição/cadastro de usuários (`UserEditor`) e no controle de permissões.
  - Nova rota `DELETE /api/sectors/[id]` para gestão completa de setores.
- **Índices de Alta Performance para Notificações**:
  - Criação de índices compostos `idx_notifications_user_read` (`user_id, read_at`) e `idx_notifications_user_created` (`user_id, created_at DESC`) para consultas ultra-rápidas.

### Fixed
- **Edição e Exclusão de Escala Local (Gestão de Tripulantes)**:
  - Desbloqueada a edição e exclusão de qualquer lançamento de escala em `/api/gestao-tripulantes/embarques/[id]` (removido bloqueio 403 `origem !== 'local'`).
  - **Garantia de Isolamento MIO**: Todas as alterações operam estritamente sobre a base local `gt_historico_embarques` marcando `origem='local'` ou `deleted_at`, sem enviar requisições de escrita para o MIO.
  - **Proteção contra sobrescrita em Syncs MIO**: Rotina `mio-sync.ts` atualizada para respeitar exclusões locais (`deleted_at`) e edições manuais (`origem='local'`), evitando restaurações indesejadas.
- **Overlay de Assinatura Digital (`SignaturePositionOverlay`)**:
  - Corrigido erro de React *"Cannot update a component (`ContratoDetailPage`) while rendering a different component (`SignaturePositionOverlay`)"*.
  - Desacoplado o rastreamento de arrasto para `useRef`s e disparo limpo de `onDragEnd` fora de callbacks de atualização de estado.
- **Resiliência e Fail-Soft em APIs Críticas**:
  - `GET /api/avaliacao-desempenho/avaliacoes/pending-review`: Adicionado tratamento fail-soft para evitar erro 500 no carregamento do `AdminLayout`.
  - `GET /api/purchase-orders`: Adicionada a coluna `approver_ids TEXT[]` no banco de dados e tratamento fail-soft no endpoint para evitar travamentos de busca de ordens de compra.

## [5.61.0] - 2026-08-25

### 🛡️ Gestão de Tripulantes — Identidade Retroativa & Performance Man Schedule

Correção dos documentos legados trocados entre colaboradores (evidenciados em produção) e eliminação da lentidão extrema da aba Man Schedule.

### Fixed
- **Documentos trocados entre colaboradores (legado)**: varredura completa nos 1.018 docs vivos identificou **70 vinculados sem prova de identidade** — 5 confirmados de pessoa errada (ASOs de Wendel/Vinicius nos perfis de Adalberto e Gabriela) e 4 sem prova nenhuma. Os **9 casos** receberam quarentena conforme contrato (`identity_match='quarantine'`, `colaborador_id=null`); os 61 restantes tiveram o falso `'match'` corrigido para `'unknown'`. Descoberta-chave: o `identity_match='match'` doc-level era setado no upload, antes do OCR — a única prova real de identidade é `cpf_documento` == CPF do perfil. Backups em `scratch/backup-gt-quarantine-*.json`; relatório completo em `scratch/RELATORIO-DOCUMENTOS-TROCADOS.md`.
- **Causa raiz do envio errado bloqueada**: a rota S-2220 enviava usando o **CPF do perfil** quando o OCR não extraía nada do documento. Agora retorna **409 `ASO_CPF_NAO_EXTRAIDO`**. UI: botão desabilitado com aviso "Execute o OCR / identidade não verificada" + guard extra.
- **Reincidência prevenida**: todo upload nasce `identity_match='unknown'`; OCR sem CPF dispara toast claro "⚠️ Documento enviado para QUARENTENA… resolva em Auditoria > Quarentena".
- **Duplicados**: clusters reais mapeados (Ludmilla ~28x, Vinicius ~15x, Gabriela 9x) já agrupados na Auditoria com ação ADMIN `mesclar_duplicados`.

### Performance
- **Man Schedule (aba extremamente lenta → rápida)**:
  - Backend `/api/man-schedule/realtime`: cache do resultado computado com TTL 90s invalidado pela assinatura do `mio_cache`; chamadas à API do MIO nunca mais no caminho da requisição (refresh fire-and-forget em background); filtro `?janela=` limitando processamento às rotações relevantes (retrocompatível); instrumentação de tempo por etapa.
  - Frontend `GTManScheduleTab`: janela de semanas limitada com navegação ‹ › (fim das centenas de colunas), linha memoizada via `React.memo` com metadados pré-computados por célula, formatação de datas fora do render.

### Docs
- Relatório de evidência da varredura: `scratch/gt-risk-scan-report-v2.json`, `scratch/RELATORIO-DOCUMENTOS-TROCADOS.md`.

## [5.60.0] - 2026-08-25

### 🚢 Gestão de Tripulantes — Confiabilidade de Ponta a Ponta

Esta versão transforma o módulo Gestão de Tripulantes numa fonte confiável de verdade documental: sincronização auditável com o MIO, integridade obrigatória dos documentos, exportação organizada e rastreabilidade bidirecional com o e-Social.

### Added
- **Sync MIO consolidado e idempotente** (`src/lib/gestao-tripulantes/mio-sync.ts`):
  - Fluxo único canônico para colaboradores + treinamentos + embarques + usuários do portal (`syncAllFromMIO`); `src/lib/mio/sync.ts` virou compat shim sem lógica própria.
  - Upsert por chave natural `mio_id → CPF digits-only → CPF mascarado legado`: correspondente encontrado é sempre UPDATE, **nunca INSERT duplicado**.
  - Integrante ausente do MIO é marcado `ativo=false` (jamais deletado); registros sem nome/CPF são logados, pulados e contabilizados.
  - Novo endpoint `GET /api/gestao-tripulantes/mio-auditoria`: total MIO vs portal, criados/atualizados/ignorados/inativados/erros — cobertura de 100% verificável. Resultado persistido em `gt_configuracoes` (`mio_sync_ultimo_resultado`).
- **Integridade documental 100%** (migration `20260825_000001_gt_documento_integrity.sql`, aplicada em produção):
  - Coluna `numero_rastreio` + unique index; backfill determinístico para todos os docs existentes.
  - Validação dura: `data_emissao` + `data_validade` obrigatórias (HTTP 422) em upload, POST manual, PUT e service — quarentena é a única exceção.
  - Anti-duplicação por hash sha256 → path → colab+tipo+título: duplicado vira UPDATE do existente (`merged: true`), nunca novo registro.
  - Gate de identidade estendido a TODOS os tipos de documento (antes só ASO): CPF do documento tem que bater com o perfil do colaborador; ambíguo/sem CPF ⇒ quarentena; identidade congelada nunca move.
- **Painel de Auditoria de Documentos**: nova aba "Auditoria Documentos" em `/admin/gestao-tripulantes` + API `GET|POST /api/gestao-tripulantes/auditoria` — buckets clicáveis (sem emissão, sem validade, sem rastreio, duplicados, quarentena, vencidos/vencendo) com ações corretivas inline: `gerar_rastreio`, `corrigir_datas`, `corrigir_rastreio`, `resolver_quarentena`, `mesclar_duplicados`.
- **Cross-reference e-Social ↔ Gestão de Tripulantes**:
  - `GET /api/gestao-tripulantes/documentos/[id]/esocial` — eventos e-Social de um ASO com protocolo, recibo, datas e erros.
  - Novo `GET /api/gestao-tripulantes/esocial-crossref?cpf=|evento_id=` — caminho inverso: dado um evento ou CPF, retorna os ASOs vinculados + colaborador + verificações (vínculo, CPF nos dois lados, órfãos).
  - Novo `src/lib/gestao-tripulantes/esocial-consistency.ts` + `GET /api/gestao-tripulantes/esocial-consistencia` — detecta CPF divergente entre laudo e evento transmitido, eventos órfãos e status divergentes.
  - UI: selo "e-Social" por ASO no modal do colaborador com recibo/protocolo/processamento em tooltip.
- **Exportação organizada em pastas (.zip)**:
  - Nova rota `GET /api/gestao-tripulantes/export` + núcleo em `src/lib/gestao-tripulantes/export-service.ts` (JSZip, já presente no projeto).
  - Pasta por funcionário com documentos baixados do Storage em formato original (extensão/conteúdo preservados, nunca convertidos) + resumo JSON e CSV (matrícula, CPF, cargo, empresa, centro de custo, tabela de documentos com emissão/rastreio/validade) + `_export/resumo_geral.{json,csv}` e `_export/avisos.txt`.
  - Filtros combináveis: funcionários (ids/nomes), empresa, centro de custo.
  - Hierarquia configurável via template com placeholders `{empresa} {centro_custo} {funcionario} {cpf} {cargo} {tipo_documento} {ano}`, persistida em `gt_configuracoes` (`gt_export_template`) com 4 presets; sanitização segura para Windows.
  - Nova aba "Exportar" no admin com preview da árvore antes do download; caps de proteção (50 funcionários default / hard 200, 25MB/arquivo).

### Fixed
- **Validade dos ASOs**: 31 ASOs recuperaram `data_validade` extraída do texto OCR real dos laudos (nenhuma data presumida); status de validação recalculado. 73 PDFs escaneados ficaram pendentes para OCR vision/digitação na aba Auditoria.
- **Números próprios de documento como rastreio**: OCR agora extrai o número intrínseco do documento (nº do ASO no laudo, nº do passaporte ICAO, nº de certificado NR), rejeitando falsos positivos (CRM/CPF/CNPJ/Portaria). O código interno `GT-*` é apenas fallback legítimo para documentos sem numeração própria; sobrescrita só ocorre sobre fallback/vazio, com checagem de unicidade.

### Docs
- `src/app/api/gestao-tripulantes/AGENTS.md` atualizado com as novas regras (integridade, rastreio = número próprio, fallback, auditoria).
- Backups e relatórios da execução em `scratch/` (`backup-backfill-*.json`, `relatorio-backfill-rastreio-validade.json`).

## [5.58.0] - 2026-07-28

### Improved
- **Companion — quality-gated motion polish (clearly better than 5.57.0)**:
  - Rebuilt body-only `companion-mascot.riv` (**17 body poses**, still no face overlays): adds missing exec parity `exec_point` / `exec_read` / `exec_stretch`.
  - Status SM mixes **500ms** (was ~420ms); idle pose step **~2.7s** (hold 2.05s + fade 0.65s; was ~2.15s); calmer float-idle (intensity 0.38 / 5.0s cycle).
  - Rive-like cycles match: longer crossfades; status blend **480ms**; idle fps 0.37; face PNG prefetch skipped while `MASCOT_USE_FACE_OVERLAY=false`.
  - Size: `.riv` ~441 KB (was ~347 KB) — under 600 KB gate; win = exec parity + softer mixes.
  - Bones prep (not runtime): `docs/assets/companion-mascot/cutouts/` layer PNGs + Editor README; 3D remains NO-GO (`3d-spike-2026/SPIKE.md`).
  - Validated: `scratch/validate-companion-mascot-riv.mjs` → CompanionSM + status/viseme OK.

## [5.57.0] - 2026-07-28

### Fixed
- **Companion — kill double-face + natural body-only motion**:
  - Rebuilt `companion-mascot.riv` with **14 body frames only** (no face/viseme image layers — overlays caused gray skull / ghost mouth on faced bodies).
  - Opacity crossfades + `float-idle` / sway / breathing; soft SM mixes (~420ms); no hard solo snaps.
  - API wait → `executing` (calm think), never `speaking` + lip-sync spam; `viseme` contract kept but visually no-op.
  - React: `MASCOT_USE_FACE_OVERLAY=false`; Rive-like body-only; calm Framer float (disabled when Rive owns motion).
  - Docs: `public/rive/README.md` + `src/components/IA/AGENTS.md`.

## [5.56.0] - 2026-07-28

### Added
- **Companion — real `companion-mascot.riv`**:
  - Shipped `public/rive/companion-mascot.riv` (~126 KB) with SM `CompanionSM` and Number inputs `status` (0–3) + `viseme` (0–3).
  - Headless build from keyed PNGs via `rive-mcp-server` `createRiv` (`scratch/build-companion-mascot-riv.mjs`); body/face image solos; validated with official Rive runtime.
  - Opening Companion auto-detects the file and uses `@rive-app/react-canvas-lite`; sprite Rive-like remains fallback on miss/error/reduced-motion.
  - Docs: `public/rive/README.md` + `src/components/IA/AGENTS.md` (regen notes; do not redistribute rive-mcp-server source).

## [5.55.0] - 2026-07-28

### Improved
- **Companion — Fase 1A Rive / Rive-like mascot**:
  - `CompanionMascotRiveLike`: sprite state machine com crossfade suave, face layer (blink + visemes), fake lip-sync em speaking.
  - Gate `CompanionMascotRive`: se existir `public/rive/companion-mascot.riv`, lazy-load `@rive-app/react-canvas-lite` (`CompanionSM` inputs `status` + `viseme`); senão fallback Rive-like.
  - Builds on Fase 0 face overlays + body extras; `AnimatedABZLogo` API intacta; FAB/session/bus inalterados; reduced-motion → estático.
  - Docs drop-in: `public/rive/README.md` + `src/components/IA/AGENTS.md`.

## [5.54.0] - 2026-07-28

### Improved
- **Companion — Fase 0 sprite compositor (body + face)**:
  - `AnimatedABZLogo` compõe body + face overlay (`face_neutral` / `face_blink` / `viseme_*`).
  - Idle: blink em intervalo aleatório; speaking: fake lip-sync ciclando `viseme_a/e/i/u` + rest (`face_neutral`).
  - Listening/executing: ciclos de body mais ricos; prefetch dos PNGs chave; `useReducedMotion` congela face/body.
  - Mapa em `companion-mascot-frames.ts` + `frames.json` (`faceOverlay`, `lipSync`, `blink`); FAB 60 / header 36 / hero 80; props API intacta.

## [5.53.0] - 2026-07-28

### Added
- **Companion — mascote livro azul animado**:
  - `AnimatedABZLogo` troca o pinwheel por sprites RGBA do livro (`public/images/companion-mascot/body/*`).
  - Status → frames: idle (stand/wave), listening (mão no rosto), speaking (gesto + boca), executing (pensar / lâmpada / digitar).
  - Mapa em `companion-mascot-frames.ts` + `frames.json`; `useReducedMotion` congela no 1º frame.
  - FAB 60 / header 36 / hero 80 inalterados; sem mudanças em bus/session.

## [5.52.0] - 2026-07-28

### Improved
- **IA Graph/email/Teams — payloads ricos**:
  - Novo `src/lib/ia/graph-comms-format.ts`: enrichers com datas ISO + pt-BR, remetente/destinatários, preview, corpo texto truncado (HTML stripped), pasta, webLink, importância, conversationId, participantes Teams.
  - Tools enriquecidas: `meus_emails`, `ler_email_funcionario`, `pesquisar_emails_outlook`, `minhas_conversas_teams`, `pesquisar_mensagens_teams`, `buscar_sinais_kpi_comunicacao` (+ registry microsoft/chat).
  - Graph `$select` expandido; `formatToolResultForLLM` cap ~28k para tools de comms e preserva arrays detalhados (não só `_summary`).
  - Listas tipicamente 20–50 itens **completos** (não thin stubs).

## [5.51.2] - 2026-07-28

### Fixed
- **Companion — Markdown nas bolhas da IA**:
  - Mensagens do assistente no FAB passam por `renderChatMarkdown` (`src/components/IA/chatMarkdown.tsx`), o mesmo renderer leve do ABZ Assistant (`MessageBubble`) — bold, itálico, listas, links seguros, code/fences.
  - Sem HTML cru (sem XSS): só nós React + href allowlist (`http`/`https`/`mailto`/path relativo).
  - Mensagens do usuário continuam texto puro (`whitespace-pre-wrap`).

## [5.51.1] - 2026-07-28

### Added
- **Férias — prompt de cadastro de assinatura**:
  - Em `/ferias`, se o usuário não tem assinatura (`useSignature().hasSignature`), mostra banner dismissível + soft-gate em **Nova Solicitação** e **Baixar PDF**.
  - CTA **Cadastrar assinatura** abre o `SignatureModal` global via `requestSignature` (mesmo `SignatureProvider` de EPI/contratos/lista de presença) — sem segundo modal.
  - “Continuar sem assinatura” / “Agora não” grava `sessionStorage` (`ferias_signature_prompt_dismissed`) e não bloqueia o módulo na sessão.
  - Link para `/profile` (aba Assinatura / `SignatureTab`); save path existente `POST /api/user/signature`.

## [5.51.0] - 2026-07-28

### Added
- **Férias PDF — assinaturas cadastradas**:
  - `GET /api/leave/[id]/pdf` lê `users_unified.signature_url` do colaborador e do líder/gerente do setor (supabaseAdmin; bucket `user-signatures/{userId}.png`).
  - `leavePDFGenerator` carimba a imagem na área de assinatura quando a URL carrega; sem cadastro / `PASSKEY_SIGNED` / falha de fetch → caption **“Assinatura não cadastrada”** (não inventa).
  - Formulário em branco (`form-pdf`) permanece com linhas de assinatura vazias.

## [5.50.2] - 2026-07-28

### Fixed
- **Férias PDF download** (root cause confirmed in Vercel logs on 5.50.0):
  - `GET /api/leave/[id]/pdf` retornava **404** com `column users_unified_1.cpf does not exist` (seleção inválida introduzida em 5.50.0); preenchimento já usa `tax_id` desde 5.50.1.
  - Resposta PDF via `Uint8Array` + `Cache-Control: no-store` (blank + filled).
  - Lookup de líder/gerente sem FK nomeada (não derruba o PDF se join falhar).
  - Cliente `/ferias` e admin: exige Bearer, toast claro por 401/403/404/500, valida `content-type` PDF e blob não vazio.
  - Header ABZ: larguras cabem na página A4; logo com compressão `FAST` (evita PDF ~1.8MB).

## [5.50.1] - 2026-07-28

### Fixed
- **Férias PDF preenchido** (`leavePDFGenerator` + `GET /api/leave/[id]/pdf`):
  - CPF agora vem de `users_unified.tax_id` (antes lia coluna `cpf` inexistente/errada → campo vazio ou query quebrada).
  - Nome com fallback `name` → `first_name` + `last_name`; setor com fallback `sectors.name` → `department`.
  - Duração dos períodos recalculada quando ausente/`0` (fallback start/end não gera mais “0 dias”).
  - Seção Observações sempre presente; linha de datas nas assinaturas corrigida (colaborador = solicitado em; líder/gerente = aprovado em).

## [5.50.0] - 2026-07-27

### Added
- **Férias — histórico + extração + formulário preenchido**:
  - Filtros de **status** e **ano** em Minhas Solicitações, Histórico da equipe (aprovadores) e Todas as Solicitações (admin); listagens incluem passado/aprovadas/gozadas.
  - Export **XLSX/CSV** do conjunto filtrado (`src/lib/leaveExport.ts`) com campos: colaborador, datas, períodos, status, abono, 13º, observações, criação/atualização.
  - **Detalhes** → prévia do formulário preenchido + **Baixar PDF** via `GET /api/leave/[id]/pdf` (dados reais + líder/gerente); funciona também para histórico.
  - APIs: `year`/`status`/`history` em leave-requests e leave-approvals; limite admin default 500.
  - IA: `buscar_ferias` / `buscar_ferias_global` com `ano`, `status`, `incluir_historico` (default true).
  - DOX: `src/app/ferias/AGENTS.md`.

## [5.49.0] - 2026-07-27

### Improved
- **IA Companion / Assistant — data path audit + fixes**:
  - Hard anti-hallucination in Companion system prompt + `context-builder` (never invent numbers; always call tools; multi-tool workflows allowed).
  - `buscar_ferias` / `buscar_reembolsos` default to authenticated user; structured JSON + `_summary`.
  - `buscar_kpis_sistema` no longer ADMIN-only: USER/MANAGER get RBAC-scoped pendências; ADMIN keeps global + Graph scan.
  - New mutate tools: `aprovar_ferias` / `reprovar_ferias` / `aprovar_reembolso` / `reprovar_reembolso` (correct leave/reimbursement statuses).
  - `formatToolResultForLLM` (`tool-result-format.ts`) — short `_summary` + size cap for LLM reasoning.
  - Tool loop: sync max **12** rounds; stream **10**; removed premature abort at round 3 without content.
  - Companion allowlist: globals, mutate, KPIs; history window 12; `MANAGER` treated as GERENTE for team tools.
  - Fixed ghost tool `gerenciar_notificacoes` → `enviar_notificacao_proativa`; ferias/reembolso actions status alignment; KPI export stubs use real Excel/PDF generators.

## [5.48.1] - 2026-07-27

### Fixed
- **Companion chat scroll**: panel always opens (and rehydrates) scrolled to the latest messages; instant jump on open, smooth while chatting.
- **IA interactive cards — empty/blank data** (KPI `/kpi`, Assistant `/ia`, Companion FAB):
  - Shared `normalizeWidgetData` + `adaptToolResultToWidget` (`kpi-board-shared.ts`) coerce LLM/tool variance (`label`/`value`/`assunto`/`labels+datasets`/nested `email_sinais`) into paint-able metric/list/chart/table shapes.
  - `GenerativeDashboard` normalizes on render; clear empty-states (“Nenhum e-mail pendente”) instead of icon-only blank rows.
  - GET `/api/ia/kpi-boards?resolve=1` prefers live allowlisted `dataSource` tool results over empty snapshots; optional `dataSource.path`.
  - Companion returns + renders `_metadata.dashboard` (was dropped).

## [5.48.0] - 2026-07-27

### Added
- **KPI Quadro Branco — exclusão**:
  - Soft-delete (`deleted_at` + `is_active=false`) em `deleteUserBoard` / `deleteAllUserBoards`; list/get/open ignoram excluídos.
  - Tools `excluir_quadro_kpi` (id / `board_id` / titulo fuzzy) e `excluir_todos_quadros_kpi`.
  - API `DELETE /api/ia/kpi-boards?id=` e `?all=1` (somente boards do usuário autenticado).
  - UI `/kpi`: botão lixeira com confirmação; limpa quadro ativo se foi o excluído.
  - Prompts Companion/Chat: nunca afirmar que exclusão é indisponível.
  - Migration `20260727_000004_ia_kpi_boards_deleted_at.sql`.

## [5.47.0] - 2026-07-27

### Added
- **KPI Quadro Branco — harness de roles**:
  - `src/lib/ia/kpi-board-harness.ts`: `getKpiBoardCapabilities(role)`, `assertBoardSpecAllowed(spec, role)`, prompts por papel.
  - **ADMIN**: liberdade máxima; widget `html_sandbox` (iframe `sandbox="allow-scripts"` sem `allow-same-origin` + CSP no srcdoc; sem cookies/localStorage do portal).
  - **MANAGER / USER**: somente conteúdo profissional; blocklist de jogos/off-topic; sem `html_sandbox`; caps de widgets e dataTools por papel.
  - Enforcement server-side em tools (`criar_quadro_kpi` / `atualizar_quadro_kpi` / `render_dashboard`) e `/api/ia/kpi-boards` (POST/PATCH + strip no GET non-admin).
  - Prompts Companion / context-builder / agents-router injetam regras do harness por role.

### Changed
- Spec Zod aceita `html_sandbox`; `KpiBoardRenderer` renderiza sandbox sem `dangerouslySetInnerHTML` no origin.

## [5.46.0] - 2026-07-27

### Features
- **KPI Quadro Branco v1**:
  - Tabela `ia_kpi_boards` (spec JSON Zod-validated; widgets allowlisted `metric|table|list|chart|markdown`; max 24; RLS + service_role).
  - Tools `criar_quadro_kpi` / `atualizar_quadro_kpi` / `listar_quadros_kpi` / `abrir_quadro_kpi`.
  - `render_dashboard` persiste board + emite `OPEN_KPI_BOARD` + `NAVIGATE /kpi` (Companion não perde mais o dashboard).
  - `/kpi` carrega quadro ativo via AuthContext `user.id` (remove `abz_user_id` / `abz_sector_id` quebrados).
  - `portalActionBus` action `OPEN_KPI_BOARD`; índice de boards no prompt Companion/Chat.
  - Sem HTML/JS livre no origin do portal. `ia_dashboard_cache` permanece só para summary TTL.
  - Prompt hardening: Companion proibido de pedir copiar HTML / salvar `.html` / abrir fora do portal; minigames → widgets allowlisted + abrir `/kpi`.

## [5.45.0] - 2026-07-27

### Features
- **Companion skills Hermes Agent–like**:
  - Tabela `ia_user_skills` (procedimentos reutilizáveis por usuário; persistem entre logins).
  - Tools `criar_skill_usuario` / `listar_skills_usuario` / `usar_skill` / `esquecer_skill`.
  - Índice de skills injetado no system prompt (Companion + Chat/`context-builder`); `usar_skill` carrega o procedimento completo.
  - Criação automática heurística pós-turno + instrução no prompt para o LLM criar skills de fluxos multi-passos.
  - Cap ~30 skills/usuário; sanitize; rejeita conteúdo com secrets.
  - Migrations aplicadas: `20260727_000001_ia_user_memory.sql` + `20260727_000002_ia_user_skills.sql`.

## [5.44.0] - 2026-07-27

### Features
- **Companion global + memória Hermes-like**:
  - Sessão do Companion acompanha o usuário em todos os módulos (`CompanionSessionProvider` no `ClientProviders`; STM em `localStorage`).
  - Contexto/sessão de conversa limpos **somente no logout** (STM); memória de longo prazo (`ia_user_memory`) **persiste** entre logins.
  - LTM curada por usuário (fatos/preferências/metas), injetada no system prompt do Companion e do Chat.
  - Tools `salvar_memoria_usuario` / `listar_memorias_usuario` + extração heurística pós-turno.
  - Migration: `supabase/migrations/20260727_000001_ia_user_memory.sql` (aplicar no Supabase).

### Changed
- Companion removido do `MainLayout` (evita remount/perda de estado); montagem global autenticada.

## [5.43.1] - 2026-07-27

### Features
- **AI Companion — Ícone oficial**:
  - FAB com crop `LC1_Azul` na marca “abz” + label tipográfico ABZ e placa branca/brand.
  - Motion rings por estado (`idle` / `listening` / `speaking` / `executing`) em `companion-logo-motion.ts`; a logo nunca gira.
  - Respeito a `useReducedMotion`.

### Changed
- Removido SVG morto `PortalLogo` (arcos 3 cores) do `MainLayout`.

## [5.43.0] - 2026-07-27

### Features
- **AI Companion UX**:
  - Ícone com logo oficial ABZ (`LC1_Azul.png`) estável + anel de status (sem girar a marca) e wordmark no FAB.
  - Companion conectado à IA real (`chatCompletion` + tools); removidas respostas canned por keyword.
  - Navegação fuzzy com typos/sinônimos/contextos (`portal-navigation.ts`); `navegar_portal` unificado.
  - Commands da tool propagados via `_metadata.portalCommands` para o Portal Action Bus.
  - Sub-agente `companion` no `agents-router` (prefixo `[ABZ_COMPANION]` / verbos de navegação).

### Fixed
- Falso positivo de navegação: keywords curtas (ex. `ca`) não batem mais como substring em palavras como `calendario`.

## [5.42.0] - 2026-07-27

### Features
- **IA Tools — Auditoria e expansão**:
  - Correção de KPIs (`PENDING_LEADER|PENDING_MANAGER`, reembolso `pendente`), Excel/PDF (`ponto`, `compras`, `eventos`, `cursos`, `epis`) e `buscar_reembolsos` (user_id + email / `valorTotal`).
  - Microsoft Graph com paginação (`@odata.nextLink`), filtros ricos e `limite=0` até hard cap 1000.
  - KPIs cruzam pendências do portal com sinais de **e-mail e Teams** (`kpi-comms-signals.ts`, `buscar_sinais_kpi_comunicacao`).
  - Novos módulos: tripulantes, afastamentos, acidentes, fatores e-Social, escalas (local), EPI estoque/CA/entrega, ponto resumo/inconsistências, Academy matrícula/certificados/quizzes.
  - Fase 3: `meus_emails`, `meu_calendario`, `criar_evento_calendario`, `minhas_conversas_teams`, `pesquisar_mensagens_teams`, `navegar_portal`.
  - Registry modular (`microsoft` / `calendario` / `chat` / `portal`) + bridge no `executeToolCall`.
  - AI Companion (`AICompanionWidget`, `/api/ia/companion`, `portal-action-bus`).
- **DOX**: `src/lib/ia/AGENTS.md` + preferência Graph/KPI no root `AGENTS.md`.

### Fixed
- Limites fixos de e-mail Graph (`$top=5` / descrição “últimos 5”) substituídos por extração conforme a solicitação do usuário.

## [5.41.1] - 2026-07-27

### Fixed
- **Redirecionamento e Links de Aprovação de Férias (`/admin/leave-approvals`)**:
  - Criada a página de redirecionamento `src/app/admin/leave-approvals/page.tsx` para direcionar automaticamente e-mails antigos e acessos diretos para `/ferias?tab=approvals`.
  - Atualizada a página `/ferias` (`src/app/ferias/page.tsx`) para selecionar automaticamente a aba "Aprovações Pendentes" quando o parâmetro `?tab=approvals` estiver presente na URL.
  - Corrigido o modelo de e-mail de aprovação pendente (`src/lib/emailTemplates.ts`) e as notificações globais (`src/services/leaveNotifications.ts`) para utilizarem a URL correta `/ferias?tab=approvals`.

## [5.41.0] - 2026-07-24

### Changed
- Atualização do módulo de IA e integração e-Social.

## [5.40.0] - 2026-07-23

### Fixed
- **Filtro Defensivo Multicamada Contra Leitura de Raciocínio Interno (`stripReasoningBlocks`)**:
  - Modelos com capacidade de raciocínio encadeado (Chain-of-Thought), como Gemini 2.5, DeepSeek R1, Llama 3 Thinking e Qwen QwQ, geravam tags como `<thought>` no corpo do texto final.
  - Implementado o utilitário `stripReasoningBlocks` que purga automaticamente blocos `<thought>`, `<think>` e `<reasoning>` (completos ou incompletos) em 3 camadas:
    1. **Camada de API Backend (`client.ts`)**: Filtra `chatCompletion` e requisições SSE `chatCompletionStream`.
    2. **Camada de Interface UI (`MessageBubble.tsx`)**: Guarda defensiva antes do `renderContent`.
    3. **Camada de Prompt do Sistema (`context-builder.ts`)**: Adicionada a *REGRA ABSOLUTA DE COMUNICAÇÃO* que proíbe qualquer modelo de incluir rascunhos de pensamento na resposta final.

## [5.39.0] - 2026-07-23

### Fixed
- **Compatibilidade Estrita de Tool Calls com Google Gemini (`client.ts`)**:
  - Removido o campo `name` dos objetos de resposta da ferramenta (`role: 'tool'`). A especificação OpenAI/Gemini rejeita a propriedade `name` no nível da mensagem de ferramenta, corrigindo o erro HTTP 400/500 que impedia a execução de mensagens com tools no Gemini.
- **Sanitização de Mensagens e Resolução de Modelos (`sanitizeMessagesForLLM` e `resolveModel`)**:
  - Limpeza automática de mensagens enviadas ao LLM para remover campos internos e conteúdos vazios.
  - Resolução automática do modelo default quando `config.model_default` é inválido ou `'default'` (fallback automático para `gemini-2.5-flash` ou `gpt-4o-mini`).
- **Parsing de Erros Transparente na UI (`ChatWindow.tsx`)**:
  - `parseApiJson` agora realiza o parse das respostas JSON de erro antes da checagem HTML, exibindo o diagnóstico real do servidor na tela do chat em vez da mensagem genérica.

## [5.38.0] - 2026-07-23

### Features
- **Arquitetura de Sub-Agentes Especializados (`agents-router.ts`)**:
  - O sistema de IA agora roteia dinamicamente cada mensagem do usuário para o Sub-Agente adequado do seu domínio:
    - 👥 **`agente_rh_tripulantes`**: Perfil, férias, reembolsos, EPIs, embarques.
    - 🩺 **`agente_aso_saude`**: ASOs, exames ocupacionais, quarentena.
    - 🏛️ **`agente_esocial_compliance`**: Eventos e-Social, CAT (S-2210), Afastamentos (S-2230), Riscos (S-2240).
    - 📊 **`agente_analytics_admin`**: KPIs, relatórios em Excel, dashboards visuais.
    - 💬 **`agente_geral`**: Atendimento geral e navegação.
  - **Redução Drástica de Payload**: Reduz o envio de 25+ ferramentas para apenas 4-5 ferramentas focadas por domínio, aumentando imensamente a velocidade e a taxa de acerto da IA.
- **Sanitização Estrita de Esquema para o Google Gemini (`sanitizeToolsForLLM`)**:
  - Remove propriedades customizadas não-padrão (`adminOnly`, `requireModule`, `requireTeamAccess`) da especificação de ferramentas antes de enviar para o LLM.
  - Garante conformidade estrita com o validador OpenAPI/JSON Schema do Google Gemini, eliminando erros 400/500 de rejeição de requisição.

## [5.37.0] - 2026-07-23

### Fixed
- **IA Chat API Errors & Fallbacks (`/api/ia/chat`)**: Adicionada mensagem de erro clara quando a IA não está configurada no banco, orientando o usuário a acessar o Painel Admin (`/admin/ia-config`) para inserir a API Key e escolher o modelo.
- **Env Var Fallback (`getIAConfig`)**: Suporte a fallback via variáveis de ambiente (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `IA_ENDPOINT`, `IA_MODEL`) caso a tabela `ia_config` no Supabase não possua registro configurado.

## [5.36.0] - 2026-07-23

### Features
- **Suporte Oficial a Google Gemini**: Adicionada compatibilidade completa com a API do **Google Gemini** (via endpoint OpenAI Compatibility `https://generativelanguage.googleapis.com/v1beta/openai`). Suporta chave do Google AI Studio com modelos `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-1.5-flash` e `gemini-1.5-pro`.
- **Consulta Dinâmica de Modelos no Painel Admin (`/admin/ia-config`)**:
  - Novo botão **🔍 Buscar Modelos Disponíveis no Servidor**: envia requisição ao endpoint configurado (`GET /api/ia/models?endpoint=...&api_key=...`) e extrai dinamicamente a lista de modelos ativos.
  - Menu suspenso `<select>` que permite ao Administrador escolher qualquer modelo retornado pelo servidor em vez de digitar manualmente.
- **Suporte Multi-Provedor Expandido**: Presets nativos para **Google Gemini**, **OpenAI (ChatGPT)**, **LM Studio**, **llama.cpp** e **Outros (OpenRouter, Groq, Ollama, DeepSeek)**.
- **Normalização Automática de Endpoint (`normalizeEndpoint`)**: Ajusta URLs do Gemini e provedores compatíveis para garantir requisições válidas em `/models` e `/chat/completions`.

## [5.35.0] - 2026-07-23

### Features
- **Hub Central de Movimentação (`/api/employee-hub`)**: View consolidada `vw_employee_hub` e serviço `employee-hub-service.ts` para consulta unificada de colaboradores (dados pessoais, documentos, ASOs, embarques, linha do tempo e-Social, afastamentos, acidentes CAT e treinamentos). APIs: `GET /api/employee-hub/[id]`, `GET /api/employee-hub/[id]/timeline` e `GET /api/employee-hub/search`.
- **e-Social — Suporte Completo a Eventos**: XML generators oficiais (leiaute S-1.3) para **S-2205** (Alt. Cadastral), **S-2206** (Alt. Contratual), **S-2210** (CAT), **S-2230** (Afastamento Temporário), **S-2298** (Reintegração) e **S-2299** (Desligamento). Validações completas em `esocialValidator.ts`.
- **Motor de Sincronização Genérico (`esocial-sync.ts`)**: Sincronização de status bidirecional para todos os eventos do e-Social espelhados nas tabelas de origem (`gt_colaboradores`, `gt_documentos_aso`, `gt_afastamentos`, `gt_acidentes`).
- **Módulos de Afastamentos e Acidentes (CAT)**: Novas tabelas `gt_afastamentos` e `gt_acidentes` com APIs CRUD e auto-geração automática de eventos **S-2230** e **S-2210**.
- **Identity Gate — Quarentena Automática**: Quando o OCR não consegue extrair o CPF de um documento ASO, o sistema coloca o documento diretamente em quarentena (`identity_match = 'quarantine'`, `colaborador_id = null`), prevenindo a atribuição indevida a perfis errados.

### Database & Migrations
- `20260724_000001_fix_aso_identity_backfill.sql`: Reavaliação e correção de ASOs antigos em `unknown`.
- `20260724_000002_esocial_tracking_columns.sql`: Colunas de rastreamento de eventos e-Social em `gt_colaboradores`.
- `20260724_000003_create_gt_afastamentos.sql`: Tabela de afastamentos.
- `20260724_000004_create_gt_acidentes.sql`: Tabela de acidentes CAT.
- `20260724_000005_create_employee_hub_view.sql`: View unificada `vw_employee_hub`.

## [5.34.0] - 2026-07-23

### Features
- **ASO identity gate**: OCR reassocia só por CPF (quarantine se não achar); sync `gt_documentos_aso.esocial_status` no envio/consulta S-2220; UI rascunhos vs disponíveis; `GET /api/gestao-tripulantes/aso?cpf=` só pós-envio.
- **Escala personalizável**: tabela `gt_tipos_evento_escala` + admin Marcadores; cores/labels dinâmicos na grade; preview de observações; PUT de embarques; OFF-C round-trip; realtime merge só `origem=local`.

### Docs / Ops
- Migrations `20260723_000001_aso_identity_gate.sql` e `20260723_000002_gt_tipos_evento_escala.sql` (já aplicadas no Supabase); script `scripts/run-aso-escala-migrations.js`.
- DOX `src/app/api/gestao-tripulantes/AGENTS.md`.

## [5.33.0] - 2026-07-23

### Security
- **sharp@0.35.3** (direct dependency + `overrides`): remedia libvips / Dependabot **#247** (GHSA-f88m-g3jw-g9cj; CVE-2026-33327/33328/35590/35591). Antes transitivo via `next@15.5.21` → `sharp@0.34.5`. Não usar `npm audit fix --force` (sugere downgrade Next→14).
- **elliptic / GHSA-848j-6mx2-7j84 (Dependabot #155)**: removido polyfill webpack não usado `crypto-browserify` (`crypto: false` em `next.config.js` + uninstall). Sem fix upstream em elliptic ≤6.6.1; não usar `npm audit fix --force`.
- **Residual**: apenas `xlsx` (high, sem fix npm — migrar depois).

### Changed
- App version **5.33.0**.

## [5.32.0] - 2026-07-23

### Features
- **Email via Microsoft Graph**: transporte `smtp` | `graph` | `auto` em `/admin/email-settings` e `EMAIL_TRANSPORT`. Para O365 com erro Outlook **535**, preferir Graph (`MS_GRAPH_CLIENT_ID` / `SECRET` / `TENANT_ID` + permissão `Mail.Send`).
- **Fallback automático**: se SMTP falhar com 535 e o Graph estiver configurado, o envio tenta Graph.
- Novo `src/lib/email-graph.ts`; senha SMTP opcional quando o transporte efetivo é Graph.

### Docs
- DOX/admin email-settings, `.env.example` e `AGENTS.md` atualizados com Graph e orientação 535.

## [5.31.0] - 2026-07-23

### Security
- **Next.js 15.5.21** (+ `eslint-config-next@15.5.21`): closes Dependabot Next 14.x advisories; migrated async `cookies`/`headers`/`params`, `serverExternalPackages` in `next.config.js`. Custom `server.js` + Guacamole/WebSocket proxy kept intact.
- **jspdf@4.2.1** (+ `jspdf-autotable@5.0.8` for peer `^4`): remediates jsPDF critical advisories.
- **nodemailer@9.0.3** (+ `@types/nodemailer@^8`): remediates nodemailer high advisories.
- **npm overrides**: `glob@10` → `10.5.0`, `minimatch@9` → `9.0.9`, `postcss` → `8.5.22`, `uuid` → `11.1.1`.
- **Residual (tracked at 5.31.0)**: `elliptic` + `sharp` (fixed in **5.33.0**), `xlsx` (still residual).

### Changed
- App version **5.31.0**; React 18 retained on Next 15.

## [5.30.0] - 2026-07-23

### Security
- **Git history purge**: Removed leaked credential files and literal secrets from branch history (`git filter-repo`); collaborators with old clones should re-clone. Credential **rotation remains mandatory** (O365, JWT, Supabase, etc.) — purge does not revoke exposed keys.
- **No hardcoded secrets**: Email/JWT/WKRadar fallbacks removed; runtime uses `src/lib/email-env.ts`, `src/lib/jwt-secret.ts`, and `WKRADAR_DEFAULT_PASSWORD` (server-side only).
- **Debug routes hardened**: `guardDebugRoute` blocks production access; `/api/email/debug` is admin-only and never returns passwords; TLS SMTP uses `rejectUnauthorized: true`.
- **Secret scanning CI**: `.gitleaks.toml` + `.github/workflows/secret-scanning.yml` (Gitleaks).

### Features
- **Admin email credentials UI**: `/admin/email-settings` (menu Sistema) — ADMIN can view/update SMTP account; password stored encrypted in `app_secrets`.
- **Runtime resolution**: DB (`app_secrets`) → env (`EMAIL_*` bootstrap/fallback) → throw; API `GET/PUT/POST /api/admin/email-settings` with masked password and optional SMTP test.

### Docs
- `SECURITY.md`, `tasks.md`, `AGENTS.md`, and `src/app/api/admin/email-settings/AGENTS.md` document posture, rotation checklist, and DOX contracts.
- `.env.example` documents required vars without real secrets; ops SQL helper `scripts/email-credentials-app-secrets.sql`.

## [5.29.0] - 2026-07-15

### Added
- **Reembolso — Três listas de e-mail no admin**: Em `/admin/reimbursement-settings` agora é possível configurar separadamente aprovadores `@groupabz.com`, aprovadores de outros domínios e e-mails do financeiro/fiscal (pagamento), com add/remove livre em cada lista.
- **Reembolso — Helper de roteamento**: Novo `src/lib/reimbursement-email-routing.ts` centraliza defaults, normalização de configs legadas e resolução de destinatários por domínio.
- **Reembolso — Templates oficiais**: Novos templates em `emailTemplates.ts` no padrão ABZ (`reimbursementApprovalRequestTemplate`, `reimbursementPaymentTemplate`, `reimbursementFinancePendingTemplate`).

### Changed
- **Reembolso — Fluxo de e-mails por domínio**: Solicitantes `@groupabz.com` enviam aprovação inicial para a lista de aprovadores internos (ex.: Andresa); demais domínios usam a lista de aprovadores externos; após qualquer aprovação, o financeiro/fiscal recebe o e-mail para marcar como pago.
- **Reembolso — Defaults alinhados**: Defaults atualizados para `andresa.oliveira@groupabz.com` (aprovação interna) e `fiscal@groupabz.com` (externos e pagamento), substituindo o legado que misturava Andresa+fiscal e usava `financeiro@`.

### Fixed
- **Reembolso — Externos sem destinatário de aprovação**: Solicitantes fora de `@groupabz.com` agora recebem envio correto aos aprovadores externos (antes só o solicitante ou `logistica@`).
- **Reembolso — Fiscal na criação indevida**: Configs antigas com fiscal junto dos aprovadores internos são normalizadas automaticamente (fiscal vai para a lista de pagamento).

### Tests
- `scripts/test-reimbursement-email-routing.ts`: cobre defaults, roteamento groupabz vs externo, listas independentes, migração de configs legadas e regra de domínio desligada.

## [5.28.0] - 2026-07-14

### Added
- **Voice Server — Supertonic 3 TTS**: Substituído o Piper TTS pelo Supertonic 3 (99M parâmetros, 31 idiomas incluindo PT-BR). Roda 100% em CPU via ONNX, sem necessidade de GPU. Vozes preset: M1, M2, M3, F1, F2, F3. Novo `scripts/voice-server/requirements.txt` para dependências do voice server.
- **Voice Server — Teste de conexão SMTP**: Endpoint `GET /api/email/test-connection` agora limpa o cache do transporter antes de testar, garantindo credenciais frescas.

### Changed
- **Email Exchange — Tratamento de erro 535**: Detecta autenticação falhada do Office365 (535 5.7.3) e retorna mensagem orientando sobre credenciais expiradas ou BASIC Auth desabilitado. Removido fallback hardcoded de senha (`[REDACTED]`) — agora exige `EMAIL_PASSWORD` configurado.
- **Email Exchange — Validação pré-conexão**: `createTransport()` valida se `EMAIL_PASSWORD` está configurado antes de tentar conectar, evitando erros genéricos.
- **Auth — Anti-duplicação de erros**: `sendPasswordResetEmail()` e `request-password-reset/route.ts` não envolvem mensagens de erro com prefixos adicionais, eliminando a cadeia "Erro ao enviar email: Erro ao enviar email de redefinição: Erro ao enviar email: ...".
- **Voice Manager — Instalação atualizada**: `abz_voice_manager.sh` instala `supertonic` + `numpy` em vez de `piper-tts`. Download automático do modelo Supertonic 3 na primeira execução.
- **Secure Credentials — Cache com TTL**: Cache de credenciais agora expira após 1 minuto (`CACHE_TTL_MS`), evitando dados stale após atualização via painel admin.
- **Voice Agent error handling**: Tratamento de exceção genérica e HTTP≠200 da tool `processar_texto` retorna mensagens amigáveis e neutras, sem revelar detalhes de erro do gateway.
- **IA System Prompt (context-builder.ts)**: Instrução "INFORME o erro ao usuário" substituída por proibição explícita de frases como "estamos tendo erro", "deu erro" ou "sistema fora do ar". A IA agora reconduz a conversa de forma gentil.
- **IA Client Fallback (client.ts)**: Nota de fallback que citava "dificuldades técnicas" trocada por "(Resposta baseada em cache parcial.)", eliminando exposição de falha interna na resposta.

### Fixed
- **Reembolso — Exclusão por UUID ou protocolo**: `DELETE /api/reembolso/[id]` agora aceita tanto UUID quanto número de protocolo, corrigindo erro 404 ao tentar excluir reembolsos identificados por UUID.
- **Reembolso — Modal de detalhes usa ID**: `ReimbursementDetailModal` usa `reimbursement.id` como identificador na requisição DELETE, evitando problemas com encoding de URL do protocolo.
- **Férias — Validação de antecedência**: Corrigido `advanceNoticeDays >= 0` (antes era `> 0`), permitindo configurar prazo zero quando necessário.
- **Leave Config — Cache-Control**: Endpoint `GET /api/leave/config` agora retorna `Cache-Control: no-store` para evitar cache de dados sensíveis.
- **Voice Agent (agent.py)**: Tool `processar_texto` agora tem fallback para o LLM local (llama.cpp) quando o gateway do portal (`/api/ia/voice/process`) está indisponível. Antes, se o portal estivesse fora do ar, a voz ficava muda. Agora a IA responde mesmo offline.
- **Voice Agent (agent.py)**: Fallback do LLM local envia `chat_template_kwargs: {enable_thinking: false}` + `max_tokens: 400` para evitar que o Qwen gaste o orçamento de tokens raciocinando e devolva conteúdo vazio (voz muda).
- **Voice Agent (agent.py)**: Removida exposição de erros ao usuário — qualquer falha do gateway/disponibilidade cai em mensagem natural e aciona o fallback local.
- **Voice Agent (agent.py)**: A IA deixou de confessar erros técnicos ao usuário. Regra #7 do system prompt alterada de "explique o erro ao usuário" para "NUNCA diga que houve erro; mantenha-se no personagem".

## [5.27.2] - 2026-07-03

### Added
- **Notificações a TODOS os e-mails em TODAS as etapas**: o RH e a lista de e-mails adicionais (DP e demais responsáveis) agora recebem notificações em todas as etapas do processo de férias — nova solicitação, avanço do líder para o gerente, aprovação final E rejeição. Antes a rejeição e o avanço de etapa não notificavam a lista adicional; agora todos os destinatários configurados são sempre notificados, junto com o colaborador solicitante.
- **E-mails no padrão ABZ**: novos templates formais em `src/lib/emailTemplates.ts` seguindo o mesmo padrão visual dos templates de reembolso (logo, header, footer, cores padronizadas, caixas de destaque): `leaveRequestCreatedTemplate`, `leaveNewRequestNotificationTemplate`, `leaveApprovedTemplate`, `leaveApprovedNotificationTemplate`, `leaveRejectedTemplate`, `leaveRejectedNotificationTemplate`, `leavePendingManagerTemplate`, `leavePendingManagerNotificationTemplate`, `leaveApprovalPendingTemplate`.
- **Comprovante de Férias em PDF (download)**: novo `src/lib/leavePDFGenerator.ts` gera dois documentos no padrão ABZ (header com logo, identificação, períodos, opções, assinaturas):
  - **Comprovante de uma solicitação existente** via `GET /api/leave/[id]/pdf` — disponível para o colaborador, líder/gerente do setor, admin e usuários com ACL `ferias:read/manage/admin`.
  - **Formulário em branco** para preenchimento manual/impressão via `GET /api/leave/form-pdf` — disponível para qualquer usuário autenticado (útil para colaborador, gerente e DP).
  - Botões de download adicionados em `/ferias` (botão "Formulário" no header + botão "Comprovante" em cada solicitação) e em `/admin/leave-requests` (botão "Comprovante (PDF)" no modal de detalhes).

### Changed
- **Configuração simplificada**: removido o campo dedicado do responsável individual do painel admin. Agora há apenas um campo único de "E-mails Adicionais para Notificação" (lista separada por vírgula) que pode conter quantos e-mails forem necessários (DP, diretores, fiscais, etc.).
- **`src/lib/leaveConfig.ts`**: removida a constante e a função do responsável individual. A função `getLeaveExtraNotifyEmails()` agora retorna apenas os e-mails configurados na lista (sem fallback hardcoded). Nova função `getLeaveNotificationRecipients()` retorna RH + lista adicional combinados (usada pelo sistema de notificações).
- **`src/services/leaveNotifications.ts`**: refatorado para usar os templates formais ABZ. Todos os eventos (criação, aprovação, rejeição, avanço) agora notificam RH + lista adicional em paralelo via `sendEmailToMultipleRecipients`. Logging informativo para auditoria.
- **`src/app/api/admin/leave-settings/route.ts`**: removido o campo individual do responsável (GET e POST). A UI agora mostra apenas 3 campos globais: E-mail do RH, E-mails Adicionais (lista), Prazo de Antecedência.
- **`src/app/admin/leave-settings/page.tsx`**: seção "1. Configurações Globais" reorganizada com banner informativo explicando que TODOS os e-mails configurados recebem notificações em TODAS as etapas. Campo de e-mails adicionais renomeado para "E-mails Adicionais para Notificação (DP e responsáveis)" com placeholder mostrando exemplo de lista.

### Tests
- `scripts/test-leave-advance-notice.ts` atualizado para refletir a remoção do fallback do responsável individual: 23 testes (antes 25) cobrindo as constantes restantes, funções async, validações e a nova função `getLeaveNotificationRecipients()` que combina RH + extras.

## [5.27.1] - 2026-07-03

### Added
- **Painel Admin do Módulo de Férias expandido** (`/admin/leave-settings`): agora permite configurar (sem precisar mexer em código/env):
  - E-mail do RH (já existente, mantido)
  - Lista de e-mails adicionais para notificação (separados por vírgula) — DP e demais responsáveis
  - Prazo de antecedência em dias (default 40, configurável de 1 a 365) — novo campo
  - As configurações são persistidas na tabela `app_secrets` com as chaves `LEAVE_ADVANCE_NOTICE_DAYS` e `LEAVE_EXTRA_NOTIFY_EMAILS`.
- **Endpoint público `GET /api/leave/config`**: retorna o prazo de antecedência configurado e a data mínima permitida para o frontend montar as validações client-side dinamicamente. Apenas autenticado (não exige admin), não expõe e-mails.

### Changed
- **`src/lib/leaveConfig.ts`**:
  - Adicionadas funções async `getAdvanceNoticeDays()`, `getMinLeaveStartDateAsync()`, `validateLeaveAdvanceNoticeAsync()` que leem do banco (com fallback para env e default 40).
  - Adicionadas constantes `LEAVE_ADVANCE_NOTICE_DAYS_KEY`, `LEAVE_EXTRA_NOTIFY_EMAILS_KEY` e `DEFAULT_LEAVE_ADVANCE_NOTICE_DAYS`.
  - Versões síncronas `LEAVE_ADVANCE_NOTICE_DAYS`, `getMinLeaveStartDate()`, `validateLeaveAdvanceNotice()` mantidas para compatibilidade, marcadas como `@deprecated` quando aplicável, usando o fallback default.
- **`src/lib/secure-credentials.ts`**: adicionada função `clearCredentialCache(key?)` para invalidar o cache em memória após escrita direta no banco via painel admin.
- **`src/app/api/admin/leave-settings/route.ts`**: GET/POST aceitam e persistem `extraNotifyEmails` e `advanceNoticeDays`. Limpa o cache de credenciais após cada escrita.
- **`src/app/api/leave/requests/route.ts`**: validação do prazo agora usa `validateLeaveAdvanceNoticeAsync()` que lê do banco.
- **`src/app/ferias/page.tsx`**: carrega as configurações do endpoint `/api/leave/config` no mount e usa os valores carregados para o banner âmbar, atributo `min` do input de data e validação client-side.

## [5.27.0] - 2026-07-03

### Added
- **Reembolso Inteligente - Validação de Valores por Tipo**: Novo módulo `src/lib/reimbursementValidation.ts` centraliza limites por tipo de despesa (alimentação: R$ 2.000, transporte: R$ 1.000, hospedagem: R$ 5.000, combustível: R$ 1.000, material: R$ 5.000, outros: R$ 10.000) e total máximo por solicitação (R$ 50.000). Parser robusto aceita `1.234,56`, `1234.56`, `R$ 50,83` e números. Validação timezone-safe de datas (rejeita futuras e >1 ano).
- **Reembolso - Avisos Visuais no Form**: Banners vermelhos para valores acima do limite máximo e banners amarelos com botão "Confirmar valor" para valores acima do típico mas dentro do limite, permitindo que o usuário confirme valores legítimos altos sem bloquear a entrada.
- **Férias - Alertas automáticos por e-mail**: Sempre que uma nova solicitação de férias é aberta, e-mails automáticos são enviados para o RH e para a lista de e-mails adicionais configurada via painel admin. Quando aprovada, o colaborador recebe um e-mail confirmando que as férias foram "programadas conforme solicitado", com o período detalhado. Lista configurável via credencial `LEAVE_EXTRA_NOTIFY_EMAILS` ou variável de ambiente (separados por vírgula).
- **Férias - Prazo de antecedência de 40 dias**: Implementado o prazo mínimo de 40 dias de antecedência para a data de início das férias (solicitação do DP para cumprimento do prazo legal de processamento). Novo módulo `src/lib/leaveConfig.ts` com `LEAVE_ADVANCE_NOTICE_DAYS` configurável via env, `validateLeaveAdvanceNotice()`, `getMinLeaveStartDate()` e `formatDatePTBR()`.
- **Férias - Validação server-side do prazo**: `POST /api/leave/requests` valida a data de início do primeiro período contra o prazo de antecedência e retorna `400` com `code: INSUFFICIENT_ADVANCE_NOTICE`, `minDate` sugerida e `requiredDays` quando rejeitado.

### Changed
- **CurrencyInput - Modo decimal intuitivo**: Substituído o `handleBankingStyleInput`/`formatBankingValue` por `formatDecimalInput` onde `50,83` vira `R$ 50,83` (em vez do "formato bancário" onde `50` virava `R$ 0,50`). Valor é normalizado para `X,XX` no blur. Adicionado `inputMode="decimal"` para abrir o teclado numérico correto no mobile.
- **MultipleExpenses - UX aprimorada**: Removido o texto confuso `* Formato bancário: Digite os números (ex: "50" = R$ 0,50 | "5000" = R$ 50,00)`. Adicionado banner informativo sobre o formato correto (vírgula como separador de centavos). Mostra o limite máximo da categoria abaixo do seletor de tipo.
- **ReimbursementForm - Data com max**: Input de data com `max={getTodayDateString()}` impede seleção de datas futuras no calendário. Valor total enviado ao backend no formato pt-BR (`1.234,56`) para o parser do backend funcionar corretamente.
- **FormFields - InputField com max/min**: InputField agora forward `max`/`min` para o `<input>` subjacente, permitindo limitar seleção de datas.
- **Férias - Email de aprovação mais explícito**: O e-mail de "Férias Aprovadas" agora menciona explicitamente que as férias estão "programadas conforme solicitado" e inclui badges para Abono Pecuniário e 1ª parcela do 13º quando aplicável.
- **Férias - Aviso visual no modal**: O modal "Nova Solicitação de Férias" agora exibe um banner âmbar explicando o prazo de 40 dias de antecedência e mostrando a data mais próxima permitida. Input de "Data de Início" do primeiro período tem `min` configurado para impedir seleção no calendário, com feedback vermelho inline quando o usuário digita uma data próxima.

### Fixed
- **Reembolso - Bug do "formato bancário"**: Corrigido o bug onde digitar `5000,83` (esperando R$ 5000,83) resultava em R$ 5.000.083,00. O novo parser interpreta diretamente o que o usuário digita, com vírgula como separador de centavos.
- **Reembolso - Valores absurdos aceitos**: Corrigido o bug onde uma despesa de alimentação de R$ 5.000.083,00 ou R$ 50.000,83 era aceita sem qualquer alerta. Agora é rejeitada no formulário, no schema e na API.
- **Reembolso - Datas futuras aceitas**: Schema validava mas o calendário permitia selecionar datas futuras. Agora o input tem `max=today` e o schema valida com timezone-safe.
- **Férias - Erro tratado no submit**: Quando a API retorna erro de validação (ex: prazo insuficiente), o erro agora é exibido via toast em vez de mostrar apenas "Failed to submit" genérico.

### Tests
- `scripts/test-reimbursement-validation.ts`: 42 testes unitários cobrindo parsing de valores, formatação, validação por tipo, validação total e validação de data.
- `scripts/test-leave-advance-notice.ts`: 16 testes unitários cobrindo configuração de 40 dias, cálculo de data mínima, validação de antecedência e fallback de emails extras.

## [5.26.5] - 2026-07-01

### Fixed
- **Voice Audio Server (TTS Output)**: Synchronized `audio_server.py` with the locally-tested corrected version. Critical fixes:
  - **DEFAULT_VOICE** changed from `M1` to `F1` (better Portuguese pronunciation quality).
  - **NumPy array handling**: Replaced naive `flatten()` with robust multi-dimensional array squeeze + 1D mono enforcement. Prevents `ValueError` and distorted audio when Supertonic 3 returns arrays with shapes like `(1, N)` or `(2, N)`.
  - **Dynamic sample rate inference**: Instead of hardcoding `22050` (incorrect for Supertonic 3), the server now calculates the actual sample rate from the synthesized audio duration and number of samples, falling back to `24000` Hz. Produces correct playback speed.
  - **Duration logging fix**: Removed `:.2f` format specifier that caused `TypeError` when `duration` is a numpy array instead of a float.
  - **Heuristic language detection**: TTS endpoint now detects Portuguese vs English input from common English words, instead of always forcing `lang="pt"`. Prevents garbled pronunciation of English phrases.

- **Voice Agent (STT & Greeting)**: Synchronized `agent.py` with the locally-tested corrected version:
  - **STT language forced to `pt`**: `openai.STT` now receives `language="pt"` parameter to prevent Whisper hallucinations and unwanted English translations of Portuguese speech.
  - **Greeting disabled**: Commented out `session.generate_reply()` greeting that caused HTTP 500 errors. The Qwen LLM via llama.cpp requires `role=user` in Jinja template context; system-only prompts from `generate_reply` crash the Jinja renderer. The user now initiates the conversation.

### Added
- **Voice Agent Auto-Restart Script**: Added `run_agent_loop.sh` to the repository. Wraps `agent.py start` in a `while true` loop with 2-second backoff. Automatically restarts the LiveKit Agent if it crashes or disconnects, ensuring voice service availability without manual intervention.

## [5.26.4] - 2026-07-01

### Fixed
- **Voice Pipeline Stability**: Comprehensive fixes for the LiveKit Voice Agent pipeline:
  - Fixed TTS `response_format` to use `pcm` instead of `mp3` to comply with `livekit-plugins-openai` expectations for raw byte streaming.
  - Fixed `audio_server.py` to stream raw bytes correctly.
  - Fixed `abz_voice_manager.sh` to initialize the agent using `python3 agent.py start`.
  - Added robust error handling and status logging to the Next.js API route (`route.ts`) for proper `createDispatch` error propagation.

## [5.26.3] - 2026-07-01

### Fixed
- **Voice Agent Dependencies Versioning**: Corrected the version constraint for `supertonic` in `requirements.txt` from `>=3.0.0` to `>=1.3.0`. The python library for Supertonic 3 is versioned under `1.3.x` on PyPI, causing dependency installation failures.

## [5.26.2] - 2026-07-01

### Fixed
- **Voice Agent Dispatch**: Fixed an issue in `route.ts` where explicit dispatching to LiveKit was calling `createDispatch()` with an empty `agentName` instead of `'abz-voice'`, preventing the registered agent from joining the room.

## [5.26.1] - 2026-07-01

### Fixed
- **Voice Agent Dependencies**: Added missing `aiohttp` dependency to `requirements.txt` to prevent runtime `ModuleNotFoundError` crashes when the LiveKit voice agent invokes the Portal ABZ AI gateway API (`processar_texto`).

## [5.26.0] - 2026-06-18

### Added
- **Relatório de Estoque de EPI (PDF)**: Nova funcionalidade para geração de relatórios de estoque em formato PDF. O relatório consolida níveis de estoque atuais, alertas de estoque baixo (abaixo do mínimo) e histórico de movimentações (Entradas, Saídas, Ajustes e Devoluções).
- **Detalhamento do Relatório**: Inclusão de colunas dedicadas de CA (Certificado de Aprovação), Data de Validade do CA e Local de Armazenamento na tabela consolidada do PDF.
- **Filtros Avançados no Modal**: Adicionados filtros de Nome do EPI, Número do CA, Data Limite de Validade do CA e Estoque Máximo Permitido na interface de configuração do relatório.
- **Filtros e Estoque em Tipos de EPI**: Implementada a barra de filtros (Nome, CA, Validade, Estoque Máximo) na aba "Tipos de EPI", integrando a exibição em tempo real da quantidade em estoque e local de armazenamento no card de cada equipamento.
- **Variações de Tamanho e Sub-divisões de EPI**: Adicionada a capacidade de definir tamanhos ou sub-divisões (ex: "38, 39, 40" ou "P, M, G") no cadastro de Tipos de EPI. O sistema gera automaticamente as variações de estoque associadas a cada tamanho.
- **Cadastro Direto de Variações (Pai/Filho)**: Nova opção no modal de criação de EPI para selecionar um EPI Pai existente e cadastrar diretamente uma única variação de tamanho/medida (child), preenchendo automaticamente categoria e descrição herdadas.
- **Edição de Tipos e Variações de EPI**: Adicionada a possibilidade de editar qualquer tipo de EPI ou variação de tamanho de forma individual através do ícone de edição (lápis) nas abas administrativas, executando a atualização (PUT) em tempo real.
- **Visualização Hierárquica de Estoque**: Os cards da aba "Tipos de EPI" agora agrupam de forma hierárquica as variações de tamanho sob o EPI principal (pai), exibindo o estoque de cada tamanho individualmente, além do estoque total agregado e status de estoque baixo consolidado do equipamento.
- **Filtros e Hierarquia na Aba Estoque**: Implementados os mesmos filtros avançados (Nome, CA, Validade, Estoque Máximo) e visualização em cascata (recuada) na listagem da aba "Estoque", consolidando os dados sob o EPI pai.
- **Seletor de EPI com Busca e Grade no Estoque**: Nova caixa de seleção unificada (combobox) no modal de "Nova Movimentação". A busca por texto agora fica integrada dentro do próprio dropdown, que lista apenas os EPIs principais. Caso o EPI escolhido possua variações de tamanho, um seletor secundário é exibido para escolher a grade, agilizando e organizando a inserção.
- **Função de Reset de Dados Completa**: Atualizada a função de reset do módulo para garantir a remoção total de níveis de estoque (`epi_stock`) e histórico de movimentações (`epi_stock_movements`) no banco de dados, em conjunto com registros e assinaturas.
- **Filtros Personalizados de Relatório**: Adicionado modal para selecionar o tipo de visualização (Estoque Completo, Estoque Baixo ou Histórico de Movimentações) e filtros de data (início/fim) para o histórico.

### Changed
- **Filtros de Data na API de Estoque**: Atualizada a rota `GET /api/epi/stock` e a função `getStockMovements` do backend para aceitar filtros de data de início e fim.

## [5.25.4] - 2026-06-17

### Added
- **e-Social XML Auto-Cura (Auto-Rebuild)**: Added an automatic fallback mechanism in `preEnvioGateway.ts`. If an event stored in the database has an older, structurally broken XML (e.g., missing `<nmMed>` or `<dtExm>`), the gateway now detects the failure and forcibly completely rebuilds the XML payload right before sending, allowing older events to self-heal.
- **e-Social Safe Matrícula Sync**: Updated the e-Social processing pipeline (`consultar-lote/route.ts`). Employee matricula (`matricula_esocial`) is now safely synchronized *only* when the e-Social server returns a `PROCESSADO` (success) status for the event, avoiding contaminating the employee's registry with rejected/invalid matriculas. Removed the eager update from `corrigir-matricula/route.ts`.

### Fixed
- **S-2220 Missing Elements**: Fixed an issue where tags like `<nmMed>`, `<nrCRM>`, and `<dtExm>` could be generated completely empty despite the data existing. `eSocialService.ts` now properly merges root-level fields (which is how flat payloads structure the ASO data) with the `dadosEspecificos` payload, ensuring all required physician and exam tags are correctly populated.
- **S-2220 Strict Validator Rules**: Added strict structural validation checks for `<dtExm>` and `<nmMed>` directly inside `esocialValidator.ts` to block and report XML failures locally instead of sending them to the e-Social XSD schema validator.## [5.25.3] - 2026-06-09

### Fixed
- **S-2220 XML Schema Validation**: Resolved a schema error (`invalid child element 'resAso'`) caused by the omission of the `<dtAso>` element when date source fields are empty. Implemented robust date fallbacks including additional fields (`esp.dtAso`, `esp.data_aso`, `esp.dataAso`) and a default fallback to the current date.

## [5.25.2] - 2026-06-09

### Added
- **e-Social Matrícula Correction Workflow**: Added a `matricula_esocial` column to the `gt_colaboradores` table to store confirmed e-Social registration numbers (in case they mismatch local MIO/WK records).
- **Correct Matrícula API**: New POST endpoint `/api/e-social/corrigir-matricula` that allows correcting an employee's matrícula, updating `gt_colaboradores.matricula_esocial`, and automatically regenerating the event XML and resetting it to review status.
- **Badges and Warnings in Modal**: Modified `NovoEventoModal.tsx` to query and show badges indicating if a matrícula is confirmed in e-Social, imported from MIO/WK, or missing altogether.
- **Correction UI Banner**: Modified `EventoRevisao.tsx` to detect "contract not found" errors returned by the government, displaying a warning banner with clear portal-lookup instructions and a 1-click text input to correct the matrícula and recompile the XML.

### Changed
- **Matrícula Priority Logic**: Updated XML generation functions in `eSocialService.ts` and `xml-generator.ts` as well as the background generation service `eSocialAutoService` to prioritize `matricula_esocial` if it exists.
- **Pre-flight Validation**: Added a check requiring the employee's matrícula for S-2200, S-2220, and S-2240 events before submission.

## [5.25.1] - 2026-06-08

### Added
- **S-2240 Form UI & XML compliance**: Expanded `S-2240` event manual entry in `NovoEventoModal.tsx` to collect all standard fields: condition start date (`dtIniCondicao`), environment description (`dscAmb`), local environment type (`localAmb`), multiple risk factors list (`riscos` array), EPC/EPI efficacy and CA details, and technical responsible details (`respReg`). Corrected the XML generation in `eSocialService.ts` to output standard nested `<infoExpRisco>` layouts instead of invalid flat `<dadosAmb>` layouts.
- **Client-Side OCR Data Extraction**: Modified `/api/gestao-tripulantes/documentos/[id]/ocr` to automatically run `extrairDadosTexto` via regex parser and populate structured document data when receiving raw pre-extracted text (`clientText`) from the browser.

### Changed
- **UF CRM Select Expansion**: Expanded the doctor UF dropdown list from 11 states to include all 27 Brazilian states.
- **e-Social Deduplication Hardening**: Added `'pendente_revisao'` to duplicate check in `/api/gestao-tripulantes/documentos/[id]/esocial` to prevent duplicate event submissions on rapid click spamming.

## [5.25.0] - 2026-05-29

### Added
- **GT Man Schedule Tab**: New `GTManScheduleTab` component (1000+ lines) embeds the Man Schedule directly into the Gestão de Tripulantes page with a tab system (Matriz de Conformidade / Man Schedule). Includes full filtering, vessel/position/company selectors, export to XLSX, and click-to-open collaborator details.
- **Client-Side Tesseract.js OCR**: `pdf-to-images-client.ts` now loads Tesseract.js v5.1.0 from CDN for client-side OCR on scanned PDFs and images. New `extractTextFromPdfOrImageClient()` unified function extracts text from digital PDFs (text layer) or runs Tesseract on scans, entirely in the browser.
- **OCR Text Flow**: `/api/gestao-tripulantes/documentos/[id]/ocr` now accepts a `text` field directly from client-extracted text, alongside the existing `images` array. Enables client-side Tesseract extraction without LLM Vision overhead.
- **ASO Tab — e-Social Event Display**: `ASOTab` now shows both regular ASO documents AND direct e-Social S-2220 events that aren't linked to a document. Displays combined ASO count. Auto-runs OCR after document upload to trigger reassociation.
- **Colaborador API — e-Social ASOs**: `GET /api/gestao-tripulantes/colaboradores/[id]` now fetches e-Social S-2220 events for the collaborator's CPF, returned as `esocial_asos` array.

### Changed
- **Man Schedule Real-Time Fallback**: `GET /api/man-schedule/realtime` now requires JWT authentication. When cache is empty or incomplete, fetches data directly from MIO API in real-time and updates cache in background. Also integrates local/manual embarkations from `gt_historico_embarques`.
- **MIO Cache Selective Update**: `POST /api/mio/cache/atualizar` now supports selective type updates via query parameter (`?tipo=integrantes,lgp_reports`) or body field. Per-type rate limiting (10s per type). Response includes `updated` and `skipped` arrays.
- **MIO Enrich Cache Freshness**: Both `colaboradores/route.ts` and `eSocialAutoService.ts` now check cache freshness (5-minute threshold) before falling back to direct MIO API. Prevents unnecessary API calls when cache is recent.
- **Gestão de Tripulantes Page**: Redesigned with full-width layout and tab system for Matriz de Conformidade vs Man Schedule views.
- **ASOTab OCR Flow**: OCR now sends extracted text instead of images to the API, using client-side Tesseract for scan detection and digital text extraction.

### Fixed
- **e-Social S-2220 ordExame Field**: XML generation now includes `ordExame` (exam order) field with proper parsing from string ("inicial"/"sequencial") or number formats. Correctly distinguishes admissional (1) vs other exam types.

## [5.24.1] - 2026-05-29

### Added
- **ImportarASOModal — Client-Side PDF Rendering**: e-Social ASO import modal now renders PDFs in the browser via Canvas API before sending to OCR, matching the client-side approach used in ASOTab and TreinamentosTab. Progress bar shows real-time status during rendering and OCR processing.
- **ASO Auto-Reassociation by CPF/Name**: `extrairDadosASODoTexto()` now checks if the extracted CPF or full name belongs to a different collaborator. If a match is found, the document is automatically reassigned to the correct collaborator (`gt_documentos.colaborador_id` updated). Logs reassociation action for audit trail.

## [5.24.0] - 2026-05-29

### Added
- **Client-Side PDF Rendering**: New `pdf-to-images-client.ts` library renders PDF pages to JPEG images directly in the browser using PDF.js + Canvas API. Resolves Vercel serverless limitation where native `canvas` module is unavailable. Each page is rendered at configurable scale (default 1.5x) with JPEG compression (quality 0.82).
- **Client-Rendered OCR Pipeline**: New `processarImagensPreRenderizadas()` function processes browser-rendered images via LLM Vision. Supports multi-page PDFs (up to 5 pages) sent in a single LLM request with automatic fallback to individual page processing if the model rejects batch input.
- **ASO Tab — Client-Side OCR**: `ASOTab` component now renders PDFs in the browser before sending to OCR API. Shows real-time progress status ("Renderizando PDF no navegador...", "Enviando para IA..."). Supports both PDF and image documents.
- **Treinamentos Tab — Client-Side OCR**: `TreinamentosTab` component now uses client-side PDF rendering for OCR processing, matching the ASO Tab behavior.
- **OCR API — Dual Flow**: `/api/gestao-tripulantes/documentos/[id]/ocr` now accepts both client-rendered images (new flow) and server-side processing (legacy). Automatically detects request format and routes accordingly.

### Changed
- **OCR Route Timeout**: `maxDuration` increased from 120s to 300s (5 minutes) for LLM vision processing of large documents.
- **OCR Export**: Added `processarImagensPreRenderizadas` to OCR module exports.

## [5.23.8] - 2026-05-29

### Fixed
- **OCR Tesseract.js Serverless Detection**: Added `isServerless` environment detection (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`) to skip Tesseract.js in serverless environments. Tesseract.js uses WASM which doesn't work on Vercel/AWS Lambda. LLM Vision remains the primary strategy for scanned PDFs in production, with local Tesseract fallback only available in Node.js/development environments.
- **OCR Image Processing Pipeline**: Updated `processarDocumentoOCR()` to respect serverless detection — Tesseract fallback for images is now skipped in serverless, falling back to raw text extraction instead.

## [5.23.7] - 2026-05-28

### Changed
- **OCR LLM Vision — PDF-to-Image Conversion**: New `converterPDFParaImagens()` function converts PDF pages to PNG using pdfjs-dist + canvas before sending to LLM Vision. Supports multi-page PDFs (up to 5 pages). Each page is rendered at 2x scale for optimal OCR accuracy. Falls back to direct PDF send if conversion fails.
- **OCR LLM Vision — Multi-Image API Payload**: `extrairTextoViaLLMVisao()` now sends multiple image buffers in a single LLM request when processing multi-page PDFs. Content parts array contains one text prompt + N image_url entries (one per page), replacing the previous single-image approach.
- **OCR PDF Pipeline — Streamlined Cascade**: Simplified `ocrPdfDigitalizado()` by moving PDF-to-image conversion into the LLM Vision strategy. Strategy 3 (pdfjs-dist + Tesseract) now serves as local-only fallback without per-page canvas rendering duplication.
- **IA Sessions — Auto-Cleanup**: `GET /api/ia/sessions` now automatically soft-deletes sessions inactive for more than 30 days. Runs on each list request, keeping session history clean.
- **IA Context Manager — LRU Eviction**: Memory store now caps at 100 concurrent users. When capacity is exceeded, the least-recently-updated user's cache is evicted to prevent memory leaks in long-running processes.

## [5.23.6] - 2026-05-28

### Changed
- **OCR LLM Vision — Multi-Format Support**: `extrairTextoViaLLMVisao()` now accepts a `mimeType` parameter, enabling LLM Vision to process not only PDFs but also images (PNG, JPG, WebP, GIF). Images are now processed via LLM Vision first (90% confidence) with Tesseract as fallback, significantly improving OCR accuracy on image-based documents.
- **OCR PDF Pipeline — Per-Page LLM Vision**: Each rendered PDF page is now processed by LLM Vision first before falling back to Tesseract. This replaces the previous Tesseract-only approach for pdfjs-dist rendered pages, combining the best of both worlds: LLM understanding for complex layouts and Tesseract for reliable fallback.
- **Gestão de Tripulantes — ASO Data in Documents API**: The `GET /api/gestao-tripulantes/colaboradores/[id]` endpoint now enriches ASO documents with structured data from `gt_documentos_aso`. Clients receive `aso_data` field populated with exam details (type, result, physician, clinic) directly in the documents list.
- **OCR Extract Route — Extended Timeout**: `maxDuration` increased from 60s to 300s for the OCR extract endpoint, supporting larger scanned documents that require more processing time for multi-strategy extraction.

## [5.23.5] - 2026-05-28

### Fixed
- **OCR LLM Vision — llama.cpp mmproj Support**: Removed model-name-based vision detection that incorrectly skipped vision for llama.cpp providers. Now when `provider === 'llamacpp'`, LLM Vision is always attempted (users who configure llama.cpp with mmproj intend to use vision). Cloud/lmstudio providers still use model-name detection as fallback. This fixes the "Modelo não parece suportar visão" false negative for custom llama.cpp setups with multi-modal projection.

## [5.23.4] - 2026-05-28

### Fixed
- **OCR LLM Vision — Non-Vision Model Detection**: `extrairTextoViaLLMVisao()` now detects whether the configured LLM model likely supports vision before attempting to send images. Checks model name against known vision models (GPT-4o, Claude 3/4, Gemini, LLaVA, etc.). Non-vision models (llama.cpp text-only, DeepSeek-V3, etc.) are skipped early with a clear log message, avoiding unnecessary 400/500 errors from the LLM server. Removed unsupported `type: "file"` content format that caused "unsupported content[].type" errors with most providers.
- **PoliWeb ASOs Pendentes — Config Error Handling**: Changed HTTP status from 500 to 503 (Service Unavailable) when PoliWeb is not configured. Added `configured: false` flag and `hint` field in response with setup instructions. Added `maxDuration = 120` for longer processing. Improved error message in catch block.

## [5.23.3] - 2026-05-28

### Fixed
- **OCR PDF Pipeline — Scanned PDF Fix**: Complete rewrite of `ocrPdfDigitalizado()` to fix failure on scanned PDFs (no text layer) in Vercel/serverless environments.
  - **LLM Vision Multi-Format**: `extrairTextoViaLLMVisao()` now tries multiple API formats for maximum provider compatibility: first `type:"file"` with `file_data` (OpenAI/Claude format), then `type:"image_url"` with PDF data URI. Each format is tried independently with proper error handling.
  - **CDN Worker for pdfjs-dist**: Strategy 3 now uses CDN-hosted worker URL (`cdnjs.cloudflare.com`) instead of local file path, enabling pdfjs-dist to work on Vercel where local worker files are not included in the serverless bundle.
  - **Direct Tesseract Fallback**: Added strategy 4 — sends raw PDF buffer directly to Tesseract.js as last resort before throwing error.
  - **Improved Error Messages**: Error message now distinguishes between "scanned document without selectable text" and "LLM not configured", guiding users to the correct fix.
  - **Better Logging**: Each strategy logs its attempt and result, making it easier to diagnose which step fails in production.

## [5.23.2] - 2026-05-28

### Changed
- **API Routes Dynamic Rendering**: Added `export const dynamic = 'force-dynamic'` to 15 API routes (leave-approvals, leave-settings, leave-requests, auth/exchange, avaliacao/[id], avaliacao/settings, ia/autonomous/control, ia/chat, ia/config, ia/dashboard, ia/feature-toggles, ia/knowledge-base, ia/models, ia/sessions, user/integrations). Prevents Next.js from caching responses and ensures fresh data on every request.

## [5.23.1] - 2026-05-28

### Changed
- **OCR API Error Responses**: All 4 OCR API routes (`gestao-tripulantes/ocr`, `gestao-tripulantes/ocr/extract`, `ocr/document/process`, `ocr/extract`) now return the actual error message instead of generic "Erro interno do servidor".
- **OCR Route Timeout**: Added `maxDuration = 120` to gestão de tripulantes OCR route for extended processing on large documents.

### Fixed
- **pdf-parse Import Path**: Fixed import from `pdf-parse/lib/pdf-parse.js` to `pdf-parse` (2 locations in `ocr-processor.ts`).
- **Supabase Storage Auth**: `obterConteudoArquivo()` now sends `Authorization: Bearer <service_role_key>` header when downloading files from `supabase.co/storage/` URLs, preventing 403 errors on private buckets.

## [5.23.0] - 2026-05-28

### Added
- **LLM Vision OCR Strategy**: New `extrairTextoViaLLMVisao()` function sends PDF as base64 image to a vision-capable LLM (DeepSeek/Qwen/etc.) for text extraction. Works in any environment (Vercel, local, serverless) — requires only an HTTP call. Handles `<think>` block removal and returns extracted text.

### Changed
- **OCR PDF Pipeline Restructured**: 3-strategy cascade updated:
  1. **pdf-parse custom render** — Primary, serverless-safe text extraction
  2. **LLM Vision** — New middle tier, sends PDF as base64 to vision model, 90% confidence
  3. **pdfjs-dist + canvas + Tesseract** — Local-only fallback (dev/Node environments)
- Removed direct Tesseract.js fallback on raw PDF buffer (unreliable). Error message now suggests configuring LLM vision or using selectable-text PDFs.

## [5.22.0] - 2026-05-28

### Changed
- **OCR PDF Pipeline Complete Rewrite**: `ocrPdfDigitalizado()` now uses a 3-strategy cascade for maximum compatibility across environments:
  1. **pdf-parse with custom render**: Primary strategy using `pdf-parse/lib/pdf-parse.js` with a custom `pagerender` function that captures all text items with Y-coordinate-aware line breaking. Serverless-safe, no worker dependency.
  2. **pdfjs-dist + canvas**: Fallback for local/Node environments only. Checks `pdf.worker.mjs` existence before importing pdfjs-dist. Includes binarization (threshold=128) for improved OCR accuracy on scanned pages.
  3. **Tesseract.js direct**: Last-resort fallback processes the raw PDF buffer through Tesseract when both pdf-parse and pdfjs-dist fail.
- **Next.js Server Configuration**: Removed `outputFileTracingIncludes` for pdfjs-dist. Added `pdf-parse` to `serverComponentsExternalPackages`. Added webpack externals for `canvas` and `pdfjs-dist` on server side to prevent bundling issues.

## [5.21.2] - 2026-05-28

### Changed
- **Next.js Output File Tracing**: Added `outputFileTracingIncludes` for `pdfjs-dist` build files in `next.config.js`. Ensures PDF.js worker (`pdf.worker.mjs`) is properly bundled for serverless/Vercel deployments.
- **OCR PDF Worker Configuration**: Removed manual `GlobalWorkerOptions.workerSrc` setup in `ocr-processor.ts`. PDF.js now resolves its fake worker internally, relying on Next.js output tracing to include the correct files.

## [5.21.1] - 2026-05-28

### Changed
- **OCR LLM Prompt Refinement**: Enhanced ASO extraction prompt with 9 business rules. Added "Empresa x Clinica" rule to prevent contractor company (ABZ/aguas) from being misidentified as the clinic. CNPJ field marked as optional. Medical examiner vs PCMSO coordinator distinction clarified.
- **Next.js Server External Packages**: Added `pdfjs-dist` and `canvas` to `serverComponentsExternalPackages` alongside existing `tesseract.js` for proper server-side rendering of PDF and image processing modules.

## [5.21.0] - 2026-05-28

### Added
- **Authentication Hardening for Leave APIs**: All vacation/leave API endpoints now require JWT token authentication via `Authorization: Bearer` header. Endpoints validate caller identity and ACL permissions before processing requests. Affected routes: `leave-approvals`, `leave-requests`, `leave-settings`, `ferias/admin-access`, `leave/requests`.
- **`checkAclPermission()` Function**: New centralized ACL permission checker in `src/lib/auth.ts`. Queries PostgreSQL with JOINs across `acl_permissions`, `user_acl_permissions`, and `role_acl_permissions` tables. Supports both individual (with expiration) and role-based permissions. Admins always return `true`.
- **Global Leave Access**: `leaveService.ts` now accepts `hasGlobalAccess` parameter. When `true`, admins/managers see all pending requests across all sectors without sector-specific configuration. Self-approval protection remains enforced.
- **ACL → `ferias_admin` Mapping**: Effective permissions endpoint now auto-grants `ferias_admin = true` to ADMIN users and maps ACL `ferias:admin/manage` permissions to the `ferias_admin` module.
- **IA Feedback Module**: New feedback tools system for the AI assistant — `buscar_feedbacks`, `atualizar_status_feedback`, `excluir_feedback` (ADMIN only). Module registered in IA config manager with 💬 icon. Context builder injects pending feedback count for admin users.
- **IA Contract/Attendance Tools**: New tools `obter_link_contracheque` (external WK Radar WebNet link), `buscar_contratos` (contract documents with role-based filtering), `buscar_ponto` (employee attendance records), `buscar_lista_presenca` (available attendance lists).
- **OCR LLM Extraction**: `ocr-processor.ts` now supports intelligent ASO data extraction via LLM (DeepSeek/Qwen). Sends raw OCR text with structured prompt, parses JSON response, and merges with regex results (LLM takes priority). Handles thinking blocks and markdown formatting.
- **3 New IA Module Configs**: `feedback`, `contratos`, and `lista-presenca` modules added to default IA configuration with appropriate read/write role assignments.

### Changed
- **OCR Processor Priority**: In `gestao-tripulantes/ocr-processor.ts`, LLM-extracted data now takes priority over regex extraction for exam type, result, date, physician data, clinic name, and exam list. Regex serves as fallback only.
- **Auth Context Resilience**: `SupabaseAuthContext.tsx` now implements 5-layer try/catch fallback pattern for profile queries. If `sectors` table join fails, falls back to plain `select('*')`. Prevents authentication failures due to missing tables or RLS issues. `sessionStorage.clear()` added on logout.
- **UserEditor ACL Persistence**: ACL permission changes are now batched and persisted on form submit instead of per-click. Reduces database calls from N (one per toggle) to 1 (on save). Includes diff-based add/remove logic.
- **IA Context Builder**: Enhanced with feedback data injection for admins, updated tool usage instructions for contracts, attendance, and paystub access. Simplified pendencias instructions to use `buscar_dados_usuario` with "resumo" type.
- **Leave Requests API**: Now validates JWT token, checks ADMIN role or ACL `ferias:admin/manage` permission for listing/deleting all requests.
- **Leave Settings API**: Now requires ADMIN role for reading/modifying vacation settings.
- **Leave Approvals API**: Validates that the caller is the actual approver (not just any admin) and checks ACL permissions.

### Fixed
- **`requireModule` Corrections**: Fixed wrong module names in IA tools — `reembolsos` → `reembolso`, `avaliacoes_desempenho` → `avaliacao`, `suprimentos` → `compras` (3 tools).
- **OCR RG/CPF False Positive**: `ocr-processor.ts` now cleans both RG and CPF (removes dots, spaces, dashes) and checks if extracted RG is contained within CPF — discards false matches.
- **OCR Birth Date Extraction**: Now uses prefix-specific regex (`DN`, `NASC`, `NASCIMENTO`, etc.) first, then falls back to generic date regex with year < 2015 filter to prevent exam dates from being mistaken for birth dates.
- **PDF.js Worker Check**: Added `fs.existsSync(workerPath)` verification before configuring PDF.js worker. Uses fake worker fallback in serverless/Vercel environments.

### Removed
- **`analisar_kpis_negocio` Tool**: Removed from IA tools (feature toggle `kpi_analysis` removed).

## [5.19.0] - 2026-05-25

### Added
- **Enhanced Contract Signing Identity Validation**: New multi-factor identity verification layer for electronic signatures. Server-side validation now checks CPF format, email match, CPF match, and birth date match before allowing signature. Returns distinct error codes for each validation failure (EMAIL_MISMATCH, CPF_MISMATCH, BIRTH_DATE_MISMATCH).
- **Centralized Identity Utility (`src/lib/utils/identity.ts`)**: New shared identity helper library providing `normalizeCpf()`, `formatCpf()`, `isValidCpf()`, `maskCpf()`, `namesMatch()` (fuzzy name comparison), `formatBirthDate()`, and `birthDatesMatch()` for consistent identity handling across frontend and backend.
- **Signer Identity Fields in Database**: Added `birth_date` to `users_unified`, `external_signer_tax_id` and `external_signer_birth_date` to `solicitacoes_assinatura` with proper indexes for strong identity verification.
- **Enhanced Signature Auth Page**: 6-layer frontend validation (required fields, CPF format, email match, CPF match, birth date match, fuzzy name match) with per-field error styling and progressive validation feedback.
- **Pending Fields Blocker**: Signature page now blocks submission until all text/checkbox fields are filled, with warning banner listing unfilled fields and direct links.
- **Profile Page Identity Fields**: New CPF (auto-masked) and birth date fields on the profile page for self-registration of identity data used in electronic signatures.
- **Contract Detail Signer Identity**: Added CPF (auto-formatting) and birth date inputs for external signer assignment with identity reinforcement.

### Changed
- **Contract Assign API**: Now accepts `external_signer_tax_id` and `external_signer_birth_date`, normalizes CPF and email before storage.
- **Contract Sign API**: Extended audit metadata to store `assinante_data_nascimento` alongside CPF.
- **Sign Access Token API**: Response now includes `target_birth_date` for frontend validation.

### Fixed
- **News Post Editor**: Protected against downgrading published posts to draft status — published posts can no longer be accidentally reverted to draft.

## [5.18.0] - 2026-05-25

### Added
- **E-Social Compliance Module**: Complete integration with Brazilian government's e-Social system for digital transmission of labor, tax, and social security obligations.
  - **Event Management**: Full CRUD for e-Social events (S-2200, S-2205, S-2206, S-2210, S-2220, S-2230, S-2240, S-2298, S-2299, S-2300, S-2399, S-2400, S-3000).
  - **XML Generation**: Automatic XML generation for supported events with proper headers, namespaces, and event IDs following official e-Social layouts (v1.3).
  - **Digital Signing**: Enveloped XML digital signing using `xml-crypto` with RSA-SHA256 algorithm and X509 certificates.
  - **SOAP Web Service Integration**: Mutual TLS communication with e-Social production/homologation environments using PFX digital certificates.
  - **Certificate Management**: Upload, activate/deactivate, and manage A1/A3 digital certificates with AES-256-CBC encrypted password storage in Supabase.
  - **Event Lifecycle**: Complete status flow (draft → pending review → approved/rejected → queued → sending → sent → processed/error/returned).
  - **Review Workflow**: Approval/rejection queue with detailed error processing.
  - **Dashboard**: Summary metrics with real-time event counts by status.
  - **Configuration**: Environment selection (homologation/production), web service URLs, timeout settings, and autonomy controls.
  - **ASO Import Pipeline**: Multi-step import with PDF upload, OCR extraction, data review, and S-2220 event generation.
  - **Official Tables**: Import and lookup of Tabela 27 (medical exam codes) and Tabela 50 (CBO occupation codes) from CSV.
  - **Risk Factors**: Seeded database of 22 occupational risk factors for S-2240 events.
  - **Auto-Generation Service**: Automatic S-2200 and S-2240 event generation when collaborators are registered, with MIO enrichment.

- **Global OCR Module**: New document processing pipeline for text extraction and structured field parsing.
  - **Multi-format Support**: PDF (digital and scanned via Tesseract.js), DOCX, XLSX, TXT/CSV, and images (PNG/JPG/WebP/GIF).
  - **Field Extraction**: Intelligent extraction of CPF, RG, name, birth date, CTPS, CNH, PIS/PASEP, address, CEP by document type.
  - **ASO-specific Extraction**: Type of exam, result (apto/inapto/apto_condicional), exam date, physician data (name, CRM, UF), clinic data (CNPJ, name), and complementary exam codes.
  - **Configurable Pipeline**: Quality settings, language selection (default: Portuguese), and external fallback API support.

- **New Dependencies**: `node-forge` (certificate crypto), `tesseract.js` (OCR engine), `xml-crypto` (XML signing).

### Changed
- **Admin Layout**: Added E-Social and Gestão de Tripulantes entries to admin menu navigation.
- **Cards API**: Added icon mappings for `gestao-tripulantes` (FiUsers) and `e-social` (FiBriefcase).

### Database
- **e-Social Tables**: `esocial_eventos_catalogo`, `esocial_eventos`, `esocial_certificados`, `esocial_configuracoes`, `esocial_envios_log`, `esocial_fatores_risco`, `esocial_tabela_27`, `esocial_tabela_50` with RLS policies.
- **OCR Config**: `settings` table seeded with global OCR configuration.
- **Storage Bucket**: `esocial-certificados` for encrypted PFX certificate storage.

## [5.17.0] - 2026-05-25

### Added
- **Gestão de Tripulantes Module (Crew Management)**: Complete offshore crew management system with comprehensive data model and workflows.
  - **Collaborator Management**: Full CRUD with 7-tab registration form (Personal Data, Documents, Address, Contact, Banking, Employment Bond, e-Social).
  - **Employee Matrix**: Interactive table (`GTMatrix`) with filters (company, vessel, position, cost center, status, standby, expiring documents), color-coded status badges, and real-time search.
  - **Document Management**: Upload, OCR, and validation for 14 document types (ASO, training, passport, CNH, birth/marriage certificates, CTPS, etc.) with automatic validity calculation and expiry notifications.
  - **ASO Pipeline**: Import ASO documents via PDF upload + OCR → data review → e-Social S-2220 event generation.
  - **Embarkation History**: Complete timeline with vessel, type (normal/substitution/double rotation/standby/training), dates, flights, and statistics.
  - **Back-Substitution Algorithm**: Intelligent replacement suggestion system with 8 weighted criteria (30pts cost center, 20pts company, 15pts vessel, 10pts position, 35pts standby, etc.).
  - **Dashboard**: Real-time metrics (total collaborators, onboard, available, expiring documents).
  - **MIO Bidirectional Sync**: Full integration with MIO ERP — import collaborators, training records, embarkations; export manually created collaborators; auto-link by CPF.
  - **PoliWeb Scraper**: Automated ASO import from PoliWeb occupational clinic system with deduplication and e-Social event generation.
  - **Notifications**: Automated expiry warnings (configurable days in advance), embarkation alerts, and substitution notifications via in-app, email, and push channels.
  - **Admin Configuration**: 8-tab admin panel (General, MIO Integration, PoliWeb, Notifications, OCR, Back Algorithm, Autonomy, Dashboard).
  - **Permission System**: 8 granular features (view, manage, admin, documents.edit, documents.ocr, back.suggest, poliweb.scrape, notifications.manage).

### Database
- **Crew Management Tables**: 13 tables with `gt_` prefix — `gt_centros_custo`, `gt_empresas`, `gt_embarcacoes`, `gt_cargos`, `gt_colaboradores` (50+ columns), `gt_documentos`, `gt_documentos_aso`, `gt_documentos_treinamento`, `gt_historico_embarques`, `gt_historico_substituicoes`, `gt_notificacoes_log`, `gt_cron_log`, `gt_configuracoes`.
- **Views**: `gt_vw_colaboradores_completo` (with JOINs to all related tables + subqueries for document counts), `gt_vw_dashboard_resumo` (aggregated metrics).
- **Storage Bucket**: `gestao-tripulantes-documentos` for document file storage.
- **Additional Columns**: 50+ cadastro fields added to `gt_colaboradores` (RG, CTPS, CNH, PIS/PASEP, voter registration, certificates, salary, contract type, shift patterns).
- **PCMSO Fields**: Medical coordinator and UF columns added to `gt_documentos_aso`.

### API
- **18 REST Endpoints**: Health check, CRUD for cargos/centros_custo/empresas/embarcacoes/colaboradores, documents (upload/CRUD/OCR/e-Social), dashboard, configurations, PoliWeb integration, back suggestion algorithm, notifications, and cron jobs.

## [5.16.0] - 2026-05-25

### Added
- **MIO Cache System**: Unified caching layer that replaces direct MIO API calls with a Supabase-backed cache, polled every 15 seconds for real-time data availability.
  - **Cache Architecture**: `mio_cache` Supabase table with 4 data rows (`integrantes`, `treinamentos`, `embarques`, `lgp_reports`) + `__meta__` row for sync tracking.
  - **Update Endpoint (`POST /api/mio/cache/atualizar`)**: Fetches all MIO data in parallel (4 simultaneous requests), respects 10-second rate limit, requires ADMIN/MANAGER auth.
  - **Read Endpoint (`GET /api/mio/cache`)**: Serves cached data by tipo(s), supports role-based filtering (ADMIN full, USER filtered by CPF), single or multi-tipo response.
  - **Frontend Hook (`useMIOData`)**: React hook with 15s polling interval using SWR pattern for reactive data consumption.
  - **Module Integration**: Man Schedule route (`/api/man-schedule/realtime`) migrated from direct MIO calls to cache reads; `revalidate` reduced from 60s to 10s.
  - **RLS Policies**: SELECT allowed for all roles; INSERT/UPDATE/DELETE restricted to service_role only.

- **MIO Client Enhancements**:
  - Added generic `post()` and `put()` HTTP methods for full REST support.
  - `getTreinamentos()` completely rewritten with full Portuguese-to-English field mapping (34 fields).
  - `getEmbarques()` enhanced with rich field mapping (20+ fields: RT{P,E} status, flight info, cost centers, project numbers).
  - New `getAllTreinamentos()` and `getAllEmbarques()` methods for bulk cache sync.
  - New `MIOEmbarque` and `MIOASO` TypeScript interfaces with comprehensive field definitions.

- **MIO Sync Rewrite (`src/lib/mio/sync.ts`)**: Complete employee provisioning pipeline.
  - Creates Supabase Auth users and `users_unified` records for MIO employees not in the database.
  - Auto-creates default permissions for 9 modules (dashboard, manual, procedimentos, politicas, calendario, noticias, reembolso, contracheque, ponto).
  - Logs access history with REGISTERED action and protocol tracking.
  - Sends email verification links for users with valid email addresses.
  - Deduplication logic prevents duplicate user creation.
  - Active/inactive status synced from MIO `situacao` field.

### Changed
- **MIO Types**: `MIOTreinamento` expanded from 8 to 34 fields; new `MIOEmbarque` (20+ fields) and `MIOASO` interfaces added.
- **Man Schedule**: Now reads from `mio_cache` instead of direct MIO API calls; faster refresh (10s revalidate).

## [5.15.0] - 2026-05-25

### Added
- **New Dependencies**:
  - `node-forge` (^1.4.0) — Certificate cryptography and PFX/P12 decoding for E-Social digital signatures.
  - `tesseract.js` (^7.0.0) — OCR engine for document text recognition (ASOs, passports, certificates).
  - `xml-crypto` (^6.1.2) — XML digital signing for E-Social event transmission.
  - `@types/node-forge` (^1.3.14) and `@types/xml-crypto` (^1.4.6) for TypeScript support.

- **ACL Hierarchical System Extension**: Enhanced permission system with new module support for Gestão de Tripulantes and E-Social.
  - **8 Gestão de Tripulantes Permissions**: `view`, `manage`, `admin`, `documents.edit`, `documents.ocr`, `back.suggest`, `poliweb.scrape`, `notifications.manage`.
  - **5 E-Social Permissions**: `view`, `prepare`, `review`, `send`, `admin`.
  - **Role Defaults**: ADMIN gets all permissions for both modules; MANAGER gets selective GT permissions + esocial.view; USER gets none.
  - **Layer 4 ACL in Effective Permissions**: New permission layer reads from `user_acl_permissions` + `role_acl_permissions` tables, maps to `acl_permissions` resources, and enables modules accordingly. Graceful fallback if ACL tables don't exist.
  - **Reactive ACL Loading**: Auth context now loads ACL modules on mount, listens for `permissions-updated` window events, and re-fetches on profile updates.
  - **Permission Change Events**: `useACLPermissions` hook dispatches custom `permissions-updated` event after successful permission mutations.

- **i18n Localization**: Complete Portuguese and English translations for both new modules.
  - **`gestaoTripulantes` namespace**: ~233 entries covering all UI text (filters, table, legend, status, profile tabs, documents, OCR, embarkations, substitutions, back algorithm, notifications).
  - **`eSocial` namespace**: ~233 entries covering event management, review, certificates, configuration, and dashboard.
  - **Menu and module list entries**: `menu.gestaoTripulantes`, `modules.gestao-tripulantes`, `modules.e-social`.

- **Database Schema Extension**: Added `birth_date` column to `users_unified` table (DATE, nullable) with index for identity validation in electronic signatures.

### Changed
- **Next.js Configuration**: Added `serverComponentsExternalPackages: ['tesseract.js']` to enable native Node.js module loading for OCR in server components.
- **TypeScript Configuration**: Added `baseUrl: "."` for root-based imports complementing existing `@/` path aliases.
- **Permissions Type System**: `PermissionFeatures` interface extended with 13 new optional fields for both modules.
- **`PERMISSIONS` constant**: Added `GESTAO_TRIPULANTES` (8 keys) and `ESOCIAL` (5 keys) permission groups.
- **`PERMISSION_DESCRIPTIONS`**: 13 new Portuguese descriptions for permission tooltips and admin UI.
- **`DEFAULT_PERMISSIONS_BY_ROLE`**: Updated for all three roles (ADMIN, MANAGER, USER) with new module and feature entries.
- **Admin Layout Menu**: Added navigation entries for Gestão de Tripulantes (FiAnchor) and E-Social (FiSend) in the admin sidebar.
- **Cards API**: Added icon mappings for both new modules in dashboard card system.
- **Effective Permissions API**: Extended debug output with `_debug.acl` source info and `_debug.acl_modules_applied` array.
- **Auth Context**: `UserProfile` interface extended with `tax_id`, `bio`, `birth_date`, and `cover_url` fields.
- **package.json Scripts**: Added 6 new database setup scripts:
  - `db:setup-esocial` — Storage bucket creation for E-Social certificates
  - `db:seed-esocial-riscos` — Risk factors seeding
  - `db:setup-mio-cache` — MIO cache table setup
  - `db:cadastro-fields` — Cadastro migration for GT module
  - `db:setup-gestao-tripulantes` — Main GT module migration

### Infrastructure
- **Module Registration**: Both `gestao-tripulantes` and `e-social` registered in `src/config/modules.ts` and `src/constants/modules.ts` with proper roles and categories.
- **ACL Init**: ACL system seeded with all 13 new permissions for both modules.
- **Unified Data Hook**: Admin users now bypass sector restrictions in `useUnifiedData`.
- **Supabase Types**: `birth_date` field added to `users_unified` Row, Insert, and Update types.
- **Centralized Identity Utility**: New `src/lib/utils/identity.ts` for CPF normalization, formatting, validation, and masking — shared across frontend and backend for electronic signature identity verification.
- **CSS**: Global stylesheet updates for new UI components.
- **Gitignore**: Updated to exclude temporary and environment-specific files.

## [5.14.0] - 2026-05-20
- **ACL Hierarchical System Overhaul**: Refactored permission system with modular architecture. New `getFullPermissionsForRole()` consolidates module access across ADMIN, MANAGER, and USER roles. Permissions now split into `modules` (access flags) and `features` (fine-grained actions) for each role.
- **New Permission Categories**: Added granular permissions for `ferias` (read/create/approve/manage/admin), `lista-presenca` (read/create/manage/admin), and `contratos` (read/sign/manage) with full i18n descriptions.
- **Contracts Templates System**: Complete template management with CRUD API, role-based signer mapping, and template-to-envelope workflow. Templates support predefined roles (e.g., Colaborador, Gestor, RH) with auto-assignment.
- **Multi-Field Document Signing**: Contracts now support `texto` (text input), `checkbox` (boolean selection), `assinatura` (signature), and `rubrica` (initial) field types with visual position overlay. Batch signing processes all pending fields for a signer in a single transaction.
- **PDF Editor Service Enhancement**: New `embedFieldsAndSignaturesOnPdf()` service handles batch embedding of signatures, rubrics, text fields, and checkboxes across multiple pages in a single PDF pass.
- **Real IA Chat Streaming**: Migrated from simulated SSE streaming to real `chatCompletionStream` with recursive tool processing, dashboard metadata extraction, and content persistence.
- **New System Modules**: Added `ferias` (vacation management), `biblioteca` (document library), `ajuda` (help center), `compras` (purchase orders), `poliweb` (occupational clinic), `man-schedule` (offshore crew management), `chat` (internal communication), `wkradar` (legacy system access), `integracao-erp` (ERP integration), and `ia-assistant` modules with dedicated permissions.
- **Module Categories**: Extended module categorization with `department`, `core`, and `content` categories alongside existing `system`, `business`, and `hr`.
- **i18n Expansion**: Added 636+ new translation entries in `en-US.ts` and 314+ in `pt-BR.ts` covering all new modules, permissions, contracts workflows, and ACL management UI.
- **Signer Reuse**: Contract detail page now remembers the last used signer (internal or external), with toggle to reuse or reset between assignments.
- **Email Templates**: Added 61 new email template variations for contracts, vacations, and attendance list notifications.

### Changed
- **Permissions Data Model**: `DEFAULT_PERMISSIONS_BY_ROLE` restructured from flat `Record<string, boolean>` to nested `{ modules: Record<string, boolean>, features: Partial<PermissionFeatures> }` for cleaner separation of module access vs. feature-level permissions.
- **Available Modules API**: `GET /api/admin/available-modules` now sources from `SYSTEM_MODULES` config instead of hardcoded Supabase card fallback, ensuring single source of truth for module definitions.
- **Effective Permissions Endpoint**: Simplified to delegate role defaults to `getFullPermissionsForRole()` from `@/config/modules`, removing duplicated inline permission maps.
- **Signature Position Overlay**: Enhanced with dynamic tipo detection (auto-detects checkbox, rubric, text, or signature based on field dimensions/label). Updated visual status colors to amber/emerald/gray for pending/signed/rejected states.
- **Document Upload Modal**: Complete UI overhaul with tabbed interface (Envelope / Templates), template selector inside envelope creation, and dedicated template management section with role-based signer configuration.
- **Contracts Detail Page**: Added support for text/checkbox field input, collapsible signer groups, advanced signer search, and CC (carbon copy) email fields.
- **Poliweb Page**: Refactored to use per-tab state management (`tabStates`) instead of shared state, fixing credential save flow across multiple tabs.
- **Purchase Requests/Orders**: Enhanced approval workflow with improved error handling, stage tracking, and permission validation.
- **Voice Server Scripts**: Updated `agent.py` and `audio_server.py` with improved SSE handling, TTS parameter validation, and LiveKit SDK compatibility.

### Fixed
- **IA Chat Streaming**: Resolved issue where streaming used fake chunking of non-streaming API response; now properly uses `chatCompletionStream` for genuine SSE streaming with tool calls.
- **Effective Permissions**: Fixed missing modules in effective permissions by centralizing module definitions in `SYSTEM_MODULES`.
- **Signature Overlay Colors**: Updated visual feedback colors to improve accessibility and clarity of field status (pending, signed, rejected).
- **Contract Signing Flow**: Fixed batch signing to properly update all sibling fields for the same signer, including text/checkbox values alongside signature/rubric.
- **Poliweb Credential Persistence**: Resolved bug where credential updates in one tab would reset state in another tab.

## [5.13.0] - 2026-05-15

### Added
- **Infraestrutura de Voz Local (Cluster L4/Xeon)**: Estabilização do servidor de áudio local (Piper/Whisper) com suporte a streaming real-time compatível com o protocolo OpenAI.
- **Diagnóstico de Voz WebRTC**: Implementação de hooks de telemetria no `VoiceAssistantModal.tsx` para monitorar SID de participantes, estados de trilha de áudio e transições de estado do agente.

### Changed
- **Pipeline de Áudio PCM16**: Otimização do `audio_server.py` e `agent.py` para utilizar PCM raw de 24kHz. Isso reduz a latência de ponta a ponta ao eliminar a necessidade de decodificação MP3/AAC no agente LiveKit.
- **Orquestração LiveKit SDK v1.0**: Atualização do `agent.py` para suportar a arquitetura `AgentSession` (v1.0+) mantendo fallback para `VoicePipelineAgent` (v0.x), garantindo compatibilidade em diferentes ambientes de deploy.

### Fixed
- **Bug de Estol "Thinking"**: Resolvida a falha onde o agente permanecia em loop de pensamento devido ao mismatch entre o formato SSE (Server-Sent Events) esperado pelo plugin default e os raw bytes enviados pelo servidor local. Forçado uso de `model="tts-1"` para stream binário direto.
- **Validação de Parâmetros TTS**: Adicionado suporte aos campos `stream_format`, `speed` e `instructions` no `audio_server.py` para evitar erros de validação (422 Unprocessable Entity) disparados pelo plugin OpenAI.

## [5.12.0] - 2026-05-14

### Added
- **Agente de Voz em Tempo Real (LiveKit)**: Integração de canal WebRTC de alto desempenho para conversa em áudio em tempo real com a IA.
- **Resiliência de Canal**: Adicionado suporte ao estado `useConnectionState` no visualizador de voz, mantendo a interface viva e permitindo auto-recuperação suave de rede em vez de desmontar o modal.

### Changed
- **Identidades de Sessão Dinâmicas**: Tokens LiveKit agora geram identidades com sufixo randômico para eliminar colisões de ID ("reconnection loops") em múltiplos navegadores ou atualizações rápidas.
- **Restrição de Notificações de EPI**: Otimizada a consulta de envio de alertas de estoque baixo, direcionando os e-mails unicamente para os responsáveis cadastrados no painel administrativo (`epi_sector_responsibles`).

## [5.11.0] - 2026-05-14

### Added
- **Globalized Multi-Language Expansion (i18n)**: Full English/Portuguese translation coverage for essential modules including Contracts & Signatures, Attendance Lists, Reimbursement Dashboards, and structural UI components (`en-US.ts`, `pt-BR.ts`).
- **Advanced Date/Time Locality Framework**: Patched native JavaScript Date APIs in the `I18nContext` to override hardcoded locales, enforcing consistent time-zone and format alignments globally based on the user's language settings.
- **Self-Hosted High-Performance PDF.js Workers**: Configured secure offline/firewalled processing of multi-page PDF rendering via pre-compiled local workers (`public/workers/`), eliminating third-party CDN dependency and increasing signature view speed.
- **Netlify Dynamic URL Continuity Scripts**: Implemented continuous integration configuration utilities (`fix-netlify-env.bat/sh`) to automate runtime hostname injections and fix preview deployment URL issues.

### Changed
- **Contract Signatures Workflow**: Re-engineered signature verification envelopes, refined tracking telemetry, and improved visual representation badges for active contract workflows (`AuditInfoPanel.tsx`, `envelopeDispatcher.ts`).
- **Form and Dialog Polish**: Refined dynamic language selection UX, multi-language fallback behaviors, and consistent component layouts during language swapping transitions (`LanguageDialog.tsx`).

## [5.10.0] - 2026-05-13

### Added
- **SSH Connectivity for Local LLMs**: SSH management implementation for local LLM servers (`node-ssh`), including Start/Stop remote lifecycle controls.
- **Dynamic AI Dashboard Framework**: Split-view UI management that allows AI to render complex, interactive widgets (metrics, tables, lists) within the sidebar context.

### Changed
- **Contracts Module Access**: Enforced the `hasPermission` hierarchy recursively in both the sidebar visibility (`MainLayout.tsx`) and the page component route to restrict unauthorized access.
- **Sidebar CSS Overflows**: Fixed visual bug related to `max-h` CSS constraints clipping the "Meu RH" dropdown menu items in the sidebar.
- **Sidebar Notification Badges**: Removed hardcoded generic news badges; notifications now rely solely on module-specific metadata.
- **Email Templates**: Added dynamic variables for recipient name and company logo. Updated links to explicitly point to `portal.groupabz.com`.
- **System Version**: Bumped version uniformly across `package.json` and internal app config from 5.9.0 to 5.10.0.

### Fixed
- **API 404 Route Errors**: Fixed conflicts causing 404s in various API routes.
- **PDF Generation**: Restored functionality for downloading "Lista de Presença" PDFs, and formatted the document's Pauta/Subject field.

## [5.9.0] - 2026-05-08

### Added
- **Motor de Agente Autônomo para KPIs**: Nova arquitetura e ciclo contínuo de monitoração, análise e tomada de decisões periódicas (`src/lib/ia/autonomous-loop.ts`).
- **Orquestrador Avançado de IA**: Planejamento e cálculo de prioridades baseado em múltiplos fatores com etapas de ação e estimativa de impacto (`src/lib/ia/advanced-orchestrator.ts`).
- **Gerenciador de Contexto e Memória**: Nova tabela `ia_memory` para armazenamento de interações, detecção de padrões de uso e previsões comportamentais (`src/lib/ia/context-manager.ts`).
- **Hook de Controle KPI**: Hooks React para controle de ciclo de vida, eventos e presets dinâmicos (`src/hooks/useKPIAutonomous.ts` e `src/hooks/useAutonomousConfig.ts`).
- **Painel de Controle e Renderizador de Dashboard**: Interface completa com play/pause/stop, presets predefinidos e logs em tempo real (`src/components/KPI/AutonomousKPIRenderer.tsx` e `src/components/KPI/KPIAutonomousHeader.tsx`).
- **API de Controle Autônomo**: Endpoint para inicialização, controle e persistência de estado do agente (`src/app/api/ia/autonomous/control/route.ts`).

### Changed
- **Integração de KPIs de Dashboard**: Geração de relatórios e pendências com cache inteligente de dashboard de 15 minutos (`src/lib/ia/dashboard-service.ts` e `src/lib/ia/agent-service.ts`).
- **Estabilidade e Correções de Tipagem**: Ajustes de types na biblioteca IA e componentes React para garantir integridade e zero erros de build do Next.js (`src/lib/ia/client.ts`, `src/lib/ia/tools.ts`, `src/types/ia.ts`).

## [5.8.0] - 2026-05-04

### Fixed
- **Correção de Status de Férias**: Status usavam `pending/approved` (minúsculas), schema usa `PENDING_LEADER/APPROVED` (maiúsculas). Corrigido em:
  - `context-builder.ts`: Filtros ajustados para `PENDING_LEADER`, `PENDING_MANAGER`, `APPROVED`
  - `tools.ts`: Filtros de status corrigidos
  - `ferias.tools.ts`: Status ajustados para schema
  - `dashboard-service.ts`: Filtros corrigidos
- **Correção de Status de Reembolso**: Status usavam `PENDING/APPROVED` (maiúsculas), schema usa `pendente/aprovado` (minúsculas). Corrigido em:
  - `context-builder.ts`: Filtros ajustados para `pendente`, `aprovado`
  - `tools.ts`: Campos e filtros corrigidos
  - `reembolso.tools.ts`: Reescrito com normalização de status
  - `dashboard-service.ts`: KPIs corrigidos
  - `agent-service.ts`: Taxa de aprovação corrigida
- **Correção de Schema Reimbursement**: Campo `user_id` não existe no schema (tabela usa `email`). Corrigido para buscar usuário via email.
- **Correção de Campo**: Campo `valor_total` não existe (schema usa `valorTotal` em camelCase). Corrigido em todas as consultas.

### Changed
- **Modal de Férias Responsivo**: Modal de solicitação de férias agora é auto-adaptável:
  - Largura: `max-w-lg` (antes `max-w-md`)
  - Altura: `max-h-[90vh]` com scroll interno
  - Padding e botões responsivos
  - Acessível em qualquer resolução/zoom

## [5.7.0] - 2026-05-04

## [5.7.1] - 2026-05-04

### Added
- MVP de IA agentic com pendências por fonte (Teams, Emails, Calendar) e Knowledge como fonte adicional opcional.
- Endpoints MVP por fonte: /api/ia/pendencias/teams, /api/ia/pendencias/emails, /api/ia/pendencias/calendar, /api/ia/pendencias/knowledge (opcional).
- Endpoint consolidado: /api/ia/pendencias/overview para visão geral por fonte.
- Orquestrador skeleton para decisão de plano (em futuras iterações evolutivas).

### Changed
- Mantidas as alterações de MVP anteriores; inclusão de patches para suporte a pendências por fonte (agora com estrutura padronizada).

### Fixed
- Correções de rotas API para pendências com fallback seguro para cenários sem dados.

### Added
- **Agente IA Proativo**: Novo motor de automação (`agent-service.ts`) que executa tarefas agendadas e proativas.
- **Base de Conhecimento Corporativa**: Sistema de memória persistente (`ia_knowledge_base`) com injeção dinâmica de contexto baseada em cargo e departamento.
- **Dashboard de KPIs Modulares**: Nova interface `/kpi` para acompanhamento de metas em tempo real com suporte a múltiplos setores.
- **Centro de Comando Admin**: Novas interfaces para gestão de `Feature Toggles` e `Knowledge Base` no painel administrativo.
- **Integração Avançada MS Graph**:
  - Suporte a busca profunda de e-mails via OData filters (removido limite de 5 e-mails).
  - Criação de notas no OneNote e tarefas no Microsoft To Do.
  - Sincronização híbrida de calendário e documentos (SharePoint + Banco Local).
- **Exportação de Relatórios**: Geração automática de relatórios de performance em formatos PDF e XLSX (Excel).
- **Tool Toggles Globais**: Capacidade de ativar/desativar ferramentas da IA individualmente via banco de dados.

### Changed
- **src/lib/ia/tools.ts**: Expansão massiva do conjunto de ferramentas para suportar ações de escrita e automação.
- **src/lib/ia/context-builder.ts**: Injeção de instruções proativas e dados da base de conhecimento no prompt do sistema.
- **RLS Policies**: Endurecimento de segurança com políticas granulares para todas as novas tabelas de IA.

### Fixed
- Erros de cast de tipo (UUID vs Text) em queries complexas do Supabase.
- Limite restritivo de busca de e-mails que impedia visibilidade completa de conversas.
- Falhas de sincronização no dashboard de BI.

## [5.6.0] - 2026-04-28

### Added
- Enhanced IA system context memory (increased from 6000 to 25000 characters)
- Increased message history limit (from 16 to 30 messages)
- Real PDF generation capability for reports
- Real email sending capability with attachments
- Debug logging for IA context building
- Improved session management using React refs

### Changed
- **src/lib/ia/context-builder.ts**: 
  - Increased MAX_CONTEXT_TOKENS_ESTIMATE from 6000 to 25000
  - Increased MAX_HISTORY_MESSAGES from 16 to 30
  - Added debug logging for session context
  - Updated database table references (avaliacoes → avaliacoes_desempenho)
  - Fixed various text strings (accent removal for consistency)
  
- **src/components/IA/ChatWindow.tsx**:
  - Added useRef for activeSessionId to avoid React latency issues
  - Added useEffect to sync ref with state
  - Modified handleSend to use ref for session_id
  - Corrected session_id handling in streaming and non-streaming paths
  - Fixed activeSessionId updates when receiving new session IDs

- **src/lib/ia/tools.ts**:
  - Completely rewrote gerar_relatorio_pdf to generate real PDFs
  - Completely rewrote enviar_email_relatorio to send real emails
  - Added proper data fetching from database for report generation
  - Implemented actual PDF generation using existing pdf-generator utilities
  - Implemented actual email sending using nodemailer/SMTP
  - Added proper error handling and success responses
  - Added import for sendEmailWithNodemailer

- **src/lib/ia/email-tool.ts**:
  - Enhanced getTransporter() with debug logging
  - Added fallback values for development when env vars missing
  - Default to Office 365 SMTP configuration for development
  - Maintained compatibility with existing email sending logic

### Fixed
- IA system now properly maintains conversation history (30 messages vs previous limit)
- Session ID persistence between messages in the same conversation
- PDF generation now creates actual PDF files instead of simulating
- Email sending now actually sends emails instead of simulating
- React state update latency issues affecting session management
- Database query corrections for various data types

### Removed
- None
