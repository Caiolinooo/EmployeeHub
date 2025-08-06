-- ========================================
-- SCRIPT PARA CORRIGIR USUÁRIO ADMIN
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR
-- ========================================

-- Passo 1: Verificar se o usuário admin existe
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

-- Passo 2: Gerar hash da senha 'Caio@2122@'
SELECT 
  'HASH GERADO' as status,
  crypt('Caio@2122@', gen_salt('bf', 10)) as password_hash;

-- Passo 3: Criar ou atualizar o usuário admin
-- IMPORTANTE: Copie o hash gerado acima e substitua na linha abaixo
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
)
ON CONFLICT (email) DO UPDATE SET
  password = crypt('Caio@2122@', gen_salt('bf', 10)),
  password_hash = crypt('Caio@2122@', gen_salt('bf', 10)),
  role = 'ADMIN',
  active = true,
  is_authorized = true,
  authorization_status = 'active',
  password_last_changed = NOW(),
  access_permissions = jsonb_build_object(
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
  updated_at = NOW();

-- Passo 4: Verificar o resultado final
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

-- Passo 5: Verificar todos os usuários admin
SELECT 
  'TODOS OS ADMINS' as status,
  email,
  phone_number,
  first_name,
  last_name,
  role,
  active,
  password IS NOT NULL as has_password
FROM users_unified 
WHERE role = 'ADMIN'
ORDER BY created_at;

-- ========================================
-- INSTRUÇÕES:
-- ========================================
-- 1. Copie todo este script
-- 2. Acesse Supabase Dashboard > SQL Editor
-- 3. Cole e execute o script
-- 4. Verifique se o resultado final mostra:
--    - has_password: true
--    - password_length: 60
--    - role: ADMIN
--    - active: true
-- 5. Teste o login com:
--    Email: caio.correia@groupabz.com
--    Senha: Caio@2122@
-- ========================================
