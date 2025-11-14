-- Criar tabela de notificações gerais do sistema
-- Esta tabela é separada de social_notifications (que é específica para redes sociais)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Comentário explicativo
COMMENT ON TABLE notifications IS 'Notificações gerais do sistema (avaliações, reembolsos, etc). Separada de social_notifications que é para redes sociais.';
COMMENT ON COLUMN notifications.type IS 'Tipo da notificação: avaliacao_criada, reembolso_aprovado, etc';
COMMENT ON COLUMN notifications.data IS 'Dados adicionais da notificação em formato JSON';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias notificações
CREATE POLICY notifications_select_own 
  ON notifications 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- Política: Usuários podem atualizar apenas suas próprias notificações (marcar como lida)
CREATE POLICY notifications_update_own 
  ON notifications 
  FOR UPDATE 
  USING (auth.uid()::text = user_id::text);

-- Política: Service role pode inserir notificações para qualquer usuário
CREATE POLICY notifications_insert_service 
  ON notifications 
  FOR INSERT 
  WITH CHECK (true);
