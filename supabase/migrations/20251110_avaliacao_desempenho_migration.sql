-- Migration para o módulo de avaliação de desempenho
-- Data: 2025-11-10
-- Descrição: Adiciona campos e tabelas necessárias para o sistema de avaliação

-- 1. Adicionar colunas em funcionarios
ALTER TABLE funcionarios
ADD COLUMN IF NOT EXISTS is_gerente_avaliacao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_lider BOOLEAN DEFAULT FALSE;

-- 2. Criar tabela periodos_avaliacao
CREATE TABLE IF NOT EXISTS periodos_avaliacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_limite_autoavaliacao DATE NOT NULL,
  data_limite_aprovacao DATE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Adicionar colunas em avaliacoes_desempenho
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS comentario_avaliador TEXT,
ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS data_autoavaliacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES users(id);

-- 4. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_funcionarios_is_gerente ON funcionarios(is_gerente_avaliacao) WHERE is_gerente_avaliacao = TRUE;
CREATE INDEX IF NOT EXISTS idx_funcionarios_is_lider ON funcionarios(is_lider) WHERE is_lider = TRUE;
CREATE INDEX IF NOT EXISTS idx_periodos_ativo ON periodos_avaliacao(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_avaliacoes_status_aprovacao ON avaliacoes_desempenho(status_aprovacao);

-- 5. Criar função e trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_periodos_avaliacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_periodos_avaliacao_updated_at ON periodos_avaliacao;

CREATE TRIGGER trigger_update_periodos_avaliacao_updated_at
  BEFORE UPDATE ON periodos_avaliacao
  FOR EACH ROW
  EXECUTE FUNCTION update_periodos_avaliacao_updated_at();

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS para periodos_avaliacao
DROP POLICY IF EXISTS "Todos podem ver períodos ativos" ON periodos_avaliacao;

CREATE POLICY "Todos podem ver períodos ativos"
  ON periodos_avaliacao FOR SELECT
  USING (ativo = TRUE OR auth.uid() IN (SELECT id FROM users_unified WHERE role = 'ADMIN'));

DROP POLICY IF EXISTS "Apenas admins podem gerenciar períodos" ON periodos_avaliacao;

CREATE POLICY "Apenas admins podem gerenciar períodos"
  ON periodos_avaliacao FOR ALL
  USING (auth.uid() IN (SELECT id FROM users_unified WHERE role = 'ADMIN'));

-- Comentários para documentação
COMMENT ON TABLE periodos_avaliacao IS 'Tabela de períodos de avaliação de desempenho';
COMMENT ON COLUMN funcionarios.is_gerente_avaliacao IS 'Indica se o funcionário é gerente de avaliação';
COMMENT ON COLUMN funcionarios.is_lider IS 'Indica se o funcionário é líder de equipe';
COMMENT ON COLUMN avaliacoes_desempenho.comentario_avaliador IS 'Comentário do avaliador (Q15)';
COMMENT ON COLUMN avaliacoes_desempenho.status_aprovacao IS 'Status do workflow de aprovação: pendente, aprovado, rejeitado';
