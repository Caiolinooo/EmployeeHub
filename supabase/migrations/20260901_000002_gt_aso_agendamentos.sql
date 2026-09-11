-- Gestão de Tripulantes / DP: workflow de agendamento de ASO
-- Runtime reads/writes only via supabaseAdmin (service_role).
-- ENABLE RLS with no anon/authenticated policies (same as gt_afastamentos).
-- Do not add USING (true) policies.

CREATE TABLE IF NOT EXISTS gt_aso_agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES gt_colaboradores(id) ON DELETE CASCADE,
    documento_aso_id UUID REFERENCES gt_documentos(id) ON DELETE SET NULL,
    data_validade DATE,
    data_sugerida DATE,
    datas_sugeridas JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_solicitada DATE,
    data_marcada DATE,
    status TEXT NOT NULL DEFAULT 'sugerido'
        CHECK (status IN ('sugerido', 'solicitado', 'aprovado', 'reprovado', 'cancelado', 'marcado')),
    escala_codigo_solicitada TEXT,
    conflito_on BOOLEAN NOT NULL DEFAULT false,
    observacoes TEXT,
    motivo_reprovacao TEXT,
    solicitado_por_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    solicitado_por_nome TEXT,
    solicitado_por_cpf TEXT,
    solicitado_em TIMESTAMPTZ,
    solicitado_ip TEXT,
    solicitacao_assinatura_url TEXT,
    solicitacao_hash TEXT,
    aprovado_por_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    aprovado_por_nome TEXT,
    aprovado_por_cpf TEXT,
    aprovado_em TIMESTAMPTZ,
    aprovado_ip TEXT,
    assinatura_url TEXT,
    assinatura_hash TEXT,
    assinaturas JSONB NOT NULL DEFAULT '[]'::jsonb,
    emails_enviados TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gt_aso_agendamentos_colaborador
    ON gt_aso_agendamentos (colaborador_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gt_aso_agendamentos_status
    ON gt_aso_agendamentos (status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gt_aso_agendamentos_data_solicitada
    ON gt_aso_agendamentos (data_solicitada)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_aso_agendamentos_aberto
    ON gt_aso_agendamentos (colaborador_id)
    WHERE deleted_at IS NULL AND status IN ('sugerido', 'solicitado');

CREATE TABLE IF NOT EXISTS gt_aso_agendamentos_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID NOT NULL REFERENCES gt_aso_agendamentos(id) ON DELETE CASCADE,
    acao TEXT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT,
    ator_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    ator_nome TEXT,
    ator_cpf TEXT,
    ip TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_aso_agendamentos_log_agendamento
    ON gt_aso_agendamentos_log (agendamento_id, created_at DESC);

ALTER TABLE gt_aso_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gt_aso_agendamentos_log ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_gt_aso_agendamentos_updated_at ON gt_aso_agendamentos;
CREATE TRIGGER trg_gt_aso_agendamentos_updated_at
    BEFORE UPDATE ON gt_aso_agendamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO gt_configuracoes (chave, valor, descricao, updated_at)
VALUES (
    'gt_aso_agendamento_config',
    '{
        "antecedencia_dias": 60,
        "min_lead_dias": 3,
        "max_sugestoes": 5,
        "emails_logistica": [],
        "emails_cc": [],
        "gerar_sugestoes_automatico": true
    }'::jsonb,
    'Antecedência (dias) de alerta/sugestão de ASO, e-mails da logística e geração automática de datas',
    now()
)
ON CONFLICT (chave) DO NOTHING;
