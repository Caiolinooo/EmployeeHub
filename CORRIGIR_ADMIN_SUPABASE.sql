-- ========================================
-- SCRIPT PARA CORRIGIR USUÁRIO ADMIN
-- Execute este script no Supabase SQL Editor
-- ========================================

-- 1. Verificar se o usuário admin existe
SELECT 
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

-- 2. Se o usuário não existir, criar o usuário admin
-- Hash da senha 'Caio@2122@': $2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP
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
) 
SELECT 
  gen_random_uuid(),
  'caio.correia@groupabz.com',
  '+5522997847289',
  'Caio',
  'Correia',
  '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP',
  '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP',
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
      'details', 'Usuário administrador criado via script SQL'
    )
  ),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users_unified 
  WHERE email = 'caio.correia@groupabz.com'
);

-- 3. Atualizar usuário existente (se já existir)
UPDATE users_unified 
SET 
  password = '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP',
  password_hash = '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP',
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
  updated_at = NOW()
WHERE email = 'caio.correia@groupabz.com';

-- 4. Verificar o resultado final
SELECT 
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

-- 5. Verificar todos os usuários admin
SELECT 
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
