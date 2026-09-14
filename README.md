# Painel ABZ

Portal corporativo da ABZ Group. Pessoas, escala offshore, folha DP, e-Social, férias, reembolso e o resto do dia a dia no mesmo sistema.

**Versão:** 5.78.0 · **Produção:** Vercel · **Repo:** [Caiolinooo/painel-abz](https://github.com/Caiolinooo/painel-abz)

![Painel ABZ](public/images/LC1_Azul.png)

---

## O que é

Next.js + Supabase. Login JWT/Supabase, permissões por módulo/feature/ACL, dados operacionais em tabelas `gt_*` (fonte local). MIO e PoliWeb entram só por pull admin/cron — o runtime não chama eles na carga da página.

Histórico de versões: [CHANGELOG.md](CHANGELOG.md). Segurança: [SECURITY.md](SECURITY.md). Contratos de código: [AGENTS.md](AGENTS.md).

---

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
