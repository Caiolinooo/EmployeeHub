-- Criar tabela para períodos de avaliação
CREATE TABLE IF NOT EXISTS periodos_avaliacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL, -- Ex: "Avaliação Anual 2024"
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_limite_autoavaliacao DATE NOT NULL,
  data_limite_aprovacao DATE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que não há sobreposição de períodos ativos
  CONSTRAINT check_data_fim_maior_inicio CHECK (data_fim > data_inicio),
  CONSTRAINT check_limite_autoavaliacao CHECK (data_limite_autoavaliacao >= data_inicio AND data_limite_autoavaliacao <= data_fim),
  CONSTRAINT check_limite_aprovacao CHECK (data_limite_aprovacao >= data_limite_autoavaliacao AND data_limite_aprovacao <= data_fim)
);

-- Atualizar tabela de avaliações para o novo workflow
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS periodo_avaliacao_id UUID REFERENCES periodos_avaliacao(id);
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS etapa_atual VARCHAR(50) DEFAULT 'autoavaliacao' 
  CHECK (etapa_atual IN ('autoavaliacao', 'aguardando_gerente', 'em_aprovacao', 'finalizada', 'cancelada'));
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS data_autoavaliacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS data_envio_gerente TIMESTAMP WITH TIME ZONE;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_gerente TEXT;
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS aprovada_por UUID REFERENCES users_unified(id);

-- Criar tabela para autoavaliações (questões 11-14 da planilha)
CREATE TABLE IF NOT EXISTS autoavaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES users_unified(id),
  
  -- Questões de autoavaliação baseadas na planilha
  questao_11_pontos_fortes TEXT, -- "Quais são seus principais pontos fortes?"
  questao_12_areas_melhoria TEXT, -- "Quais áreas você identifica para melhoria?"
  questao_13_objetivos_alcancados TEXT, -- "Quais objetivos você alcançou no período?"
  questao_14_planos_desenvolvimento TEXT, -- "Quais são seus planos de desenvolvimento?"
  
  -- Autoavaliação dos critérios
  autoavaliacao_criterios JSONB, -- Armazena as notas que o funcionário se deu
  
  data_preenchimento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(avaliacao_id) -- Uma autoavaliação por avaliação
);

-- Criar tabela para histórico de workflow
CREATE TABLE IF NOT EXISTS historico_avaliacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  etapa_anterior VARCHAR(50),
  etapa_nova VARCHAR(50) NOT NULL,
  usuario_id UUID NOT NULL REFERENCES users_unified(id),
  comentario TEXT,
  data_mudanca TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados adicionais em JSON para flexibilidade
  dados_adicionais JSONB
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_ativo ON periodos_avaliacao(ativo);
CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_datas ON periodos_avaliacao(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_periodo ON avaliacoes(periodo_avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_etapa ON avaliacoes(etapa_atual);
CREATE INDEX IF NOT EXISTS idx_autoavaliacoes_funcionario ON autoavaliacoes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_historico_avaliacao_id ON historico_avaliacao(avaliacao_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_periodos_avaliacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_periodos_avaliacao_updated_at
  BEFORE UPDATE ON periodos_avaliacao
  FOR EACH ROW
  EXECUTE FUNCTION update_periodos_avaliacao_updated_at();

CREATE OR REPLACE FUNCTION update_autoavaliacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_autoavaliacoes_updated_at
  BEFORE UPDATE ON autoavaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_autoavaliacoes_updated_at();

-- RLS (Row Level Security)
ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoavaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_avaliacao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para períodos_avaliacao
CREATE POLICY "Everyone can view active evaluation periods" ON periodos_avaliacao
  FOR SELECT USING (ativo = true);

CREATE POLICY "Only admins can modify evaluation periods" ON periodos_avaliacao
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

-- Políticas RLS para autoavaliacoes
CREATE POLICY "Users can view their own self-evaluations" ON autoavaliacoes
  FOR SELECT USING (
    funcionario_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Users can modify their own self-evaluations" ON autoavaliacoes
  FOR ALL USING (funcionario_id = auth.uid());

-- Políticas RLS para historico_avaliacao
CREATE POLICY "Users can view evaluation history" ON historico_avaliacao
  FOR SELECT USING (
    usuario_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM avaliacoes a 
      WHERE a.id = avaliacao_id 
      AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

-- Comentários
COMMENT ON TABLE periodos_avaliacao IS 'Períodos de avaliação configurados pelo admin';
COMMENT ON TABLE autoavaliacoes IS 'Autoavaliações preenchidas pelos funcionários (questões 11-14)';
COMMENT ON TABLE historico_avaliacao IS 'Histórico de mudanças no workflow de avaliação';
