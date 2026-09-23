# Financeiro API — DOX

## Purpose

Rotas `/api/financeiro/**` do módulo Financeiro remodelado (design
`local://financeiro-design.md` §6): visão geral, clientes, faturas
(rascunho→emitida→nfse_emitida/paga/cancelada), templates de layout,
NFS-e (RPS transacional), bancos (integrações/contas/catálogo), cobranças
(boleto/pix), pagamentos em lote, conciliação automática e trilha `fin_eventos`.

## Ownership

- TODAS as rotas sob `src/app/api/financeiro/` (owner dev-Back)
- Helpers privados: `_lib/http.ts` (`finOk/finFail/finErro/paginacao/corpoJson/texto`)
  e `_lib/render-input.ts` (monta `FaturaRenderInput` §3.3 a partir do banco)
- Libs consumidas (não tocar daqui): `src/lib/financeiro/{financeiro-auth,eventos,service,regras-financeiro}.ts`,
  `invoice/*` (dev-Back) e `banks/*`, `nfse/*` (dev-Integrações)
- Tipos canônicos: `src/types/financeiro.ts`

## Padrões de rota (TODAS as rotas)

- `export const dynamic = 'force-dynamic'`
- Gate em TODA rota: `garantirNivelFinanceiro(request, 'view'|'edit'|'admin')`;
  o `NextResponse` do gate é repassado direto (401 sem/inválido token, 403 sem nível)
- Resposta `{success:true, data}` / `{success:false, error}`; 400 payload inválido,
  404 ausente, 409 estado/conflito (ex.: `fatura_moeda_invalida`, `fatura_status_invalido`)
- `FinanceiroHttpError` do service é mapeado por `finErro` (status+mensagem);
  erro inesperado → 500 com `console.error`
- NUNCA devolver valor de credencial: `app_secrets` vira `preenchidos: Record<campo, boolean>`
  (integracoes GET/[id], nfse/config GET/[id]); XMLs de emissão só com `?xml=1` + nível edit

## Regras de negócio vivas nas rotas

- Fatura: nº sequencial transacional por (empresa, ano) na CRIAÇÃO
  (pg advisory lock + `INSERT...SELECT COALESCE(MAX)+1` — ver service.criarFatura);
  PUT parcial só em `rascunho` (itens substituídos integralmente, total recalculado);
  DELETE → `status=cancelada` (409 se não rascunho/emitida)
- gerar-da-folha: só sheet `approved|paid`; base = `payroll_employee_summaries.gross_salary`
  por colaborador; cliente tem que pertencer à empresa da folha
- NFS-e: emissão exige fatura `emitida` + config ativa + moeda BRL (409
  `fatura_moeda_invalida`); `config.codigo_lc116_padrao` obrigatório; reemissão reusa
  RPS de emissão `rps_gerado|rejeitado`; estados/eventos ver §5.2
- Conciliação: `importar` (API) e `upload-csv` (parser `banks/csv-extrato.ts`) convergem
  para `service.importarConciliacoes` — idempotente por UNIQUE (conta, id_externo),
  casamento txid > nosso_numero > valor+data contra cobranças `gerada` → `liquidada` + evento
- cobrancas/[id]/atualizar: o contrato §3.1 não tem consulta unitária — "reconsulta"
  roda a conciliação automática da conta contra a cobrança alvo
- DELETE de cliente: com faturas → soft-delete (`is_active=false`); sem → delete físico
- DELETE de integração/conta/template/config NFS-e → soft-delete

## Extensões do design (acordadas na onda 2)

- `PUT /nfse/municipios/[codigo_ibge]` (gate admin) — §7.2 MunicipiosTab edita
  `provider_sugerido/wsdl_url/ambiente_urls`; seed IBGE nunca sobrescreve esses campos

## Conexões

- UI: `FinanceiroHub` (`/folha-pagamento`, dev-Front) consome visao-geral/faturas/nfse/bancos;
  `admin/financeiro-config` consome catalogo/integracoes/nfse-config/municipios/templates
- api-client tipado: `src/lib/financeiro/api-client.ts` (dev-Front, importa `src/types/financeiro.ts`)
- Gates de verificação: raiz `GATES.md` (G1–G6 dev-Back, §10 do design)
