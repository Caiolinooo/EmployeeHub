-- Create table gt_afastamentos

CREATE TABLE IF NOT EXISTS gt_afastamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES gt_colaboradores(id) ON DELETE CASCADE,
    tipo_afastamento TEXT NOT NULL CHECK (tipo_afastamento IN ('doenca', 'acidente_trabalho', 'licenca_maternidade', 'licenca_paternidade', 'ferias', 'licenca_medica', 'servico_militar', 'mandato_sindical', 'outro')),
    cod_mot_afast TEXT,
    motivo TEXT,
    cid TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    data_prevista_retorno DATE,
    esocial_status TEXT CHECK (esocial_status IN ('nao_enviado', 'pendente', 'pendente_revisao', 'enviado', 'processado', 'erro', 'erro_validacao')),
    esocial_evento_id UUID,
    esocial_protocolo TEXT,
    esocial_numero_recibo TEXT,
    esocial_data_envio TIMESTAMPTZ,
    origem TEXT CHECK (origem IN ('manual', 'mio', 'importado')) DEFAULT 'manual',
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gt_afastamentos_colaborador_id ON gt_afastamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_gt_afastamentos_esocial_status ON gt_afastamentos(esocial_status);

ALTER TABLE gt_afastamentos ENABLE ROW LEVEL SECURITY;
