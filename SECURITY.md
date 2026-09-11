# Documentação de Segurança - EmployeeHub

## Vulnerabilidades Conhecidas e Mitigações

### ⚠️ xlsx (HIGH Severity) - SEM FIX DISPONÍVEL no NPM

**Status**: Mitigado com controles defensivos
**Prioridade**: Substituição planejada para próxima sprint

#### Detalhes da Vulnerabilidade

1. **Prototype Pollution** (GHSA-4r6h-8v6p-xvw6, CVSS 7.8)
   - Versões afetadas: `<0.19.3`
   - Versão atual: `0.18.5`
   - Fix disponível: `0.19.3+` (apenas via CDN, NÃO no npm)

2. **Regular Expression Denial of Service (ReDoS)** (GHSA-5pgg-2g8v-p4x9, CVSS 7.5)
   - Versões afetadas: `<0.20.2`
   - Versão atual: `0.18.5`
   - Fix: NÃO disponível no npm

#### Arquivos Afetados

```
src/lib/importers/
├── userImporter.ts
├── sapImporter.ts
├── totvsImporter.ts
├── oracleImporter.ts

src/app/api/
├── payroll/luz-maritima/import/route.ts
├── payroll/luz-maritima/export/route.ts
└── avaliacao/import-criterios/route.ts
```

#### Mitigações Implementadas

1. ✅ **Validação de Origem**: Apenas usuários autenticados podem fazer upload de arquivos Excel
2. ✅ **Validação de Tipo**: Verificação de MIME type antes do processamento
3. ✅ **Limite de Tamanho**: Arquivos Excel limitados a tamanho máximo configurado
4. ✅ **Processamento Isolado**: xlsx usado apenas para leitura, não modifica objetos globais
5. ✅ **Input Sanitization**: Validação de dados após parsing com `validateUserData()`

#### Exploração Requer

- ❌ Acesso autenticado ao sistema
- ❌ Upload de arquivo Excel malicioso crafted
- ❌ Arquivo processado pelo servidor
- **Risco**: Baixo em produção (uploads restritos a admins)

#### Plano de Substituição (Recomendado)

**Alternativa**: `exceljs` (sem vulnerabilidades conhecidas)
- ✅ 2.9M downloads/semana
- ✅ Ativamente mantido
- ✅ Suporta leitura e escrita
- ✅ Compatível com formatos xlsx/csv

**Passos para migração futura**:
1. Instalar exceljs: `npm install exceljs`
2. Substituir imports: `import * as XLSX from 'xlsx'` → `import ExcelJS from 'exceljs'`
3. Ajustar código de leitura de workbooks
4. Testar todos os fluxos de import/export
5. Remover xlsx: `npm uninstall xlsx`

**Estimativa**: 4-6 horas de desenvolvimento + testes

---

### ✅ elliptic (LOW / Development) — REMEDIADO

**Alert**: Dependabot #155 — GHSA-848j-6mx2-7j84 (CWE-1240; range `<=6.6.1`)  
**Status**: Fixed by removal (2026-07-23) — no patched elliptic release exists

#### Tree (before)

```
crypto-browserify@3.12.1 (devDependency + next.config webpack fallback)
├── browserify-sign → elliptic@6.6.1
└── create-ecdh → elliptic@6.6.1
```

#### Why not override / audit force

- Latest npm `elliptic` is still `6.6.1` (advisory covers all versions ≤6.6.1)
- `npm audit fix --force` would install ancient `crypto-browserify@3.3.0` / `3.5.1` (breaking downgrade) — rejected

#### Fix applied

1. Set webpack client fallback `crypto: false` in `next.config.js` (app Node `crypto` usage is server/API-only; client uses Web Crypto)
2. `npm uninstall crypto-browserify` — removes elliptic from lockfile/tree
3. Verified: `npm ls elliptic` empty; `npm run build` exit 0

#### Residual risk

- Low: if a future client bundle imports Node `crypto`, webpack will fail at build (fail-closed) instead of polyfilling ECDH/signing via elliptic. Re-enable only with a patched elliptic or a non-elliptic polyfill.

---

## Histórico de Correções de Segurança

### FASE 1: Vulnerabilidades Críticas (Resolvidas)
- ✅ **next** 14.2.3 → 14.2.33 (CRITICAL)
  - Authorization Bypass no Middleware (CVSS 9.1)
  - Cache Poisoning + 9 outras vulnerabilidades

- ✅ **playwright** 1.52.0 → 1.55.1 (HIGH)
  - SSL certificate verification bypass

- ✅ **tar-fs**, **tmp**, **external-editor** (LOW-HIGH)
  - Correções automáticas via `npm audit fix`

### FASE 2: Breaking Changes (Resolvidas)
- ✅ **task-master-ai** → Removido (não usado, 191 pacotes eliminados)
  - Resolveu: jsondiffpatch, ai (MODERATE XSS)

- ✅ **pdfjs-dist** 3.4.120 → 4.8.69 (HIGH)
  - Arbitrary JavaScript execution em PDF malicioso
  - Compatível com react-pdf@9.2.1

- ✅ **nodemailer** 6.10.0 → 7.0.10 (MODERATE)
  - Email to unintended domain
  - Breaking changes apenas para Amazon SES (não aplicável)

### Resultado Final
- **Antes**: 12 vulnerabilidades (1 crítica, 4 high, 4 moderate, 3 low)
- **Depois**: 1 vulnerabilidade (1 high) - **Mitigada**

---

## Práticas de Segurança Implementadas

### Autenticação e Autorização
- JWT com verificação em todas as rotas protegidas
- Middleware de autenticação (`verifyRequestToken`)
- RLS (Row Level Security) no Supabase

### Input Validation
- Validação de dados em imports (`validateUserData`)
- Sanitização de inputs de usuário
- Verificação de tipos de arquivo

### Dependency Management
- Atualizações regulares via `npm audit`
- Teste de compatibilidade antes de updates major
- Documentação de vulnerabilidades conhecidas

### Segurança de Dados
- Senhas hasheadas com bcrypt
- Credenciais em variáveis de ambiente
- HTTPS obrigatório em produção

---

## Exposição de Credenciais O365 / GitHub (2026-07-22)

**Severidade**: Crítica (CVSS sugerido 9.8) — CWE-798  
**Origem**: Relatório DPO / Red Team — repositório público `Caiolinooo/EmployeeHub` com senha O365 em `src/lib/email-exchange.ts`.

### Remediações no código (este repositório)

- Remoção de fallbacks hardcoded de `EMAIL_PASSWORD` / `EMAIL_PASS` / app passwords Gmail
- Resolução centralizada em `src/lib/email-env.ts` (falha se env ausente)
- TLS SMTP com `rejectUnauthorized: true` (Nodemailer)
- JWT sem `fallback-secret` / `abz-secret-key` — `src/lib/jwt-secret.ts`
- WKRadar: senha padrão apenas via `WKRADAR_DEFAULT_PASSWORD` (servidor); API `/api/wkradar/credentials`
- `/api/email/debug` exige ADMIN e nunca retorna senha; desabilitado em produção sem `ALLOW_EMAIL_DEBUG=true`
- CI: `.github/workflows/secret-scanning.yml` + `.gitleaks.toml`
- Docs/scripts com segredos redigidos
- **RLS GT (2026-09-01):** `gt_afastamentos`, `gt_acidentes`, `gt_relatorios_aprovacoes` — `ENABLE ROW LEVEL SECURITY` sem policy para anon (acesso só `service_role` / APIs). Ver `tasks.md` e `src/app/api/gestao-tripulantes/AGENTS.md`.

### Ações manuais obrigatórias (fora do código)

Ver checklist em `tasks.md` (seção O365 / GitHub / DPO): tornar privado o repo público, rotacionar senha O365, revogar sessões/MFA, auditar sign-in logs, secret scanning org-wide, avaliar LGPD.

---

**Última atualização**: 2026-09-01
**Responsável**: Security remediation (O365 credential exposure + GT RLS)
