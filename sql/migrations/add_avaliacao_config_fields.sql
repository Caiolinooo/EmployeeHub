-- Migration: Adicionar campos de configuração de avaliação
-- Data: 2025-11-10
-- Descrição: Adiciona campos para gerentes de avaliação, líderes de setor e campo Q15

-- 1. Adicionar campos de configuração na tabela funcionarios
ALTER TABLE funcionarios
ADD COLUMN IF NOT EXISTS is_gerente_avaliacao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_lider BOOLEAN DEFAULT FALSE;

-- Comentários nas colunas
COMMENT ON COLUMN funcionarios.is_gerente_avaliacao IS 'Indica se o funcionário é gerente de avaliação (pode aprovar/revisar avaliações)';
COMMENT ON COLUMN funcionarios.is_lider IS 'Indica se o funcionário é líder de setor (deve responder questões de liderança)';

-- 2. Criar tabela de períodos de avaliação (se não existir)
CREATE TABLE IF NOT EXISTS periodos_avaliacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Comentários na tabela
COMMENT ON TABLE periodos_avaliacao IS 'Períodos anuais/semestrais de avaliação de desempenho';
COMMENT ON COLUMN periodos_avaliacao.nome IS 'Nome do período (ex: Avaliação Anual 2024)';
COMMENT ON COLUMN periodos_avaliacao.data_limite_autoavaliacao IS 'Data limite para colaboradores preencherem autoavaliação';
COMMENT ON COLUMN periodos_avaliacao.data_limite_aprovacao IS 'Data limite para gerentes aprovarem avaliações';
COMMENT ON COLUMN periodos_avaliacao.ativo IS 'Se o período está ativo (dispara notificações)';

-- 3. Adicionar campo Q15 (comentário do avaliador) na tabela de avaliações
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS comentario_avaliador TEXT;

COMMENT ON COLUMN avaliacoes_desempenho.comentario_avaliador IS 'Comentário final do gerente/avaliador (Questão 15)';

-- 4. Adicionar campos de workflow de aprovação
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS data_autoavaliacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES users(id);

COMMENT ON COLUMN avaliacoes_desempenho.status_aprovacao IS 'Status de aprovação: pendente, aprovada, recusada';
COMMENT ON COLUMN avaliacoes_desempenho.data_autoavaliacao IS 'Data em que o colaborador enviou a autoavaliação';
COMMENT ON COLUMN avaliacoes_desempenho.data_aprovacao IS 'Data em que o gerente aprovou/recusou';
COMMENT ON COLUMN avaliacoes_desempenho.aprovado_por IS 'ID do gerente que aprovou';

-- 5. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_funcionarios_is_gerente ON funcionarios(is_gerente_avaliacao) WHERE is_gerente_avaliacao = TRUE;
CREATE INDEX IF NOT EXISTS idx_funcionarios_is_lider ON funcionarios(is_lider) WHERE is_lider = TRUE;
CREATE INDEX IF NOT EXISTS idx_periodos_ativo ON periodos_avaliacao(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_avaliacoes_status_aprovacao ON avaliacoes_desempenho(status_aprovacao);

-- 6. Atualizar trigger de updated_at para periodos_avaliacao
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

-- 7. Adicionar políticas RLS para periodos_avaliacao
ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY;

-- Política de leitura: todos podem ver períodos ativos
CREATE POLICY "Todos podem ver períodos ativos"
  ON periodos_avaliacao FOR SELECT
  USING (ativo = TRUE OR auth.jwt() ->> 'user_role' = 'ADMIN');

-- Política de inserção/atualização: apenas admins
CREATE POLICY "Apenas admins podem gerenciar períodos"
  ON periodos_avaliacao FOR ALL
  USING (auth.jwt() ->> 'user_role' = 'ADMIN')
  WITH CHECK (auth.jwt() ->> 'user_role' = 'ADMIN');

-- 8. Atualizar políticas RLS de avaliações para incluir gerentes
DROP POLICY IF EXISTS "Gerentes podem gerenciar avaliações" ON avaliacoes_desempenho;
CREATE POLICY "Gerentes podem gerenciar avaliações"
  ON avaliacoes_desempenho FOR ALL
  USING (
    auth.jwt() ->> 'user_role' = 'ADMIN' OR
    auth.jwt() ->> 'user_role' = 'MANAGER' OR
    EXISTS (
      SELECT 1 FROM funcionarios
      WHERE funcionarios.user_id = auth.uid()
      AND funcionarios.is_gerente_avaliacao = TRUE
    )
  );

-- 9. Criar view para facilitar consultas de avaliações com informações completas
CREATE OR REPLACE VIEW vw_avaliacoes_completas AS
SELECT
  a.*,
  f.nome as funcionario_nome,
  f.cargo as funcionario_cargo,
  f.departamento as funcionario_departamento,
  f.is_lider as funcionario_is_lider,
  av.nome as avaliador_nome,
  fav.nome as aprovador_nome,
  p.nome as periodo_nome
FROM avaliacoes_desempenho a
LEFT JOIN funcionarios f ON a.funcionario_id = f.id
LEFT JOIN users u ON f.user_id = u.id
LEFT JOIN users uav ON a.avaliador_id = uav.id
LEFT JOIN funcionarios av ON uav.id = av.user_id
LEFT JOIN users uaprov ON a.aprovado_por = uaprov.id
LEFT JOIN funcionarios fav ON uaprov.id = fav.user_id
LEFT JOIN periodos_avaliacao p ON a.periodo = p.nome;

COMMENT ON VIEW vw_avaliacoes_completas IS 'View com informações completas das avaliações incluindo dados dos funcionários e gerentes';

-- Concluído
SELECT 'Migration concluída com sucesso!' as status;
