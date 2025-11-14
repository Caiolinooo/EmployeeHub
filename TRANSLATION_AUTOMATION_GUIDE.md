# 🤖 GUIA DO SISTEMA AUTOMATIZADO DE TRADUÇÕES

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Como Usar](#como-usar)
4. [Sistema de Checkpoint](#sistema-de-checkpoint)
5. [Retomando o Trabalho](#retomando-o-trabalho)
6. [Arquivos Gerados](#arquivos-gerados)
7. [Solução de Problemas](#solução-de-problemas)
8. [Exemplos](#exemplos)

---

## 🎯 VISÃO GERAL

Este sistema automatiza a correção de **5,110+ strings hardcoded** em **505 arquivos** do projeto, substituindo-as por chamadas ao sistema de tradução.

### **O que o sistema faz:**

1. ✅ **Detecta** strings hardcoded em português
2. ✅ **Gera** chaves de tradução automaticamente
3. ✅ **Traduz** para inglês usando dicionário inteligente
4. ✅ **Substitui** strings nos arquivos por `t('chave')`
5. ✅ **Adiciona** traduções em `pt-BR.ts` e `en-US.ts`
6. ✅ **Salva** progresso em checkpoints
7. ✅ **Gera** logs detalhados

### **Arquivos do Sistema:**

```
scripts/
├── auto-translate.js           # Configuração e classes base
├── translation-processor.js    # Processador de strings
├── run-translation.js          # Script principal
├── .translation-checkpoint.json # Checkpoint (gerado)
└── translation-progress.log    # Log detalhado (gerado)
```

---

## 🚀 INSTALAÇÃO

Não é necessária instalação adicional. O sistema usa apenas Node.js nativo.

**Requisitos:**
- Node.js 14+
- Projeto Painel ABZ

---

## 💻 COMO USAR

### **Comando Básico:**

```bash
node scripts/run-translation.js
```

### **Opções Disponíveis:**

| Opção | Descrição | Exemplo |
|-------|-----------|---------|
| `--resume` | Retoma do último checkpoint | `node scripts/run-translation.js --resume` |
| `--module=nome` | Processa apenas um módulo | `node scripts/run-translation.js --module=profile` |
| `--dry-run` | Simula sem fazer alterações | `node scripts/run-translation.js --dry-run` |
| `--reset` | Reseta checkpoint e começa do zero | `node scripts/run-translation.js --reset` |

### **Módulos Disponíveis:**

- `profile` - Perfil do usuário
- `academy` - Academia/Cursos
- `reimbursement` - Reembolsos
- `calendar` - Calendário
- `contacts` - Contatos
- `admin` - Painel administrativo
- `dashboard` - Dashboard
- `components` - Componentes gerais

---

## 💾 SISTEMA DE CHECKPOINT

O sistema salva o progresso automaticamente em `.translation-checkpoint.json`.

### **Estrutura do Checkpoint:**

```json
{
  "version": "1.0.0",
  "startedAt": "2025-01-10T10:00:00.000Z",
  "lastUpdated": "2025-01-10T10:30:00.000Z",
  "progress": {
    "totalFiles": 648,
    "processedFiles": 150,
    "totalStrings": 1200,
    "translatedStrings": 1150,
    "errors": 2
  },
  "processedFiles": [
    {
      "path": "src/app/profile/page.tsx",
      "processedAt": "2025-01-10T10:15:00.000Z",
      "stringsFound": 25,
      "stringsTranslated": 25
    }
  ],
  "translations": {
    "added": [
      {
        "key": "profile.myProfile",
        "ptText": "Meu Perfil",
        "enText": "My Profile",
        "module": "profile",
        "addedAt": "2025-01-10T10:15:00.000Z"
      }
    ]
  },
  "currentModule": "profile",
  "completed": false
}
```

### **Benefícios do Checkpoint:**

- ✅ **Retomável**: Continue de onde parou
- ✅ **Seguro**: Não perde progresso em caso de erro
- ✅ **Rastreável**: Veja exatamente o que foi feito
- ✅ **Auditável**: Histórico completo de traduções

---

## 🔄 RETOMANDO O TRABALHO

### **Cenário 1: Interrupção Acidental**

Se o script for interrompido (Ctrl+C, erro, etc):

```bash
# Retomar do último checkpoint
node scripts/run-translation.js --resume
```

O sistema:
1. ✅ Carrega o checkpoint
2. ✅ Pula arquivos já processados
3. ✅ Continua de onde parou

### **Cenário 2: Novo Chat/Sessão**

Para continuar em um novo chat:

1. **Verifique o progresso:**
   ```bash
   cat scripts/.translation-checkpoint.json
   ```

2. **Veja o log:**
   ```bash
   cat scripts/translation-progress.log
   ```

3. **Retome:**
   ```bash
   node scripts/run-translation.js --resume
   ```

### **Cenário 3: Recomeçar do Zero**

Se quiser recomeçar:

```bash
# Resetar e começar novamente
node scripts/run-translation.js --reset
```

---

## 📁 ARQUIVOS GERADOS

### **1. `.translation-checkpoint.json`**

**Localização:** `scripts/.translation-checkpoint.json`

**Conteúdo:**
- Progresso atual
- Arquivos processados
- Traduções adicionadas
- Estatísticas

**Uso:**
- Retomar trabalho
- Auditar progresso
- Verificar status

### **2. `translation-progress.log`**

**Localização:** `scripts/translation-progress.log`

**Conteúdo:**
- Log detalhado de cada operação
- Timestamps
- Erros e avisos
- Resumo final

**Exemplo:**
```
[2025-01-10T10:15:23.456Z] [INFO] 📄 Processando: src/app/profile/page.tsx
[2025-01-10T10:15:23.789Z] [INFO]    🔍 Encontradas 25 strings
[2025-01-10T10:15:24.123Z] [INFO]    ✓ Linha 366: "Meu Perfil" → t('profile.myProfile')
[2025-01-10T10:15:24.456Z] [SUCCESS]    ✅ Arquivo atualizado com 25 traduções
```

### **3. Arquivos de Tradução Atualizados**

**Localizações:**
- `src/i18n/locales/pt-BR.ts`
- `src/i18n/locales/en-US.ts`

**Modificações:**
- Novas chaves adicionadas
- Módulos criados/expandidos
- Traduções organizadas

---

## 🔧 SOLUÇÃO DE PROBLEMAS

### **Problema 1: Erro "Cannot find module"**

**Solução:**
```bash
# Certifique-se de estar no diretório raiz do projeto
cd d:/Projeto/Finalizados/Painel\ ABZ-BR-INT/painel-abz

# Execute novamente
node scripts/run-translation.js
```

### **Problema 2: Checkpoint corrompido**

**Solução:**
```bash
# Deletar checkpoint e recomeçar
rm scripts/.translation-checkpoint.json
node scripts/run-translation.js
```

### **Problema 3: Traduções incorretas**

**Solução:**
1. Verifique o log: `cat scripts/translation-progress.log`
2. Identifique a tradução incorreta
3. Corrija manualmente em `pt-BR.ts` e `en-US.ts`
4. Continue o processamento: `node scripts/run-translation.js --resume`

### **Problema 4: Arquivo não modificado**

**Causas possíveis:**
- Arquivo já usa `t()`
- Sem strings hardcoded
- Erro de permissão

**Solução:**
- Verifique o log para detalhes
- Verifique permissões do arquivo
- Tente processar manualmente

---

## 📚 EXEMPLOS

### **Exemplo 1: Processar Tudo**

```bash
# Processar todos os módulos
node scripts/run-translation.js

# Saída esperada:
# 🚀 Iniciando processamento de traduções...
# 📁 Encontrados 648 arquivos para processar
# 📄 Processando: src/app/profile/page.tsx
# ...
# ✅ Processamento concluído!
```

### **Exemplo 2: Apenas Módulo de Perfil**

```bash
# Processar apenas perfil
node scripts/run-translation.js --module=profile

# Saída esperada:
# 🚀 Iniciando processamento de traduções...
# 📁 Encontrados 5 arquivos para processar
# 📄 Processando: src/app/profile/page.tsx
# ...
# ✅ Processamento concluído!
```

### **Exemplo 3: Simular (Dry Run)**

```bash
# Simular sem fazer alterações
node scripts/run-translation.js --dry-run

# Saída esperada:
# ⚠️  MODO DRY-RUN: Nenhuma alteração será feita
# 🚀 Iniciando processamento de traduções...
# ...
# ✅ Processamento concluído!
```

### **Exemplo 4: Retomar Trabalho**

```bash
# Verificar progresso
cat scripts/.translation-checkpoint.json | grep "processedFiles"
# Saída: "processedFiles": 150,

# Retomar
node scripts/run-translation.js --resume

# Saída esperada:
# 🚀 Iniciando processamento de traduções...
# 📁 Encontrados 498 arquivos para processar (150 já processados)
# ...
```

---

## 📊 MONITORAMENTO DO PROGRESSO

### **Durante a Execução:**

```bash
# Em outro terminal, monitore o log em tempo real
tail -f scripts/translation-progress.log
```

### **Verificar Status:**

```bash
# Ver progresso atual
node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/.translation-checkpoint.json', 'utf8')).progress)"

# Saída:
# {
#   totalFiles: 648,
#   processedFiles: 150,
#   totalStrings: 1200,
#   translatedStrings: 1150,
#   errors: 2
# }
```

### **Calcular Tempo Restante:**

```bash
# Ver tempo decorrido e estimar restante
node -e "
const cp = JSON.parse(require('fs').readFileSync('scripts/.translation-checkpoint.json', 'utf8'));
const start = new Date(cp.startedAt);
const now = new Date();
const elapsed = (now - start) / 1000 / 60; // minutos
const rate = cp.progress.processedFiles / elapsed;
const remaining = (cp.progress.totalFiles - cp.progress.processedFiles) / rate;
console.log(\`Tempo decorrido: \${elapsed.toFixed(1)} min\`);
console.log(\`Tempo restante estimado: \${remaining.toFixed(1)} min\`);
"
```

---

## 🎯 PRÓXIMOS PASSOS APÓS CONCLUSÃO

1. **Verificar Logs:**
   ```bash
   cat scripts/translation-progress.log | grep ERROR
   ```

2. **Testar Aplicação:**
   ```bash
   npm run dev
   ```

3. **Testar Troca de Idioma:**
   - Acesse a aplicação
   - Troque entre PT e EN
   - Verifique se todas as strings estão traduzidas

4. **Revisar Traduções:**
   - Abra `src/i18n/locales/en-US.ts`
   - Revise traduções automáticas
   - Corrija se necessário

5. **Commitar Mudanças:**
   ```bash
   git add -A
   git commit -m "feat: Automatizar traduções completas do sistema"
   git push
   ```

---

## 📞 SUPORTE

Para dúvidas ou problemas:

1. Verifique o log: `scripts/translation-progress.log`
2. Verifique o checkpoint: `scripts/.translation-checkpoint.json`
3. Consulte este guia
4. Abra uma issue no GitHub

---

**Última Atualização:** 2025-01-10  
**Versão:** 1.0.0  
**Autor:** Sistema Automatizado de Traduções

