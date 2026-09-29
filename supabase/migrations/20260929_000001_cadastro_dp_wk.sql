-- Cadastro DP alinhado ao WK: telefone 2, RNM/RNE, departamento (não é centro de custo).

ALTER TABLE gt_colaboradores
  ADD COLUMN IF NOT EXISTS telefone_2 TEXT,
  ADD COLUMN IF NOT EXISTS rnm_rne TEXT,
  ADD COLUMN IF NOT EXISTS rnm_rne_emissao DATE,
  ADD COLUMN IF NOT EXISTS rnm_rne_validade DATE,
  ADD COLUMN IF NOT EXISTS departamento_id UUID;

CREATE TABLE IF NOT EXISTS gt_departamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO gt_departamentos (codigo, nome)
VALUES ('01', 'ABZ SERVIÇOS- ADMINISTRATIVO')
ON CONFLICT (codigo) DO NOTHING;

-- Centro de custo do print WK (código 01). Não substitui os centros operacionais já usados pela logística.
INSERT INTO gt_centros_custo (codigo, nome, ativo)
VALUES ('01', 'AGUAS BRASILEIRAS SERVICOS E CONSULTORIAS EM ATIVIDADES MARITIMAS LTDA', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO gt_cargos (nome, descricao, nivel, ordem_exibicao, ativo)
SELECT 'AUXILIAR DE SERVIÇOS GERAIS', 'Cargo WK 176', 1, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM gt_cargos
  WHERE upper(trim(nome)) = 'AUXILIAR DE SERVIÇOS GERAIS'
);

ALTER TABLE gt_colaboradores
  DROP CONSTRAINT IF EXISTS gt_colaboradores_departamento_id_fkey;

ALTER TABLE gt_colaboradores
  ADD CONSTRAINT gt_colaboradores_departamento_id_fkey
  FOREIGN KEY (departamento_id) REFERENCES gt_departamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gt_colab_departamento ON gt_colaboradores(departamento_id);
