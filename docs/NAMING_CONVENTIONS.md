# Convenções de Nomenclatura - EmployeeHub

## Padrões de Nomenclatura no Sistema

### Database Schema (PostgreSQL) - snake_case

O banco de dados `users_unified` usa **snake_case**:

```sql
CREATE TABLE users_unified (
  id TEXT PRIMARY KEY,
  phone_number TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  ...
);
```

### TypeScript Models - camelCase

O model TypeScript `src/models/User.ts` usa **camelCase**:

```typescript
export interface User {
  id: string;
  phoneNumber: string;  // DB: phone_number
  firstName: string;    // DB: first_name
  lastName: string;     // DB: last_name
  email?: string;
  createdAt: Date;      // DB: created_at
  updatedAt: Date;      // DB: updated_at
  ...
}
```

## Estado Atual: Nomenclatura Mista

⚠️ **O sistema atualmente usa AMBOS os padrões** em diferentes camadas:

### Onde se usa snake_case:
- ✅ Queries diretas ao banco (`supabase.from('users_unified').select('*')`)
- ✅ API routes que retornam dados diretamente do DB
- ✅ Scripts de banco de dados
- ✅ Importers (xlsx, csv, ERP)

### Onde se usa camelCase:
- ✅ Interfaces TypeScript (`src/models/User.ts`)
- ✅ Alguns componentes React (frontend)
- ✅ Contextos de autenticação

## Arquivos Afetados: 121 arquivos

```
src/lib/: 15 arquivos
src/components/: 35 arquivos
src/app/api/: 45 arquivos
src/app/: 15 arquivos
src/contexts/: 5 arquivos
src/services/: 3 arquivos
src/pages/api/: 3 arquivos
```

## Recomendações para Padronização Futura

### Opção A: Transformação Automática (RECOMENDADO)

Implementar transformação automática entre snake_case ↔ camelCase nas camadas de API:

```typescript
// utils/caseTransform.ts
export function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  }

  if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }

  return obj;
}

export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v));
  }

  if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/([A-Z])/g, (g) => `_${g.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }

  return obj;
}
```

**Uso**:
```typescript
// API Route
const dbData = await supabase.from('users_unified').select('*');
const transformedData = toCamelCase(dbData); // snake_case → camelCase
return NextResponse.json(transformedData);

// Update
const snakeData = toSnakeCase(updateData); // camelCase → snake_case
await supabase.from('users_unified').update(snakeData);
```

### Opção B: Padronização Total para snake_case

**NÃO RECOMENDADO no momento**: Requer mudanças em 121 arquivos com alto risco de quebrar funcionalidades.

### Opção C: Manter Status Quo (ATUAL)

Continuar com nomenclatura mista, com atenção para:
- Documentar claramente qual convenção usar em cada camada
- Code reviews para garantir consistência
- Testes para detectar problemas de mapeamento

## Impacto de Mudanças

### Risco ALTO ⚠️: Mudar User.ts para snake_case
- **Arquivos afetados**: 121
- **Esforço**: 20-40 horas
- **Risco de regressão**: ALTO
- **Necessita**: Testes extensivos em todos os módulos

### Risco MÉDIO ⚙️: Implementar transformação automática
- **Arquivos afetados**: ~30 API routes
- **Esforço**: 4-8 horas
- **Risco de regressão**: MÉDIO
- **Necessita**: Testes de integração API

### Risco BAIXO ✅: Documentar e manter status quo
- **Arquivos afetados**: 0
- **Esforço**: 1 hora (documentação)
- **Risco de regressão**: NENHUM
- **Necessita**: Apenas code reviews

---

**Decisão atual (2025-11-07)**: **Opção C** - Manter nomenclatura mista documentada

**Próximos passos recomendados**:
1. Implementar funções de transformação (Opção A) em nova sprint
2. Migrar gradualmente API routes para usar transformação
3. Apenas após 100% dos testes passarem, considerar mudança no model

**Responsável**: Claude AI (Code Review & Security Audit)
