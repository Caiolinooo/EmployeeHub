-- Create table gt_acidentes for CAT (S-2210)

CREATE TABLE IF NOT EXISTS gt_acidentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES gt_colaboradores(id) ON DELETE CASCADE,
    dt_acidente DATE NOT NULL,
    hr_acidente TEXT,
    tp_acidente TEXT CHECK (tp_acidente IN ('tipico', 'doenca', 'trajeto')),
    tp_cat TEXT CHECK (tp_cat IN ('inicial', 'reabertura', 'comunicacao_obito')),
    dt_obito DATE,
    hrs_trab_antes TEXT,
    tp_local TEXT,
    dsc_local TEXT,
    cod_sit_geradora TEXT,
    iniciat_cat TEXT,
    obs_cat TEXT,
    ult_dia_trab DATE,
    houve_afast BOOLEAN DEFAULT false,
    dt_ini_afast DATE,
    parte_atingida_cod TEXT,
    parte_atingida_lateralidade TEXT,
    agente_causador_cod TEXT,
    local_acidente JSONB,
    esocial_status TEXT CHECK (esocial_status IN ('nao_enviado', 'pendente', 'pendente_revisao', 'enviado', 'processado', 'erro', 'erro_validacao')),
    esocial_evento_id UUID,
    esocial_protocolo TEXT,
    esocial_numero_recibo TEXT,
    esocial_data_envio TIMESTAMPTZ,
    origem TEXT CHECK (origem IN ('manual', 'mio', 'importado')) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gt_acidentes_colaborador_id ON gt_acidentes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_gt_acidentes_esocial_status ON gt_acidentes(esocial_status);

ALTER TABLE gt_acidentes ENABLE ROW LEVEL SECURITY;
