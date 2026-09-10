# Painel ABZ

Portal corporativo da ABZ Group. Pessoas, escala offshore, folha DP, e-Social, férias, reembolso e o resto do dia a dia no mesmo sistema.

**Versão:** 5.75.0 · **Produção:** Vercel · **Repo:** [Caiolinooo/painel-abz](https://github.com/Caiolinooo/painel-abz)

![Painel ABZ](public/images/LC1_Azul.png)

---

## O que é

Next.js + Supabase. Login JWT/Supabase, permissões por módulo/feature/ACL, dados operacionais em tabelas `gt_*` (fonte local). MIO e PoliWeb entram só por pull admin/cron — o runtime não chama eles na carga da página.

Histórico de versões: [CHANGELOG.md](CHANGELOG.md). Segurança: [SECURITY.md](SECURITY.md). Contratos de código: [AGENTS.md](AGENTS.md).

---

## Nesta versão (5.75.0)

- **DP cadastra do zero** em `/department/dp/novo` e altera qualquer campo de `gt_colaboradores` (mesmo banco, sem tabela paralela). Gate ADMIN/MANAGER ou setor DP/RH + módulo Gestão de Tripulantes. CPF Módulo 11; `matricula_esocial` vazio copia `matricula`.
- **Fechamento NxN** usa dt início + dt fim de cada embarque. Dobra, FI, folga e STB iguais na UI, `GET /relatorio-mensal` e no XLSX (aba Ciclos NxN). Sem dt fim não inventa janela.
- **e-Social matrícula** sempre editável na revisão do evento. Gravar atualiza XML + cadastro GT.

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
