# Painel ABZ

Portal corporativo da ABZ Group. Pessoas, escala offshore, folha DP, e-Social, férias, reembolso e o resto do dia a dia no mesmo sistema.

**Versão:** 5.83.0 · **Produção:** Vercel · **Repo:** [Caiolinooo/painel-abz](https://github.com/Caiolinooo/painel-abz)

![Painel ABZ](public/images/LC1_Azul.png)

---

## O que é

Next.js + Supabase. Login JWT/Supabase, permissões por módulo/feature/ACL, dados operacionais em tabelas `gt_*` (fonte local). MIO e PoliWeb entram só por pull admin/cron — o runtime não chama eles na carga da página.

Histórico de versões: [CHANGELOG.md](CHANGELOG.md). Segurança: [SECURITY.md](SECURITY.md). Contratos de código: [AGENTS.md](AGENTS.md).

---

## Nesta versão (5.83.0)

- **Aba Rubricas & Folha no DP**: sincronize o WK Radar (API ou arquivo), calcule a folha e envie para aprovação com múltiplos assinantes — tudo dentro do Departamento Pessoal, com auditoria completa.
- **Motor de folha corrigido**: IRRF pela tabela progressiva, fórmulas de DSR/reflexo, perfis com teto de VT e rescisão completa (verbas 301–307) no desligamento.
- **Férias e escala alimentam a folha**: dias de embarque e férias aprovadas viram rubricas na consolidação; o WK tem precedência e lançamentos manuais nunca são sobrescritos.
- **Rubricas editáveis com Código WK**: cadastro completo em Configurações → Rubricas, com acesso controlado por permissões (visualizar, editar, aprovar).

## Nesta versão (5.82.0)

- **Novo módulo Indicadores R&S** no menu: importe qualquer planilha Excel e passe a gerenciar os dados dentro do portal, em modal próprio com grade editável (incluir, editar e excluir linhas).
- **Importação dinâmica**: o sistema descobre abas, linha de cabeçalho e tipos de coluna (datas, números, percentuais) — serve para as planilhas atuais de vagas/eficácia/auditoria e para qualquer nova.
- **Planilhas já migradas**: Controle de Vagas 2026, Indicador de Eficácia 2026 e Indicadores Auditoria 2026 já estão no sistema (2.133 linhas), prontos para consulta e edição.
- **Acesso controlado**: permissões próprias (visualizar/editar/importar) para o setor de R&S — ADMIN e gestores já têm; outras pessoas recebem via gestão de ACL.

## Nesta versão (5.81.0)

- **Regra do desembarque**: o dia em que a pessoa desembarca conta como o 1º dia de folga — ON vai do embarque até a véspera ("14 embarcado" = desembarque no 15º dia). Dobra, FI e checks do fechamento recalculados nessa base, com o mês seguinte pegando só a fatia dele.
- **Planilha do fechamento completa**: XLSX mostra o período fechado com datas reais e duas colunas novas de pendência do próximo período (FI e DBA/folga aberta) — o documento assinado reflete o que fecha e o que fica.
- **Editar sem sair do fechamento**: botão Editar em cada tripulante abre os embarques do período para corrigir datas/excluir na hora, com auditoria e reversão pela Fila de Revisão.
- **Permissões finas no ACL**: período do fechamento, marcações e revisão de edições viraram permissões ACL (além do papel de gestor) — dá para delegar cada recurso a quem precisa.

## Nesta versão (5.80.0)

- **Remarcar não apaga mais o resto**: salvar sobre uma marcação existente recorta o evento antigo (pontas antes/depois do novo período ficam; no meio, vira dois blocos). Caixas opcionais no painel apagam anterior/posterior de propósito.
- **Exclusão com confirmação**: por padrão apaga só o dia/semana clicado no visor; o evento completo só sai com a caixa "Apagar evento completo" marcada. Tudo reversível.
- **Desfazer no toast**: logo após salvar/excluir, um clique reverte a própria ação (o autor pode desfazer o próprio lance).
- **Histórico global**: nova aba "Histórico de alterações" na página GT com filtros (status, operação, colaborador, período) e Reverter/Rejeitar para gestores.

## Nesta versão (5.79.1)

- **44 vulnerabilidades zeradas** (2 críticas): Next 15.5.25 (RCE), SheetJS xlsx 0.20.3 (tarball oficial do CDN), puppeteer 25, nodemailer, sharp, postcss e transitivos — `npm audit` limpo.
- **Sem quebra de função**: 163 testes, build de produção e smoke real de XLSX (roundtrip) e PDF (geração com Chrome) passaram; única mudança visível é interna (buffers de PDF/XLSX viram `Uint8Array` nas respostas — bytes idênticos).

## Nesta versão (5.79.0)

- **Fechamento DP v2**: período manual dd/mm/aa por mês (gravado com a assinatura), colaboradores marcados por fechamento ("confirmar lista") e pendências de FI/DBA do próximo período visíveis sem entrar no mês fechado.
- **Edição de ON/DBA/FI auditada e reversível**: todo save grava quem/quando/antes/depois; aprovadores revisam a fila e podem rejeitar (rollback automático) ou reverter qualquer edição.
- **Marcador não apaga mais a rotação**: DBA de 1 dia dentro do ON não apaga mais o ciclo inteiro — substituição agora é por tipo (bug do Rômulo).
- **Tudo live + tela cheia + multi-embarcação**: grade, matriz e fechamento reagem a mudanças em 15s; modal de fechamento em tela cheia; filtros de embarcação multi-seleção; portal usável no celular.

## Nesta versão (5.78.0)

- **Fechamento calcula DBA/FI sobre 100% dos embarques**: o relatório mensal lia os dados sem paginação e o PostgREST trunca em 1000 linhas — preview, XLSX, aprovação e painel DP calculavam sobre subconjunto arbitrário. Agora pagina (mesma correção do Man Schedule na v5.77.1).
- **Dobra explícita não paga mais FI dobrada**: evento DBA na grade não vira mais "ciclo" de rotação; dia trabalhado na folga conta como folga faltante (regra confirmada pelo DP).
- **Ficha do colaborador mostra a escala real**: último/próximo embarque passam a ser derivados dos eventos vivos (as colunas estavam congeladas desde o último pull MIO) e são ressincronizadas a cada save.
- **Cadastros corrigidos**: trocar o regime preenche os dias da escala escolhida, cards do histórico contam gravações novas e datas não mostram mais véspera no fuso BRT.

## Nesta versão (5.77.1)

- **Causa real do "não marca alterações"**: o realtime do Man Schedule lia os embarques sem paginação e o PostgREST trunca em 1000 linhas — com 2825 vivas, toda marcação nova ficava de fora da resposta e a célula apagava 1s após o toast. Agora pagina com `.order('id')` + `.range()`; marcões persistem e aparecem.

## Nesta versão (5.77.0)

- **"Não marca alterações" resolvido na causa raiz**: o refetch que roda após o save não descarta mais a marcação com resposta antiga em voo, e o cache de 60s do módulo não guarda mais dado pré-save.
- **Escala 100% local**: importação de escala do MIO desligada — os dados já importados são mantidos e a escrita do portal é a única verdade; nada reverte edição ou exclusão local.
- **Eventos "abertos" (sem data de desembarque) são substituídos pelo save**, e a marcação local vence qualquer sobreposição na pintura do grid.

## Nesta versão (5.76.1)

- **Save substitui sobrepostos**: marcar um evento remove os que sobrepõem o período do mesmo colaborador (soft-delete, seguro contra o pull MIO) e o grid informa o que foi substituído.

## Nesta versão (5.76.0)

- **Man Schedule salva e mostra**: marcação manual vence o evento MIO de datas idênticas (antes: save gravava, mas a linha MIO sombreava a célula — "marcação sumia ao salvar"). Retentativas não criam mais eventos duplicados (POST idempotente + limpeza das duplicatas legadas).
- **Fechamento DP confiável**: sem FI fantasma de ciclos duplicados; afastamento sem data de retorno conta FER/AFAST (janela 90d), não ON; mês de referência em BRT nos defaults (modal, rota, cron).
- **Grade íntegra**: FER/AFAST não são editáveis pela grade; datas invertidas rejeitadas; save sem mudança não dessincroniza a linha MIO; cache do realtime reage a mudanças de afastamento do DP.

---

## Stack

| Camada | Uso real |
|--------|----------|
| Next.js 15.5 (App Router) + React 18 + TypeScript 5 | UI e API routes |
| Tailwind CSS + Radix UI | Layout |
| Supabase (PostgreSQL + RLS + Storage) | Banco e arquivos |
| JWT próprio + Supabase Auth | Sessão |
| Vercel | Produção e preview (não é Netlify) |

Node `>= 20.9`.

---

## Módulos

Fonte única: `src/config/modules.ts`. Sidebar, UserEditor e `POST /api/acl/init` leem esse catálogo.

| Área | Rotas | O que faz |
|------|--------|-----------|
| Departamento Pessoal | `/department/dp` | Cadastro do zero, lista, fechamento de escala/folha, vencimento e agendamento de ASO |
| Gestão de Tripulantes | `/department/gestao-tripulantes` | Matriz, ficha, escala, documentos, treinamentos, desligamento |
| Man Schedule | `/department/man-schedule` | Grade de escala a partir de `gt_historico_embarques` |
| e-Social | `/department/e-social` | Eventos (S-2200…S-2299 e correlatos), XML, envio, matrícula |
| Férias | `/ferias` | Pedido, histórico, PDF com assinatura, export |
| Reembolso | `/reembolso` | Solicitação, aprovação, e-mails (listas no admin) |
| EPI / QHSE | `/epi` | Estoque e ficha; na ficha GT a aba QHSE **não** lista ASO |
| Academy, contratos, ponto, contracheque, lista de presença | rotas homônimas | RH do dia a dia |
| Calendário | `/calendario` | Só feriados oficiais + ICS compartilhado |
| IA / KPIs | `/ia`, `/kpi` | Companion global + quadro KPI (tools, sem inventar número) |
| Admin | `/admin/*` | Usuários, e-mail, GT, ACL, splash |

Permissões em três camadas: módulo on/off, features JSONB, ACL (`acl_permissions`). `hasFeature` trata JSONB e nome ACL como o mesmo grant.

---

## Dados (o que importa)

- **Colaborador** vive em `gt_colaboradores`. DP e GT leem/escrevem pela API `/api/gestao-tripulantes/colaboradores`.
- **Escala / POB / status de hoje** vêm da célula de hoje em `gt_historico_embarques`, não da coluna stale `status_embarque`.
- **MIO**: pull `POST /api/gestao-tripulantes/mio/sync`. Nunca PUT/PATCH/DELETE de volta ao MIO.
- **`users_unified`**: identidade de portal é `tax_id` + e-mail. Não existe coluna `cpf`.
- **Calendário**: sem embarque, curso ou ASO.

---

## Desenvolvimento

```bash
git clone https://github.com/Caiolinooo/painel-abz.git
cd painel-abz
npm install
cp .env.example .env.local
npm run dev
```

Sobe em `http://localhost:3000`.

```bash
npm run build          # produção local
npm run lint
npx tsx --test src/lib/gestao-tripulantes/colaborador-cadastro.test.ts
npx tsx --test src/lib/gestao-tripulantes/fechamento-calculo.test.ts
```

Migrações do módulo GT / e-Social / cache: `supabase/migrations/` e scripts `npm run db:*` conforme o caso. Schema novo não se aplica no `db:setup` antigo sozinho — use o SQL Editor do Supabase ou o script do módulo.

### Variáveis mínimas

| Variável | Função |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | APIs server-side (nunca no browser) |
| `JWT_SECRET` | Tokens do portal |

E-mail: bootstrap no `.env` (`EMAIL_*` / `MS_GRAPH_*`). Operação: `/admin/email-settings` → `app_secrets` (senha AES). Ordem em runtime: DB → env. Contrato: `src/app/api/admin/email-settings/AGENTS.md`.

Não commitar senha, JWT, app password ou fallback real. Ver `SECURITY.md`. CI: Gitleaks (`.gitleaks.toml`).

---

## Deploy

Só **Vercel**. Preview e produção usam as mesmas env vars do projeto. Cron (avaliações, vencimento ASO, etc.) é `vercel.json`, não Netlify.

Branch de integração deste fluxo: `portal`.

---

## Estrutura (curta)

```
src/app/           páginas e API routes
src/components/    UI (GT, IA, e-Social, layouts)
src/lib/           regras (cadastro, fechamento, e-Social, OCR, IA)
src/config/        catálogo vivo de módulos
supabase/          migrations
```

Contratos por pasta ficam no `AGENTS.md` mais próximo — não duplicar regra de negócio neste README.
