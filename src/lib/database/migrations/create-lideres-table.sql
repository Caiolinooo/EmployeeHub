-- Criar tabela para identificar líderes no sistema
CREATE TABLE IF NOT EXISTS lideres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  cargo_lideranca VARCHAR(100) NOT NULL, -- Ex: "Gerente", "Coordenador", "Supervisor"
  departamento VARCHAR(100),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE, -- NULL indica que ainda é líder
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que um usuário não tenha registros duplicados ativos
  UNIQUE(user_id, ativo) DEFERRABLE INITIALLY DEFERRED
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lideres_user_id ON lideres(user_id);
CREATE INDEX IF NOT EXISTS idx_lideres_ativo ON lideres(ativo);
CREATE INDEX IF NOT EXISTS idx_lideres_departamento ON lideres(departamento);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lideres_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lideres_updated_at
  BEFORE UPDATE ON lideres
  FOR EACH ROW
  EXECUTE FUNCTION update_lideres_updated_at();

-- RLS (Row Level Security)
ALTER TABLE lideres ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas seus próprios registros ou admins vejam todos
CREATE POLICY "Users can view their own leadership records" ON lideres
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

-- Política para permitir que apenas admins e gerentes insiram/atualizem registros
CREATE POLICY "Only admins and managers can modify leadership records" ON lideres
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gerente')
    )
  );

-- Comentários
COMMENT ON TABLE lideres IS 'Tabela para identificar usuários com funções de liderança no sistema';
COMMENT ON COLUMN lideres.user_id IS 'Referência ao usuário na tabela users_unified';
COMMENT ON COLUMN lideres.cargo_lideranca IS 'Cargo ou função de liderança do usuário';
COMMENT ON COLUMN lideres.data_inicio IS 'Data de início da função de liderança';
COMMENT ON COLUMN lideres.data_fim IS 'Data de fim da função de liderança (NULL se ainda ativo)';
COMMENT ON COLUMN lideres.ativo IS 'Indica se o registro de liderança está ativo';
