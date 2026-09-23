# Financeiro Lib — DOX

## Purpose

Camada de negócio do módulo Financeiro (design `local://financeiro-design.md` §3–§5):
auth/gates, trilha de eventos, service (contextos de credenciais + fluxo
fatura/NFS-e/cobrança/conciliação/pagamentos), regras puras e renderers de fatura.

## Ownership (dono único por arquivo)

**dev-Back (este módulo):**
- `financeiro-auth.ts` — `garantirNivelFinanceiro(request, 'view'|'edit'|'admin')`;
  cópia adaptada de `payroll/payroll-auth.ts`: ADMIN → ACL `financeiro` → fallback
  setor financeiro/contábil-like (`/(financeiro|contabil|contabilidade)/i`) com
  `financeiro` nos `allowed_modules` (só view/edit; `admin` nunca sai do fallback).
  MÓDULO PRÓPRIO — não herda gates da Folha/DP.
- `eventos.ts` — `registrarEvento` (best-effort em `fin_eventos`, nunca derruba a
  operação), `atorDeUserId`/`carregarNomeAtor` (first_name+last_name → name; nunca
  `full_name`/`cpf` de `users_unified`)
- `regras-financeiro.ts` — regras PURAS (sem Supabase/Next): nº sequencial, cálculo
  de itens, máquina de estados fatura/NFS-e, `verificarEmissaoNfse` (BRL-only),
  `conciliarMovimento` (txid > nosso_numero > valor+data). Testes: `*.test.ts` (`npx tsx --test`)
- `service.ts` — monta `BankContext`/`NfseContext` decifrando `app_secrets` via
  `secure-credentials` (convenções `fin_banco_<integracaoId>_<campo>` /
  `fin_nfse_<configId>_<campo>`; senha do pfx = `..._pfx_senha`); resolve
  `getBankAdapter` (`./banks/registry`) e `getNfseProvider` (`./nfse/registry`);
  baixa .pfx do bucket privado `financeiro-certificados` para tmp server-side;
  nº de fatura transacional (pg advisory lock + BEGIN/COMMIT) e reserva de RPS +
  criação da emissão na MESMA transação (`criarEmissaoTransacional`, rollback
  libera o número — §5.2.2);
  `importarConciliacoes` transacional (pg) com ON CONFLICT idempotente;
  fatura vira `paga` quando a soma das cobranças `liquidada` atinge valor_total
  (`aposLiquidacaoVerificarFaturaPaga`, evento fatura.paga)
- `invoice/types.ts` (contrato §3.3) + `invoice/render-html.ts` (FUNÇÃO PURA, layout
  1_Invoice A4), `invoice/render-pdf.ts` (pdfkit), `invoice/render-xlsx.ts` (exceljs +
  template do bucket `financeiro-templates`)

**dev-Integrações (NÃO tocar):** `banks/*` (types §3.1, registry, http-mtls,
csv-extrato, itau, xp, placeholders) e `nfse/*` (types §3.2, registry, xml-sign,
abrasf202/204, nacional, proprietario, municipios/macae)

## Invariantes

- Nenhum segredo em log/resposta; `raw` de adapter/provider chega sanitizado (contrato §3)
- Estados nunca mudam sem `regras-financeiro.ts`; toda transição de NFS-e/cobrança
  grava `fin_eventos` (`nfse.enviado|autorizada|rejeitada|cancelada`,
  `fatura.emitida|cancelada`, `cobranca.gerada|liquidada`, `pagamento.enviado`)
- pg direto (`DATABASE_URL`) só onde o design exige transação (criarFatura,
  alocarNumeroRps, importarConciliacoes); resto via `supabaseAdmin` (RLS sem policies)
- render-html é determinístico e puro (testável sem rede/DB); render-xlsx preserva
  merges/fórmulas e tem convenção documentada: `celulas` campo→célula com preservação
  de rótulo ("Invoice No: …"), `servicos.colunas.referencia === descricao` → descrição
  recebe "descricao — referencia"

## Templates xlsx (1_Invoice)

Mapping real do `Template_Invoice_Geral.xlsx` V13.0.0 (descoberto por
`scripts/inspect-fatura-template.ts --seed`, gravado como template default em
`fin_fatura_templates`): metadados em C13/C12/A12/A13 (rótulo+valor na mesma célula),
serviços linhas 17–29 colunas A (descrição; sem coluna de referência) e D (valor),
total D30, seção conta A43.

## Conexões

- Consumidores: rotas `src/app/api/financeiro/**` (ver AGENTS.md lá), api-client do
  Front (`src/lib/financeiro/api-client.ts`), scripts de gate na raiz `GATES.md`
- `scripts/verify-financeiro-fluxo-e2e.ts` exercita o service inteiro sem rede
  (mock HTTP local para o provider proprietário Macaé 3302403)
