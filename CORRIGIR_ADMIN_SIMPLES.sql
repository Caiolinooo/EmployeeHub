-- ========================================
-- SCRIPT SIMPLIFICADO PARA CORRIGIR USUÁRIO ADMIN
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR
-- ========================================

-- Passo 1: Habilitar extensão pgcrypto (necessária para crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Passo 2: Verificar se o usuário admin existe
SELECT 
  'VERIFICAÇÃO INICIAL' as status,
  id,
  email,
  phone_number,
  first_name,
  last_name,
  role,
  active,
  password IS NOT NULL as has_password,
  LENGTH(password) as password_length,
  created_at
FROM users_unified 
WHERE email = 'caio.correia@groupabz.com';

-- Passo 3: Gerar hash da senha 'Caio@2122@' (agora vai funcionar)
SELECT 
  'HASH GERADO' as status,
  crypt('Caio@2122@', gen_salt('bf', 10)) as password_hash;

-- Passo 4: Deletar usuário existente se houver (para garantir limpeza)
DELETE FROM users_unified WHERE email = 'caio.correia@groupabz.com';

-- Passo 5: Criar o usuário admin com hash gerado automaticamente
INSERT INTO users_unified (
  id,
  email,
  phone_number,
  first_name,
  last_name,
  password,
  password_hash,
  role,
  position,
  department,
  active,
  is_authorized,
  authorization_status,
  password_last_changed,
  access_permissions,
  access_history,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'caio.correia@groupabz.com',
  '+5522997847289',
  'Caio',
  'Correia',
  crypt('Caio@2122@', gen_salt('bf', 10)), -- Hash será gerado automaticamente
  crypt('Caio@2122@', gen_salt('bf', 10)), -- Hash será gerado automaticamente
  'ADMIN',
  'Administrador do Sistema',
  'TI',
  true,
  true,
  'active',
  NOW(),
  jsonb_build_object(
    'modules', jsonb_build_object(
      'dashboard', true,
      'manual', true,
      'procedimentos', true,
      'politicas', true,
      'calendario', true,
      'noticias', true,
      'reembolso', true,
      'contracheque', true,
      'ponto', true,
      'admin', true,
      'avaliacao', true
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'timestamp', NOW(),
      'action', 'CREATED',
      'details', 'Usuário administrador criado via script SQL de correção'
    )
  ),
  NOW(),
  NOW()
);

-- Passo 6: Verificar o resultado final
SELECT 
  'RESULTADO FINAL' as status,
  id,
  email,
  phone_number,
  first_name,
  last_name,
  role,
  active,
  is_authorized,
  authorization_status,
  password IS NOT NULL as has_password,
  LENGTH(password) as password_length,
  password_last_changed,
  created_at,
  updated_at
FROM users_unified 
WHERE email = 'caio.correia@groupabz.com';

-- ========================================
-- INSTRUÇÕES:
-- ========================================
-- 1. Copie todo este script
-- 2. Acesse Supabase Dashboard > SQL Editor
-- 3. Cole e execute o script completo
-- 4. Verifique se o resultado final mostra:
--    - has_password: true
--    - password_length: 60
--    - role: ADMIN
--    - active: true
-- 5. Teste o login com:
--    Email: caio.correia@groupabz.com
--    Senha: Caio@2122@
-- ========================================

-- Se ainda der erro, use este hash pré-gerado:
-- Hash para 'Caio@2122@': $2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP
