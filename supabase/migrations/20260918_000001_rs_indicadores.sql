-- ===========================================
-- MIGRATION: 20260918_000001_rs_indicadores.sql
-- Módulo Indicadores (R&S): planilhas .xlsx importadas, abas e linhas
-- dinâmicas (colunas em JSONB) + trilha de importações.
--
--   rs_planilhas     — dataset importado (uma planilha .xlsx)
--   rs_abas          — aba da planilha (cabeçalho detectado + schema de colunas)
--   rs_linhas        — linhas de dados (dados JSONB, soft delete)
--   rs_importacoes   — auditoria de cada importação (criar/substituir)
--
-- RLS: as quatro tabelas ficam com RLS LIGADO e ZERO policies — leitura/
--      escrita apenas via service_role / supabaseAdmin (regra dura do módulo
--      GT, ver src/app/api/gestao-tripulantes/AGENTS.md). As permissões de
--      negócio ficam na aplicação (src/lib/indicadores/permissoes.ts).
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS; re-executar não falha.
-- ===========================================

-- 1) Planilha importada (dataset)
CREATE TABLE IF NOT EXISTS public.rs_planilhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    arquivo_nome TEXT,
    observacoes TEXT,
    criado_por JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Aba da planilha (schema dinâmico de colunas em JSONB)
CREATE TABLE IF NOT EXISTS public.rs_abas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planilha_id UUID NOT NULL REFERENCES public.rs_planilhas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    linha_cabecalho INTEGER NOT NULL DEFAULT 1,
    colunas JSONB NOT NULL DEFAULT '[]'::jsonb,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT rs_abas_planilha_nome_unique UNIQUE (planilha_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_rs_abas_planilha ON public.rs_abas(planilha_id);

-- 3) Linhas de dados (soft delete via deleted_at)
CREATE TABLE IF NOT EXISTS public.rs_linhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aba_id UUID NOT NULL REFERENCES public.rs_abas(id) ON DELETE CASCADE,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    ordem BIGINT,
    criado_por JSONB,
    atualizado_por JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rs_linhas_aba_vivas
    ON public.rs_linhas(aba_id)
    WHERE deleted_at IS NULL;

-- 4) Auditoria das importações
CREATE TABLE IF NOT EXISTS public.rs_importacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planilha_id UUID REFERENCES public.rs_planilhas(id) ON DELETE SET NULL,
    arquivo_nome TEXT,
    modo TEXT,
    abas JSONB,
    total_linhas INTEGER,
    ator JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) RLS ligado, ZERO policies (service_role / supabaseAdmin apenas).
ALTER TABLE public.rs_planilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_abas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_linhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_importacoes ENABLE ROW LEVEL SECURITY;
