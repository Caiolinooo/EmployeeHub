# Financeiro UI — DOX

## Purpose

Casca visual de `/folha-pagamento`: trilha Portal / Financeiro e áreas agrupadas. O painel da competência mostra cards, barras e status. Paleta do portal (`abz-blue`, `abz-blue-dark`).

## Ownership

- Casca: `FinanceiroShell.tsx` + `financeiro-nav.ts` (grupos e `resolverAreaAtiva`)
- Painel: `CompetenciaOverview.tsx` + `financeiro-dashboard.ts`
- Hub de conteúdo: `FinanceiroHub.tsx` (`?tab=`)
- Layout: `src/app/folha-pagamento/layout.tsx`

## Local Contracts

- Áreas fixas: Painel, Cadastros, Folha, Faturamento, Contas, Relatórios, Ferramentas.
- Hub (`/folha-pagamento`, `/faturas`, `/nfse`, `/bancos`) honra `?tab=`. Demais rotas resolvem pelo path. `?tab=` numa rota fora do hub não troca a área.
- Atalhos da aba Folhas apontam para `/folha-pagamento/sheets` e `/folha-pagamento/nova`. O painel do DP continua em `/department/dp?tab=folha`.
- Variação do card de faturas = total faturado da competência contra o mês anterior presente na série. Sem mês anterior, sem badge. O card "recebido" não usa essa variação.
- Cores dos exemplos verdes não entram. Fundo escuro dos cards = `abz-blue-dark` / `abz-blue`.
- Relatórios (`/folha-pagamento/relatorios/{mensal,custos,guias}`) usam `RelatorioFiltros.tsx` + `GET /api/payroll/relatorios/operacional` (`type=operacional|custos|guias`; agregações puras em `src/lib/payroll/relatorios-agregacao.ts`). Perfis de cálculo: `GET|PUT /api/payroll/profiles` (rules JSONB do motor). Tabelas legais: leitura de `src/lib/payroll/legal-tables.ts`, versionadas em código.

## Work Guidance

- Item novo de menu: uma linha em `FIN_NAV_GROUPS` e um caso em `resolverAreaAtiva` (prefixo longo antes do curto).
- Não recolocar a faixa plana de abas no hub. A navegação mora na casca.

## Verification

- `npx tsx --test src/components/financeiro/financeiro-nav.test.ts`
- `/folha-pagamento`: trilha Portal / Financeiro, menu por área, cards e gráfico na visão geral.
- `/folha-pagamento/funcionarios` marca Cadastros → Funcionários. `/folha-pagamento/faturas` marca Faturamento.

## Child DOX Index

_(none)_
