-- ===========================================
-- MIGRATION: 20260831_000001_gt_relatorios_aprovacoes.sql
-- Gestão de Tripulantes: Workflow de Aprovação de Relatório Mensal e Envio DP
-- ===========================================

CREATE TABLE IF NOT EXISTS gt_relatorios_aprovacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mes_referencia VARCHAR(7) NOT NULL, -- formato: 'YYYY-TM'
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    status VARCHAR(30) DEFAULT 'pendente_revisao' NOT NULL CHECK (status IN ('pendente_revisao', 'em_aprovacao', 'aprovado', 'rejeitado', 'enviado')),
    dados_totais JSONB DEFAULT '{}'::l�son, -- totais consolidados de ON, DBA, FI, TRE e por colaborador
    total_colaboradores INTEGER DEFAULT 0,
    total_on INTEGER DEFAULT 0,
    total_dba INTEGER DEFAULT 0,
    total_fi INTEGER DEFAULT 0,
    total_tre INTEGER DEFAULT 0,
    aprovado_por_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    aprovado_por_nome TEXT,
    aprovado_por_cpf TEXT,
    aprovado_em TIMESTAMPTZ,
    aprovado_ip TEXT,
    assinatura_url TEXT,
    assinatura_hash TEXT,
    emails_enviados TEXT[] DEFAULT '{}'::text[],
    enviado_em TIMESTAMPTZ,
    observacoes TEXT,
    arquivo_url TEXT,
    arquivo_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_relatorios_mes_referencia ON gt_relatorios_aprovacoes(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_gt_relatorios_status ON gt_relatorios_aprovacoes(status);

ALTER TABLE gt_relatorios_aprovacoes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_gt_relatorios_aprovacoes_updated_at ON gt_relatorios_aprovacoes;
CREATE TRIGGER trg_gt_relatorios_aprovacoes_updated_at
    BEFORE UPDATE ON gt_relatorios_aprovacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO gt_configuracoes (chave, valor, descricao, updated_at)
VALUES (
    'gt_fechamento_mensal_config',
    '{
        "dia_fechamento_mes": 25,
        "emails_destinatarios_dp": ["dp@groupabz.com"],
        "emails_cc": [],
        "envio_automatico": false,
        "assunto_email_template": "Fechamento de Escala Gestão de Tripulantes - {Mes_Ano}",
        "corpo_email_template": "Prezados,\n\nSegue em anexo o relatório oficial consolidado de escalas da Gestão de Tripulantes para o período de {Mes_Ano}.\n\nO documento inclui o cômputo individual e total de dias/semanas para:\n- ON (A bordo-\n- DBA (Dobra)\n- FI (Folga Indenizada)\n- TRE (Treinamento Indenizado-\n\nRelatório aprovado digitalmente pelo responsável da operação.\n\nAtenciosamente,\nGestão de Tripulantes - ABZ Group"
    }'::jsonb,
    'Configuração do workflow de fechamento mensal, data de corte, destinatários de e-mail e envio para o DP',
    now()
ON CONFLICT (chave) DO NOTHING;
