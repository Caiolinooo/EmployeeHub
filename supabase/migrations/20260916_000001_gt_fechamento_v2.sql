-- ===========================================
-- MIGRATION: 20260916_000001_gt_fechamento_v2.sql
-- GT Fechamento v2:
--   R2 — período manual por mês de referência (gt_fechamento_periodos)
--   R5 — lista explícita de marcados por mês (gt_fechamento_marcacoes)
--   R7 — auditoria/fila de revisão das edições de escala (gt_escala_edicoes)
--   + snapshot de período/pendências em gt_relatorios_aprovacoes
-- Reparos idempotentes da migration 20260831_000001_gt_relatorios_aprovacoes.sql
--   (o arquivo no repo tem mojibake no default de dados_totais — '{}'::jsonb
--   corrompido — e NÃO cria UNIQUE(mes_referencia); o prod recebeu a constraint
--   via scripts/apply-gt-relatorios-migration.js. Aqui o shape é consertado de
--   forma idempotente, sem editar a migration histórica.)
-- RLS: as três tabelas novas ficam com RLS LIGADO e ZERO policies — leitura/
--      escrita apenas via service_role / supabaseAdmin (padrão do módulo GT).
-- ===========================================

-- 1) R2/R5 — período definido por mês de referência (YYYY-MM)
CREATE TABLE IF NOT EXISTS public.gt_fechamento_periodos (
    mes_referencia VARCHAR(7) PRIMARY KEY,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    lista_confirmada BOOLEAN NOT NULL DEFAULT false,
    definido_por UUID,
    definido_por_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT gt_fechamento_periodos_range_check CHECK (data_fim >= data_inicio)
);

-- 2) R5 — marcações de tripulantes por mês (lista confirmada = só marcados entram)
CREATE TABLE IF NOT EXISTS public.gt_fechamento_marcacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mes_referencia VARCHAR(7) NOT NULL,
    colaborador_id UUID NOT NULL REFERENCES gt_colaboradores(id),
    marcado BOOLEAN NOT NULL DEFAULT true,
    marcado_por UUID,
    marcado_por_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT gt_fechamento_marcacoes_mes_colab_unique UNIQUE (mes_referencia, colaborador_id)
);

CREATE INDEX IF NOT EXISTS idx_gt_fech_marcacoes_mes ON gt_fechamento_marcacoes(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_gt_fech_marcacoes_colab ON gt_fechamento_marcacoes(colaborador_id);

-- 3) R7 — auditoria das edições de escala (aplicação imediata + rollback revisável)
CREATE TABLE IF NOT EXISTS public.gt_escala_edicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    embarque_id UUID,
    colaborador_id UUID,
    operacao TEXT NOT NULL CHECK (operacao IN ('create','update','delete','restore','rejeicao','reversao')),
    status TEXT NOT NULL DEFAULT 'aplicada' CHECK (status IN ('aplicada','revertida','rejeitada')),
    dados_anteriores JSONB,
    dados_novos JSONB,
    motivo TEXT,
    ator_id UUID,
    ator_nome TEXT,
    ator_cpf TEXT,
    ator_role TEXT,
    ip TEXT,
    revisada_por_id UUID,
    revisada_por_nome TEXT,
    revisada_em TIMESTAMPTZ,
    hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_escala_edicoes_created_at ON gt_escala_edicoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gt_escala_edicoes_colab_created ON gt_escala_edicoes(colaborador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gt_escala_edicoes_status ON gt_escala_edicoes(status);

-- 4) gt_relatorios_aprovacoes — snapshot do período usado e das pendências +
--    4b) reparos idempotentes do shape de 20260831 (ver cabeçalho).
--    Tudo guardado por to_regclass: num ambiente onde a tabela de 20260831
--    nunca foi criada, os ALTERs NÃO podem abortar esta migration inteira
--    (elas rodam em uma única transação via pgserver). Nesse cenário o
--    NOTICE aponta para o executor original (scripts/apply-gt-relatorios-migration.js).
DO $$
BEGIN
    IF to_regclass('public.gt_relatorios_aprovacoes') IS NULL THEN
        RAISE NOTICE 'gt_relatorios_aprovacoes nao existe — pule os reparos (rode scripts/apply-gt-relatorios-migration.js antes).';
        RETURN;
    END IF;

    -- Snapshot GT v2 do período fechado e das pendências (R1/R2).
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS data_inicio DATE;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS data_fim DATE;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS pendencias JSONB;

    -- Colunas que só o executor scripts/apply-gt-relatorios-migration.js criava.
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS dados_totais JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS aprovadores_obrigatorios JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS assinaturas JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS emails_enviados TEXT[] DEFAULT '{}'::text[];

    -- Defaults corretos (repara o default corrompido — mojibake — de
    -- dados_totais no arquivo de 20260831, que usava um tipo inexistente).
    ALTER TABLE public.gt_relatorios_aprovacoes ALTER COLUMN dados_totais SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ALTER COLUMN aprovadores_obrigatorios SET DEFAULT '[]'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ALTER COLUMN assinaturas SET DEFAULT '[]'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ALTER COLUMN emails_enviados SET DEFAULT '{}'::text[];

    -- UNIQUE(mes_referencia): presente no prod via executor, ausente no arquivo
    -- do repo. Cria a constraint apenas se nem constraint nem índice único
    -- existirem; duplicatas pré-existentes caem no EXCEPTION (NOTICE).
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.gt_relatorios_aprovacoes'::regclass
          AND conname = 'gt_relatorios_aprovacoes_mes_referencia_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'gt_relatorios_aprovacoes'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%mes_referencia%'
    ) THEN
        BEGIN
            ALTER TABLE public.gt_relatorios_aprovacoes
                ADD CONSTRAINT gt_relatorios_aprovacoes_mes_referencia_key UNIQUE (mes_referencia);
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'gt_relatorios_aprovacoes: UNIQUE(mes_referencia) nao criado: %', SQLERRM;
        END;
    END IF;
END $$;

-- 5) RLS ligado, ZERO policies (service_role / supabaseAdmin apenas).
ALTER TABLE public.gt_fechamento_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_fechamento_marcacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_escala_edicoes ENABLE ROW LEVEL SECURITY;
