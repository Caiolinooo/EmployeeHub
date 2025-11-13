-- ============================================
-- Setup VAPID Keys for Push Notifications
-- ============================================

-- Verificar se a tabela app_secrets existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_secrets') THEN
        CREATE TABLE app_secrets (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            is_encrypted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Tabela app_secrets criada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela app_secrets já existe.';
    END IF;
END
$$;

-- Inserir chaves VAPID geradas
INSERT INTO app_secrets (key, value, description, is_encrypted) VALUES
('VAPID_PUBLIC_KEY', 'BCPzcJmoggpOBd_UPIYMhK2u482VOlEldXdr-ShQHA9fTQvtm4yPT9TU-DdTcmujBL-8BwWHTpxS2BQihUgZzdo', 'Chave pública VAPID para push notifications', FALSE),
('VAPID_PRIVATE_KEY', 'OCPM8yhePNB838yd_vYdD0h8KILhM0P7489OWXSlqfY', 'Chave privada VAPID para push notifications', FALSE),
('VAPID_SUBJECT', 'mailto:apiabzgroup@gmail.com', 'Subject VAPID para push notifications', FALSE)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Verificar se as chaves foram inseridas
SELECT 
    key,
    CASE 
        WHEN key = 'VAPID_PRIVATE_KEY' THEN '***HIDDEN***'
        ELSE LEFT(value, 50) || '...'
    END as value_preview,
    description,
    created_at
FROM app_secrets 
WHERE key LIKE 'VAPID_%'
ORDER BY key;

-- Mostrar status
SELECT 
    COUNT(*) as total_vapid_keys,
    CASE 
        WHEN COUNT(*) = 3 THEN '✅ Push Notifications ATIVADO'
        ELSE '❌ Configuração incompleta'
    END as status
FROM app_secrets 
WHERE key LIKE 'VAPID_%';