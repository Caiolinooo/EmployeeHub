-- Script SQL para criar tabela de configurações e ativar bypass de aprovação
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela settings se não existir
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- 3. Inserir ou atualizar configuração de bypass de aprovação
INSERT INTO settings (key, value, description) 
VALUES (
  'user_approval_settings',
  '{"bypassApproval": true, "autoActivateOnEmailVerification": true}',
  'Configurações de aprovação de usuários - Bypass ativado para aprovação automática'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. Verificar se a configuração foi criada corretamente
SELECT 
  key,
  value,
  description,
  created_at,
  updated_at
FROM settings 
WHERE key = 'user_approval_settings';

-- 5. Ativar usuários pendentes (opcional - descomente se quiser ativar usuários existentes)
/*
UPDATE users_unified 
SET 
  active = true,
  is_authorized = true,
  authorization_status = 'active',
  updated_at = NOW()
WHERE 
  authorization_status = 'pending' 
  AND active = false;
*/

-- 6. Verificar configuração final
SELECT 
  'Bypass de aprovação configurado com sucesso!' as status,
  (value->>'bypassApproval')::boolean as bypass_approval,
  (value->>'autoActivateOnEmailVerification')::boolean as auto_activate
FROM settings 
WHERE key = 'user_approval_settings';
