-- Corrigir tabela notifications adicionando colunas faltantes
-- Problema: coluna 'read' e outras colunas necessárias não existem na tabela

-- Adicionar coluna 'read' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT FALSE NOT NULL;
    COMMENT ON COLUMN notifications.read IS 'Indica se a notificação foi lida pelo usuário';
  END IF;
END $$;

-- Adicionar coluna 'action_url' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'action_url'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
    COMMENT ON COLUMN notifications.action_url IS 'URL de ação para a notificação';
  END IF;
END $$;

-- Adicionar coluna 'priority' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'normal' NOT NULL;
    COMMENT ON COLUMN notifications.priority IS 'Prioridade da notificação: low, normal, high, urgent';
  END IF;
END $$;

-- Adicionar coluna 'expires_at' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN notifications.expires_at IS 'Data de expiração da notificação';
  END IF;
END $$;

-- Criar índice para coluna 'read' se não existir
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;

-- Criar índice para coluna 'priority' se não existir
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- Criar índice para coluna 'expires_at' se não existir
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Comentário explicativo
COMMENT ON TABLE notifications IS 'Notificações gerais do sistema com todas as colunas necessárias para funcionamento completo';
