-- Migration: 20260903_000001_gt_matrizes_treinamento.sql
-- Description: Tabelas para Matrizes de Treinamento por Cargo e Requisitos de Treinamento

CREATE TABLE IF NOT EXISTS gt_matrizes_treinamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    centro_resultado VARCHAR(255),
    cliente VARCHAR(255),
    contrato VARCHAR(255),
    responsavel VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gt_matriz_treinamento_requisitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matriz_id UUID NOT NULL REFERENCES gt_matrizes_treinamento(id) ON DELETE CASCADE,
    cargo_id UUID REFERENCES gt_cargos(id) ON DELETE SET NULL,
    cargo_nome VARCHAR(255) NOT NULL,
    regime VARCHAR(50) NOT NULL DEFAULT 'Geral',
    treinamento_nome VARCHAR(255) NOT NULL,
    sigla VARCHAR(50),
    obrigatorio BOOLEAN NOT NULL DEFAULT true,
    validade_meses INTEGER,
    especialidade VARCHAR(100) DEFAULT 'ND',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_matriz_req_matriz_id ON gt_matriz_treinamento_requisitos(matriz_id);
CREATE INDEX IF NOT EXISTS idx_gt_matriz_req_cargo_nome ON gt_matriz_treinamento_requisitos(cargo_nome);
CREATE INDEX IF NOT EXISTS idx_gt_matriz_req_regime ON gt_matriz_treinamento_requisitos(regime);

ALTER TABLE gt_matrizes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE gt_matriz_treinamento_requisitos ENABLE ROW LEVEL SECURITY;
