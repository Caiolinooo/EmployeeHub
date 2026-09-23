# Gates: Módulo Indicadores R&S (import dinâmico de planilhas + workspace modal)

OWNS: supabase/migrations/20260918_000001_rs_indicadores.sql, scripts/apply-rs-indicadores.js, scripts/verify-rs-import-lib.ts, scripts/seed-rs-indicadores.ts, scripts/verify-rs-api-gates.mjs, src/lib/indicadores/**, src/app/api/indicadores/**, src/app/department/indicadores/**, src/components/indicadores/**, src/config/modules.ts, src/i18n/locales/pt-BR.ts, src/i18n/locales/en-US.ts, GATES.md

Scope: Módulo /department/indicadores dedicado ao R&S — wizard de importação de .xlsx (abas/cabeçalho/tipos detectados dinamicamente), armazenamento JSONB (planilhas/abas/linhas + histórico), grade editável em modal fullscreen, permissões ADMIN/MANAGER + ACL `indicadores.*` + setor R&S, e semeadura das 3 planilhas atuais de Downloads/Indicadores.

Pré-condição dos gates G1/G3: variáveis de ambiente do `.env.local` (Supabase service). G4 exige servidor de produção no ar (`node server.js`, porta 80) — iniciado pelo orquestrador antes de rodar o checker.

- [x] G1: Migration das 4 tabelas rs_* aplica idempotente e as tabelas existem no Supabase
  CHECK: node scripts/apply-rs-indicadores.js
  EXPECT: APPLY_RS_INDICADORES_OK
  EVIDENCE: APPLY_RS_INDICADORES_OK — 4 tabelas criadas (pg direto), RLS enabled em todas, re-execução idempotente.

- [x] G2: Lib de importação parseia as planilhas reais com abas, linha de cabeçalho (linhas visíveis do Excel), tipos e contagens batendo com a re-medição independente de 18/09/2026 (eficácia/vagas header 8 = 217, controle/candidatos header 14 = 884, eficácia/Eficácia header 5 = 9, eficácia/KPI Eficácia header 5 = 21, controle/vagas header 8 = 747)
  CHECK: npx tsx scripts/verify-rs-import-lib.ts
  EXPECT: RS_IMPORT_LIB_OK
  EVIDENCE: RS_IMPORT_LIB_OK — 1a rodada FALHOU (headerRow 8 vs 3): a medição do gate usava índice do array compactado; re-mediado em linhas visíveis do Excel (blankrows:true + trim): header 8/14/5/5/8 e 217/884/9/21/747 linhas. Lib confirmada correta; data civil 2025-01-14 e percentual RETENÇÃO detectados.

- [x] G3: Semeadura importa as 3 planilhas (abas de dados) no Supabase e as contagens no banco batem
  CHECK: npx tsx scripts/seed-rs-indicadores.ts --verificar
  EXPECT: SEED_RS_OK
  EVIDENCE: SEED_RS_OK — 3 datasets (Controle 1631, Eficácia 247, Auditoria 255 = 2133 linhas), contagens no banco == importadas por aba.

- [x] G4: APIs do módulo negam sem token (401), página serve (200) e as 3 permissões ACL indicadores.* estão ativas no banco
  CHECK: node scripts/verify-rs-api-gates.mjs
  EXPECT: RS_API_GATES_OK
  EVIDENCE: RS_API_GATES_OK — 7 rotas com 401 sem token + 401 token inválido, /department/indicadores 200, ACL indicadores.view|edit|import ativas no banco (pós POST /api/acl/init).

- [x] G5: TypeScript do projeto compila sem erros
  CHECK: npx tsc --noEmit && node -e "console.log('TSC_OK')"
  EXPECT: TSC_OK
  EVIDENCE: TSC_OK — npx tsc --noEmit integral, 0 erros (164s).

- [x] G6: Build de produção conclui e a rota /department/indicadores existe no output
  CHECK: npm run build && node -e "const m=require('./.next/app-path-routes-manifest.json');if(!Object.values(m).includes('/department/indicadores'))throw new Error('rota ausente');console.log('BUILD_ROUTE_OK')"
  EXPECT: BUILD_ROUTE_OK
  EVIDENCE: LINT_OK + BUILD_ROUTE_OK — build de produção concluído e /department/indicadores presente em .next/app-path-routes-manifest.json.

- [x] G7: ESLint sem erro nos arquivos do módulo
  CHECK: npx eslint src/lib/indicadores src/app/api/indicadores src/app/department/indicadores src/components/indicadores src/config/modules.ts && node -e "console.log('LINT_OK')"
  EXPECT: LINT_OK
  EVIDENCE: LINT_OK — 0 erros (warning de tipo não usado removido antes da 2a passada).

- [x] G8: Fluxo do módulo revisado em código ponta a ponta (importar→analisar→confirmar→listar→editar linha→excluir) com build servindo a página
  EVIDENCE: Revisão de integração: costuras confirmadas (FormData arquivo/payload frontend↔backend, query params pagina/porPagina/busca/ordem/dir, shapes {success,data,error} espelhados em types.ts; tsc integral verde; seed provou o caminho DB; G4 provou o wiring das rotas). Limitação declarada: clique-a-clique autenticado no browser não executado (sem credenciais de portal no ambiente).

---

# Gates: Módulo Financeiro (fatura → NFS-e → bancos → conciliação) — onda 2

OWNS: supabase/migrations/20260922_000001_financeiro_core.sql, supabase/migrations/20260922_000002_financeiro_nfse.sql, scripts/apply-financeiro-core.js, scripts/apply-financeiro-nfse.js, scripts/seed-financeiro-municipios.ts, scripts/setup-financeiro-bucket.js, scripts/inspect-fatura-template.ts, scripts/verify-financeiro-api-gates.mjs, scripts/verify-financeiro-fluxo-e2e.ts, src/lib/financeiro/{financeiro-auth,eventos,service,regras-financeiro}.ts, src/lib/financeiro/invoice/**, src/app/api/financeiro/**, src/types/financeiro.ts, GATES.md (seção Financeiro); exceljs (package.json). Integrações (G7/G8): src/lib/financeiro/{banks,nfse}/**. Front (G9–G12): UI + i18n + modules.ts + api-client.

Pré-condições: `.env.local` com creds Supabase service (G1–G3, G6, E2E). G4 exige servidor de produção (`node server.js`, porta 80; override FIN_BASE) iniciado pelo orquestrador. Nota: o fluxo E2E precisa do env carregado antes dos imports de `src/lib/supabase` → rodar com `npx tsx --env-file=.env.local`.

## dev-Back

- [x] G1: Migration core aplica idempotente (10 tabelas fin_* com RLS enabled e zero policies; re-execução sem erro)
  CHECK: node scripts/apply-financeiro-core.js
  EXPECT: FIN_APPLY_CORE_OK
  EVIDENCE: FIN_APPLY_CORE_OK — 10 tabelas via pg direto, RLS enabled + 0 policies em todas, re-execução idempotente. Correções de design documentadas na migration: trigger updated_at NÃO existe em fin_fatura_itens/fin_conciliacoes (sem a coluna; reparo idempotente remove trigger antigo).

- [x] G2: Migration NFS-e aplica idempotente (3 tabelas + Macaé 3302403 seeded)
  CHECK: node scripts/apply-financeiro-nfse.js
  EXPECT: FIN_APPLY_NFSE_OK
  EVIDENCE: FIN_APPLY_NFSE_OK — shape + seed Macaé (provider_sugerido proprietario) + RLS 0 policies; re-execução idempotente. Correção de design documentada: fin_nfse_emissoes.ambiente VARCHAR(15) ('homologacao' tem 11 chars e não caberia em VARCHAR(10)).

- [x] G3: Seed IBGE idempotente e não-destrutivo
  CHECK: npx tsx scripts/seed-financeiro-municipios.ts --verificar
  EXPECT: FIN_SEED_MUNICIPIOS_OK
  EVIDENCE: FIN_SEED_MUNICIPIOS_OK — count=5571 (>= 5570), Macaé presente; re-execução não muda provider_sugerido/wsdl_url (upsert só nome/uf); fallback offline em scripts/data/fin-municipios-ibge.json (API IBGE instável no ambiente).

- [x] G4: APIs negam sem token (amostra 38 rotas ≥ 12), 401 token inválido; 403 opcional via FIN_TOKEN_SEM_PERMISSAO
  CHECK: node scripts/verify-financeiro-api-gates.mjs
  EXPECT: FIN_API_GATES_OK
  EVIDENCE: script pronto (38 verificações 401 + 6 tokens inválidos); execuções exigem servidor de produção no ar — roda na integração pelo orquestrador.

- [x] G5: Libs puras (render HTML determinístico com fixtures; regras de nº sequencial/RPS/estados; conciliação automática)
  CHECK: npx tsx --test src/lib/financeiro/invoice/*.test.ts src/lib/financeiro/*.test.ts
  EXPECT: FIN_LIB_TESTS_OK
  EVIDENCE: FIN_LIB_TESTS_OK — 32 testes / 9 suítes, 0 falhas (determinismo do HTML, escape, metadados, Corporate Account Details, estados fatura/NFS-e, BRL-only, conciliação txid/nosso_numero/valor+data, débitos ignorados).

- [x] G6: Storage buckets privados (financeiro-certificados, financeiro-templates)
  CHECK: node scripts/setup-financeiro-bucket.js
  EXPECT: FIN_BUCKETS_OK
  EVIDENCE: FIN_BUCKETS_OK — 2 buckets criados (public:false), re-execução idempotente e falha se bucket existir público; sem policies públicas (acesso só service_role).

- [x] G6b: Template default semeado do 1_Invoice real (V13.0.0) com mapping descoberto
  CHECK: npx tsx scripts/inspect-fatura-template.ts --seed
  EXPECT: INSPECT_FATURA_TEMPLATE_OK
  EVIDENCE: INSPECT_FATURA_TEMPLATE_OK (2 execuções idempotentes) — upload em financeiro-templates/templates/default/Template_Invoice_Geral.xlsx + upsert por nome em fin_fatura_templates (is_default). Mapping real: invoice_no C13, invoice_date C12, cliente A12, endereço A13, serviços linhas 17–29 (col A descrição, D valor — template V13 não tem coluna de referência; convenção "descrição — referência"), total D30, conta A43.

- [x] G6c: Fluxo E2E sem rede externa (folha aprovada → fatura folha → emitida → renders → NFS-e autorizada via mock proprietário Macaé → cobrança boleto → conciliação CSV → liquidada → eventos)
  CHECK: npx tsx --env-file=.env.local scripts/verify-financeiro-fluxo-e2e.ts
  EXPECT: FIN_FLUXO_E2E_OK
  EVIDENCE: FIN_FLUXO_E2E_OK — fatura 1/2026 com item origem=folha (12.000), snapshot na emissão, HTML 4418B / PDF 2113B (%PDF-) / XLSX 6542B (PK), RPS 1 série E2E autorizado (servidor HTTP local), 2 movimentos importados / 1 conciliado automático, cobrança liquidada, fatura → `paga` + evento fatura.paga (recebido 12.000 = total), eventos fatura.criada→fatura.emitida→fatura.paga→nfse.enviado→nfse.autorizada→cobranca.liquidada. O E2E achou e corrigiu 2 bugs reais (INSERT sem coluna numero; trigger updated_at em tabela sem a coluna).

- [x] G5b: Auditoria Reviewer (onda 2) — 10 P1 + P2 do escopo Back corrigidos e revalidados
  CHECK: npx tsx --test src/lib/financeiro/invoice/*.test.ts src/lib/financeiro/*.test.ts && npx tsx --env-file=.env.local scripts/verify-financeiro-fluxo-e2e.ts && npx eslint "src/lib/financeiro/*.ts" "src/lib/financeiro/invoice/**/*.ts" "src/app/api/financeiro/**/*.ts" "src/types/financeiro.ts"
  EXPECT: 32/32 testes + FIN_FLUXO_E2E_OK + ESLINT exit 0
  EVIDENCE: P1 corrigidos: (1) BankContext usa a conta EXATA da cobrança (opts.contaId validado contra a integração); (2) fatura → `paga` quando soma das liquidadas ≥ total (evento fatura.paga; cobranças parciais suportadas); (3) nosso_numero gerado/enviado ao adapter e persistido, txid persistido (adapter ou local FIN…≤25); (4) XML já era stripado por default no GET emissoes/[id] (só ?xml=1 + nível edit); (5) criarFatura em BEGIN/COMMIT (nº + itens atômicos); (6) cobrança consumida no batch de conciliação (Map abertas) — nunca casa 2 movimentos; movimento já conciliado/ignorado não remacha; (7) vínculo manual rejeita movimento conciliado (409); (8) integração/conta inativas não são utilizáveis (is_active nas ações); (9) reemissão reusa RPS de rps_gerado|rejeitado (já conformante — revalidado); (10) cancelamento exige codigoCancelamento (400 se vazio). P2: certificado_path fora de todas as respostas; RPS reservado + emissão criada na MESMA transação pg (criarEmissaoTransacional); visao-geral aceita empresaId=todas/vazio; troca de provider limpa config específica (preserva codigo_lc116_padrao/ambiente); validade do cert continua null (limitação declarada — requer OpenSSL/decifra PKCS#12). Revalidação: 32/32 testes, FIN_FLUXO_E2E_OK, ESLINT 0, tsc escopado 0 (tsconfig.financeiro-check.json).

## dev-Integrações (reportado pelo par; re-executar na integração)

- [x] G7: Adapters banco (Itaú OAuth+mTLS mock, CSV XP, placeholders)
  CHECK: npx tsx --test src/lib/financeiro/banks/*.test.ts
  EXPECT: BANK_ADAPTER_TESTS_OK
  EVIDENCE: BANK_ADAPTER_TESTS_OK — 42/42 (reportado por DevIntegracoes em 2026-09-22; eslint limpo, tsc escopado 0 erros, contratos §3.1 intactos).

- [x] G8: Providers NFS-e (ABRASF 2.02/2.04, nacional, proprietário+Macaé)
  CHECK: npx tsx --test src/lib/financeiro/nfse/*.test.ts
  EXPECT: NFSE_PROVIDER_TESTS_OK
  EVIDENCE: NFSE_PROVIDER_TESTS_OK — 41/41 (reportado por DevIntegracoes; XMLDSig valida estrutura; contratos §3.2 intactos).

## dev-Front (executar na integração — arquivos do par)

- [x] G9: npx tsc --noEmit && node -e "console.log('TSC_OK')" → TSC_OK
  EVIDENCE: TSC_OK — tsc integral 0 erros (após correções da onda: render-pdf ambient pdfkit completado; 5 erros pré-existentes em payroll/dp-wk corrigidos: casts de embeds no contracheque, re-export BackupPessoa/FuncionarioApi, NaturezaFolha no calculate, ColabGtRow.data_admissao/demissao, tupla tipada no Map de sync-colaboradores-gt).
- [x] G10: npx eslint src/components/financeiro src/app/folha-pagamento src/app/admin/financeiro-config src/lib/financeiro/api-client.ts src/config/modules.ts && node -e "console.log('LINT_OK')" → LINT_OK
  EVIDENCE: LINT_OK — 0 erros/0 warnings no escopo da onda (pós-fix do review).
- [x] G11: npm run build + rotas /folha-pagamento e /admin/financeiro-config no manifest → BUILD_ROUTES_OK
  EVIDENCE: BUILD_ROUTES_OK — build de produção concluiu; manifest contém /folha-pagamento, /folha-pagamento/{faturas,nfse,bancos}, /admin/financeiro-config.
- [x] G12: node scripts/check-financeiro-i18n.mjs → FIN_I18N_OK
  EVIDENCE: FIN_I18N_OK — financeiro.*: 233 chaves; admin.* do §8: 23 — pt-BR == en-US.

## Integração (orquestrador)

- [x] I1: node scripts/verify-financeiro-api-gates.mjs (servidor no ar, FIN_BASE=http://localhost:3000) → FIN_API_GATES_OK
  EVIDENCE: FIN_API_GATES_OK — 38 rotas com 401 sem token + 6 token inválido; ACL semeada via POST /api/acl/init e confirmada (financeiro.view|edit|admin ativas, níveis 1/2/3). 403 com FIN_TOKEN_SEM_PERMISSAO fica como ampliação futura (usuário de teste sem permissão não disponível).
- [x] I2: npx tsc --noEmit integral → 0 erros; npm run build → BUILD_ROUTES_OK
  EVIDENCE: tsc integral 0 erros (duas passadas pós-fix); build OK (BUILD_ROUTES_OK acima).
- [x] I3: Revisão ponta a ponta (Reviewer) + correções P1/P2
  EVIDENCE: Revisão completa em agent://Reviewer (13 P1 + 10 P2, file:linha). Corrigidos: conta exata no BankContext; fatura → 'paga' por soma de liquidadas ≥ total (e2e prova); nosso_numero gerado/persistido + txid persistido; XML só com ?xml=1 + nível edit (listagem sem XML); criação de fatura BEGIN/COMMIT; conciliação consome movimento (nunca 2 casam na mesma cobrança); vínculo manual rejeita movimento conciliado; is_active filtrado em ações; RPS reservado+emissão na mesma transação; cancelamento exige codigoCancelamento (resolver ABRASF 1–9); leak mTLS (Agent cache+evict, pfx temporário apagado, limparRecursosMtls); LC116 no config NFS-e (UI); deep-link ?tab=; filtro de clientes por empresa; 2ª config NFS-e; reset de config na troca de município; i18n residual. Revalidação pós-fix: FIN_LIB_TESTS_OK 32/32, BANK_ADAPTER_TESTS_OK 44/44, NFSE_PROVIDER_TESTS_OK 44/44, FIN_I18N_OK, FIN_FLUXO_E2E_OK, eslint escopado 0, tsc escopado 0.
  Limitações declaradas: clique-a-clique autenticado com credenciais reais de banco não executado (E2E usa sandbox fake/CSV); certificado_validade gravado como null até a primeira testagem (extração de validTo do PKCS#12 cifrado pendente de app_secrets decifrados); 403 com usuário sem permissão não exercitado.

# Gates: Reforma Folha / DP / Contracheque / Vínculo (onda 3)

OWNS: scratch/dp-folha-design.md, supabase/migrations/20260923_000001_cadastros_fiscais.sql, supabase/migrations/20260923_000002_contracheque_aceites.sql, supabase/migrations/20260923_000003_payroll_employees_cpf_unique.sql, src/lib/payroll/colaborador-merge.ts, src/lib/payroll/contracheque-self.ts, src/lib/payroll/contracheque-pdf.ts, src/app/api/contracheque/**, src/app/contracheque/page.tsx, src/components/dp/FechamentoDpWizard.tsx, src/components/financeiro/{EmpresasTab,ClientesTab}.tsx, src/app/api/payroll/sheets/[id]/{checklist,reabrir}/**

- [x] G1: node scripts/apply-cadastros-fiscais.js (2x) → APPLY_CADASTROS_OK
  EVIDENCE: APPLY_CADASTROS_OK — 30/30 colunas fiscais via pg direto; 2ª aplicação idempotente.
- [x] G2: node scripts/apply-contracheque-aceites.js (3x) → CONTRACHEQUE_ACEITES_OK
  EVIDENCE: CONTRACHEQUE_ACEITES_OK — tabela + UNIQUE(sheet_id,employee_id), RLS enabled, 0 policies.
- [x] G3: npx tsx scripts/dedupe-payroll-employees.ts && node scripts/apply-payroll-cpf-unique.js → DEDUPE_OK + APPLY_PAYROLL_CPF_UNIQUE_OK
  EVIDENCE: DEDUPE_OK — 251 fichas, 0 grupos duplicados; índice payroll_employees_company_cpf_key criado.
- [x] G4: npx tsx --test src/lib/payroll/colaborador-merge.test.ts → 8/8
  EVIDENCE: 8/8 — match CPF/matrícula, aditivo, salário 0 não zera, vínculo employee_id, demissão só wk/desligamento.
- [x] G5: npx tsx --env-file=.env.local scripts/verify-contracheque-e2e.ts → CONTRACHEQUE_E2E_OK
  EVIDENCE: CONTRACHEQUE_E2E_OK — HTML+PDF %PDF-, aceite SHA-256 idempotente, 403 não-dono (viewer/PDF/aceite).
- [x] G6: npx tsc --noEmit → TSC_OK
  EVIDENCE: TSC_OK — tsc integral 0 erros (2026-09-23).
- [x] G7: eslint escopado (financeiro, dp, contracheque, folha-pagamento, merge, service) → LINT_OK
  EVIDENCE: LINT_OK — 0 erros (1 warning legado unused Calendar em relatorios/mensal).
- [x] I1: Revisão cruzada manual (reviewer agent caiu no socket) — wiring + segurança + fiscal + merge
  EVIDENCE: Sem P1. Contracheque 403 dono-only (GET+PDF+aceite); merge aditivo nos 5 call sites; sanitização \D só BR, IBGE sem fallback do prestador, LC116 por item. P2: escalaTravada usa gt_relatorios_aprovacoes (coluna bloqueado não existe); comentário de header em wkradar/sync.ts ainda fala upsert por matrícula.
  Limitações: clique-a-clique autenticado no /contracheque do portal não refeito nesta retomada (e2e + UI do DevContracheque no dev server já provaram). NFS-e em moeda != BRL continua bloqueada (invoice internacional só PDF/XLSX).


# Gates: Certificado A1 único + consulta NFS-e Macaé (somente leitura)

OWNS: src/lib/certificado-a1.ts, src/lib/financeiro/nfse/{consulta-somente-leitura,padrao-abz,proprietario}.ts, src/lib/financeiro/nfse/abrasf/templates.ts, src/lib/financeiro/nfse/municipios/macae.ts, src/app/api/financeiro/certificado-a1/route.ts, scripts/consultar-nfse-macae.ts, scripts/apply-nfse-macae-oficial.js, supabase/migrations/20260923_000004_nfse_certificado_unico_macae.sql

- [x] G1: npx tsx --test src/lib/certificado-a1.test.ts src/lib/financeiro/nfse/consulta-somente-leitura.test.ts
  EXPECT: testes verdes; consulta bloqueia Recepcionar/Gerar/Cancelar.
  EVIDENCE: 2/2 certificado-a1 + 6/6 consulta-somente-leitura. Parser lê Tomador da declaração (não o prestador). Operações Recepcionar/Gerar/Cancelar/Substituir lançam.

- [x] G2: npx tsx --test src/lib/financeiro/nfse/*.test.ts
  EXPECT: NFSE_PROVIDER_TESTS_OK (URLs SPE oficiais, mTLS, CodigoTributacaoMunicipio).
  EVIDENCE: 50/50 (abrasf + consulta + nacional + padrao-abz + proprietario). RPS nacional: Endereco (não Logradouro), LC116 `17.01`, IBSCBS, competência YYYY-MM-DD. RPS exportação: MotivoNifNaoInformado, CodigoPais, ExigibilidadeISS=4, ValorIss=0, sem IBSCBS.

- [x] G3: node scripts/apply-nfse-macae-oficial.js
  EXPECT: APPLY_NFSE_MACAE_OFICIAL_OK — wsdl_url SPE produção.
  EVIDENCE: APPLY_NFSE_MACAE_OFICIAL_OK — `fin_municipios` 3302403 aponta `https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx` (provider abrasf204).

- [x] G4: npx tsx --env-file=.env.local scripts/consultar-nfse-macae.ts
  EXPECT: CONSULTA_NFSE_LEITURA_OK ou PARCIAL (erro da prefeitura). Nunca emite.
  EVIDENCE: CONSULTA_NFSE_LEITURA_OK — 30 CompNfse reais (5 nacionais / 25 exterior / 19 canceladas). Só `ConsultarNfseServicoPrestado` em janelas de 30 dias. Reparse local das amostras: 0 tomador invertido; `noRealAusenteNoNosso=[]` e `noNossoAusenteNoReal=[]` na InfDeclaracao.

- [x] G5: node scripts/check-financeiro-i18n.mjs → FIN_I18N_OK
  EVIDENCE: FIN_I18N_OK na onda do A1 único (certificadoUnico*). Sem chaves novas nesta adequação de template.
