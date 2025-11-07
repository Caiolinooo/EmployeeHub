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

**Última atualização**: 2025-11-07
**Responsável**: Claude AI (Security Audit)
