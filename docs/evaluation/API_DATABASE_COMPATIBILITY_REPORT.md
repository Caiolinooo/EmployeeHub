# API-Database Schema Compatibility Verification Report

**Date:** 2025-11-11  
**Purpose:** Verify schema compatibility with API expectations after SQL fixes

## Executive Summary

After conducting a comprehensive analysis of the API routes and database schema, I've identified **several critical compatibility issues** that need to be addressed. While the SQL fixes have been applied successfully, the current database schema does not fully align with what the API expects, particularly regarding the standardized view `vw_avaliacoes_desempenho`.

## 1. API Field Expectations Analysis

### 1.1 API Routes Examined
- `src/app/api/avaliacao-desempenho/avaliacoes/route.ts` - Main evaluations API
- `src/app/api/avaliacao/create/route.ts` - Evaluation creation API
- `src/app/api/avaliacao-desempenho/avaliacoes/[id]/route.ts` - Individual evaluation CRUD
- `src/app/api/avaliacao/setup-tables/route.ts` - Table setup API
- `src/app/api/avaliacao/check-tables/route.ts` - Table verification API

### 1.2 Expected API Fields

Based on the API code analysis, the system expects the following fields:

#### Core Evaluation Fields (Required by API):
```typescript
{
  id: UUID,
  funcionario_id: UUID,
  avaliador_id: UUID,
  periodo: TEXT,
  periodo_id: UUID,           // Expected after fixes
  data_inicio: DATE,
  data_fim: DATE,
  status: TEXT,
  pontuacao_total: FLOAT,
  observacoes: TEXT,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

#### User Information Fields (Expected from View):
```typescript
{
  funcionario_nome: TEXT,        // Expected: First name + Last name
  funcionario_cargo: TEXT,      // Expected: User position
  funcionario_departamento: TEXT, // Expected: User department
  avaliador_nome: TEXT,         // Expected: First name + Last name
  avaliador_cargo: TEXT         // Expected: User position
}
```

#### Response Structure Expected by API:
```typescript
{
  success: true,
  data: {
    ...evaluationFields,
    funcionario: {              // Nested object expected
      id: UUID,
      nome: TEXT,
      cargo: TEXT,
      departamento: TEXT
    },
    avaliador: {               // Nested object expected
      id: UUID,
      nome: TEXT,
      cargo: TEXT
    },
    criterios: [Array]          // Evaluation criteria
  }
}
```

## 2. Current Database Schema Analysis

### 2.1 Table Structure ✅ GOOD
The `avaliacoes_desempenho` table has all required fields:
- ✅ `id: uuid` (Primary Key)
- ✅ `funcionario_id: uuid` (Foreign Key)
- ✅ `avaliador_id: uuid` (Foreign Key)
- ✅ `periodo: text` (Legacy field)
- ✅ `periodo_id: uuid` (New standardized field)
- ✅ `data_inicio: date`
- ✅ `data_fim: date`
- ✅ `status: text`
- ✅ `pontuacao_total: double precision`
- ✅ `observacoes: text`
- ✅ `created_at: timestamp with time zone`
- ✅ `updated_at: timestamp with time zone`

### 2.2 Foreign Key Constraints ✅ GOOD
All required foreign key constraints are in place:
- ✅ `funcionario_id` → `funcionarios(id)`
- ✅ `avaliador_id` → `funcionarios(id)`
- ✅ `periodo_id` → `periodos_avaliacao(id)`
- ✅ `aprovado_por` → `users(id)`

### 2.3 Related Tables ✅ GOOD
All required related tables exist:
- ✅ `users_unified` - Unified user table
- ✅ `funcionarios` - Employee table
- ✅ `periodos_avaliacao` - Evaluation periods table
- ✅ `criterios` - Evaluation criteria table
- ✅ `pontuacoes` - Evaluation scores table

## 3. Critical Issues Identified

### 3.1 ❌ CRITICAL: View Definition Mismatch

**Issue:** The `vw_avaliacoes_desempenho` view is **missing JOINs** with user tables and does not provide expected fields.

**Current View Definition:**
```sql
SELECT 
  avaliacoes_desempenho.id,
  avaliacoes_desempenho.funcionario_id,
  avaliacoes_desempenho.avaliador_id,
  avaliacoes_desempenho.periodo,
  -- ... other fields from avaliacoes_desempenho only
FROM avaliacoes_desempenho;
```

**Expected View Definition (based on API expectations):**
```sql
SELECT 
  ad.id,
  ad.funcionario_id,
  ad.avaliador_id,
  ad.periodo,
  ad.periodo_id,
  ad.data_inicio,
  ad.data_fim,
  ad.status,
  ad.pontuacao_total,
  ad.observacoes,
  ad.created_at,
  ad.updated_at,
  -- Missing: User information fields
  uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
  uu_func.position AS funcionario_cargo,
  uu_func.department AS funcionario_departamento,
  uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
  uu_aval.position AS avaliador_cargo
FROM 
  avaliacoes_desempenho ad
  LEFT JOIN users_unified uu_func ON ad.funcionario_id = uu_func.id
  LEFT JOIN users_unified uu_aval ON ad.avaliador_id = uu_aval.id;
```

**Impact:** API calls to `vw_avaliacoes_desempenho` will **FAIL** when trying to access fields like `funcionario_nome`, `avaliador_nome`, etc.

### 3.2 ❌ HIGH: API-Database Field Name Mismatch

**Issue:** API expects specific field names that are not available in the current view.

**Missing Fields in View:**
- `funcionario_nome` → API expects this field
- `funcionario_cargo` → API expects this field  
- `funcionario_departamento` → API expects this field
- `avaliador_nome` → API expects this field
- `avaliador_cargo` → API expects this field

### 3.3 ⚠️ MEDIUM: Period Reference Inconsistency

**Issue:** While `periodo_id` field exists, the sample data shows `periodo_id` as `NULL` for all records.

**Sample Data Analysis:**
```
- ID: f993a572-423a-4481-a7e2-64aaf8e97b49
  Período: 2025-teste (ID: null) ❌
- ID: 4ca1e8d9-5ff0-4712-9361-6013d514724e  
  Período: anual (ID: null) ❌
- ID: b119ed85-fee7-4c6f-a2f0-0873f5cc27e3
  Período: teste 12-05 (ID: null) ❌
```

**Impact:** The migration from `periodo` TEXT to `periodo_id` UUID was not completed properly.

## 4. Compatibility Status Assessment

### 4.1 Field Mapping Analysis

| API Expected Field | Database Provides | Status | Notes |
|------------------|------------------|---------|-------|
| `id` | ✅ `id: uuid` | **GOOD** | Primary key matches |
| `funcionario_id` | ✅ `funcionario_id: uuid` | **GOOD** | Foreign key exists |
| `avaliador_id` | ✅ `avaliador_id: uuid` | **GOOD** | Foreign key exists |
| `periodo` | ✅ `periodo: text` | **GOOD** | Legacy field preserved |
| `periodo_id` | ✅ `periodo_id: uuid` | **GOOD** | New standardized field |
| `data_inicio` | ✅ `data_inicio: date` | **GOOD** | Date type matches |
| `data_fim` | ✅ `data_fim: date` | **GOOD** | Date type matches |
| `status` | ✅ `status: text` | **GOOD** | Text type matches |
| `pontuacao_total` | ✅ `pontuacao_total: double precision` | **GOOD** | Numeric type matches |
| `observacoes` | ✅ `observacoes: text` | **GOOD** | Text type matches |
| `created_at` | ✅ `created_at: timestamp` | **GOOD** | Timestamp type matches |
| `updated_at` | ✅ `updated_at: timestamp` | **GOOD** | Timestamp type matches |
| `funcionario_nome` | ❌ **MISSING** | **CRITICAL** | Not available in view |
| `funcionario_cargo` | ❌ **MISSING** | **CRITICAL** | Not available in view |
| `funcionario_departamento` | ❌ **MISSING** | **CRITICAL** | Not available in view |
| `avaliador_nome` | ❌ **MISSING** | **CRITICAL** | Not available in view |
| `avaliador_cargo` | ❌ **MISSING** | **CRITICAL** | Not available in view |

### 4.2 Relationship Verification

| Relationship | Status | Details |
|-------------|---------|---------|
| `funcionario_id` → `users_unified` | ✅ **GOOD** | Foreign key constraint exists |
| `avaliador_id` → `users_unified` | ✅ **GOOD** | Foreign key constraint exists |
| `periodo_id` → `periodos_avaliacao` | ✅ **GOOD** | Foreign key constraint exists |
| `aprovado_por` → `users` | ✅ **GOOD** | Foreign key constraint exists |

### 4.3 View Compatibility Assessment

| Requirement | Status | Details |
|-------------|---------|---------|
| View exists | ✅ **GOOD** | `vw_avaliacoes_desempenho` exists |
| Basic evaluation fields | ✅ **GOOD** | All core fields available |
| User information fields | ❌ **CRITICAL** | Missing JOINs with user tables |
| API field compatibility | ❌ **CRITICAL** | Missing expected fields |
| Data accessibility | ⚠️ **MEDIUM** | View works but lacks user data |

## 5. Root Cause Analysis

### 5.1 Primary Root Cause
The SQL fixes were applied to the table structure correctly, but the **view definition was not properly updated** to include the necessary JOINs with user tables. The current view is essentially a simple `SELECT * FROM avaliacoes_desempenho` without any relationships.

### 5.2 Secondary Issues
1. **Migration Incomplete:** The `periodo_id` field exists but wasn't populated with proper UUID references
2. **View Definition:** The view doesn't follow the intended design from the SQL fix script
3. **API Expectations:** The API code expects user information fields that aren't available

## 6. Recommendations

### 6.1 Immediate Actions Required

#### 6.1.1 Fix View Definition (CRITICAL)
```sql
CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
SELECT 
  ad.id,
  ad.funcionario_id,
  ad.avaliador_id,
  ad.periodo,
  ad.periodo_id,
  ad.data_inicio,
  ad.data_fim,
  ad.status,
  ad.pontuacao_total,
  ad.observacoes,
  ad.created_at,
  ad.updated_at,
  ad.deleted_at,
  ad.comentario_avaliador,
  ad.status_aprovacao,
  ad.data_autoavaliacao,
  ad.data_aprovacao,
  ad.aprovado_por,
  ad.dados_colaborador,
  ad.dados_gerente,
  -- User information from users_unified
  uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
  uu_func.position AS funcionario_cargo,
  uu_func.department AS funcionario_departamento,
  uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
  uu_aval.position AS avaliador_cargo,
  -- Period information
  pa.nome AS periodo_nome,
  pa.ano AS periodo_ano,
  pa.descricao AS periodo_descricao
FROM 
  avaliacoes_desempenho ad
  LEFT JOIN users_unified uu_func ON ad.funcionario_id = uu_func.id
  LEFT JOIN users_unified uu_aval ON ad.avaliador_id = uu_aval.id
  LEFT JOIN periodos_avaliacao pa ON ad.periodo_id = pa.id
WHERE 
  ad.deleted_at IS NULL;
```

#### 6.1.2 Fix Period References (HIGH)
Update existing records to populate `periodo_id` with proper UUID references from `periodos_avaliacao` table.

#### 6.1.3 Verify API Compatibility (MEDIUM)
Test all API endpoints to ensure they work with the corrected view.

### 6.2 Long-term Improvements

1. **API Versioning:** Consider implementing API versioning to handle schema changes
2. **Validation:** Add server-side validation for field existence
3. **Monitoring:** Implement monitoring for view/table schema changes
4. **Documentation:** Keep API documentation in sync with database schema

## 7. Conclusion

The SQL fixes have successfully addressed the table structure issues, but **critical compatibility issues remain** with the API expectations. The primary issue is that the standardized view `vw_avaliacoes_desempenho` does not provide the user information fields that the API expects.

**Overall Compatibility Status: ❌ PARTIALLY COMPATIBLE**

- ✅ **Table Structure:** 100% compatible
- ✅ **Foreign Keys:** 100% compatible  
- ❌ **View Definition:** 0% compatible with API expectations
- ❌ **Field Mapping:** Missing critical user information fields

**Priority:** HIGH - The view definition issue will cause API failures and needs immediate attention.

**Next Steps:** Apply the recommended view definition fix and verify API functionality.