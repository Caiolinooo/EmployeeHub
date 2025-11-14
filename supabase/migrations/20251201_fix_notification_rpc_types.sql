-- Corrigir tipos de dados na função create_notification_bypass_rls
-- Problema: tipos declarados no RETURNS TABLE não correspondem aos tipos reais da tabela

DROP FUNCTION IF EXISTS create_notification_bypass_rls;

CREATE OR REPLACE FUNCTION create_notification_bypass_rls(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type VARCHAR,
  title VARCHAR,
  message TEXT,
  data JSONB,
  action_url VARCHAR,
  priority VARCHAR,
  read BOOLEAN,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    action_url,
    priority,
    read,
    expires_at,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    COALESCE(p_data, '{}'::jsonb),
    p_action_url,
    p_priority,
    false,
    COALESCE(p_expires_at, NOW() + INTERVAL '30 days'),
    NOW()
  )
  RETURNING 
    notifications.id,
    notifications.user_id,
    notifications.type,
    notifications.title,
    notifications.message,
    notifications.data,
    notifications.action_url,
    notifications.priority,
    notifications.read,
    notifications.expires_at,
    notifications.created_at;
END;
$$;

COMMENT ON FUNCTION create_notification_bypass_rls IS 
'Função para criar notificações com bypass de RLS. Tipos corrigidos para corresponder à tabela.';
