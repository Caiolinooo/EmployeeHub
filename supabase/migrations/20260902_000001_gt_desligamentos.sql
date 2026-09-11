-- Gestão de Tripulantes / DP: processo auditável de desligamento (rescisão).
-- Runtime reads/writes only via supabaseAdmin (service_role).
-- ENABLE RLS with no anon/authenticated policies (same as gt_aso_agendamentos).
-- Do not add USING (true) policies.
--
-- payroll_sheet_id is a loose reference (no FK): payroll_* tables live in
-- scripts/create-payroll-tables.sql, not in this migration chain.

CREATE TABLE IF NOT EXISTS gt_desligamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES gt_colaboradores(id) ON DELETE CASCADE,
    tipo_rescisao TEXT NOT NULL
        CHECK (tipo_rescisao IN (
            'sem_justa_causa',
            'pedido_demissao',
            'justa_causa',
            'acordo_mutuo',
            'termino_contrato',
            'rescisao_indireta'
        )),
    data_desligamento DATE NOT NULL,
    motivo TEXT,
    mtv_deslig TEXT NOT NULL,
    aviso_previo_tipo TEXT NOT NULL
        CHECK (aviso_previo_tipo IN ('indenizado', 'trabalhado', 'dispensado', 'nao_aplicavel')),
    aviso_previo_dias INTEGER,
    data_ultimo_dia_trabalhado DATE,
    prazo_pagamento DATE,
    status TEXT NOT NULL DEFAULT 'iniciado'
        CHECK (status IN ('iniciado', 'calculado', 'aprovado', 'pago', 'cancelado')),
    payroll_sheet_id UUID,
    verbas_previstas JSONB NOT NULL DEFAULT '[]'::jsonb,
    observacoes TEXT,
    criado_por UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_desligamentos_colaborador
    ON gt_desligamentos (colaborador_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_desligamentos_aberto
    ON gt_desligamentos (colaborador_id)
    WHERE status <> 'cancelado';

COMMENT ON TABLE gt_desligamentos IS
    'Processo de desligamento/rescisão do colaborador GT. payroll_sheet_id é referência solta (sem FK) para payroll_sheets.';
COMMENT ON COLUMN gt_desligamentos.mtv_deslig IS
    'Código e-Social Tabela 19 (S-2299 infoDeslig.mtvDeslig), gravado também em gt_colaboradores.motivo_demissao.';
COMMENT ON COLUMN gt_desligamentos.payroll_sheet_id IS
    'UUID de payroll_sheets quando a integração best-effort com a folha funcionar. Sem FK rígida.';
COMMENT ON COLUMN gt_desligamentos.prazo_pagamento IS
    'Lei 13.467/2017: 10 dias corridos a partir do término do contrato.';

ALTER TABLE gt_desligamentos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_gt_desligamentos_updated_at ON gt_desligamentos;
CREATE TRIGGER trg_gt_desligamentos_updated_at
    BEFORE UPDATE ON gt_desligamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
