-- Script para marcar como verificados os usuários criados pelo admin
-- Data: 2025-11-07
-- Objetivo: Corrigir email_verified para usuários criados pelo admin através do painel

-- Usuários criados pelo admin têm no access_history a ação "CREATED" com details "Usuário criado por [Nome do Admin]"
-- Vamos marcar todos esses usuários como email_verified = true

UPDATE users_unified
SET
  email_verified = true,
  updated_at = NOW()
WHERE
  -- Usuários criados antes de 2025-11-07 23:00:00 UTC (data de corte)
  created_at < '2025-11-07 23:00:00+00'
  AND
  -- Que ainda não têm email verificado
  (email_verified = false OR email_verified IS NULL)
  AND
  -- Que foram criados por um admin (verificar pelo access_history)
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(access_history) AS history_item
    WHERE
      history_item->>'action' = 'CREATED'
      AND history_item->>'details' LIKE 'Usuário criado por%'
  );

-- Mostrar os usuários que foram atualizados
SELECT
  id,
  email,
  first_name,
  last_name,
  email_verified,
  created_at,
  (
    SELECT history_item->>'details'
    FROM jsonb_array_elements(access_history) AS history_item
    WHERE history_item->>'action' = 'CREATED'
    LIMIT 1
  ) as created_by
FROM users_unified
WHERE
  created_at < '2025-11-07 23:00:00+00'
  AND email_verified = true
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(access_history) AS history_item
    WHERE
      history_item->>'action' = 'CREATED'
      AND history_item->>'details' LIKE 'Usuário criado por%'
  )
ORDER BY created_at DESC;
