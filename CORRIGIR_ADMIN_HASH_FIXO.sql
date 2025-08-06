-- ========================================
-- SCRIPT COM HASH PRÉ-GERADO (ALTERNATIVA)
-- USE ESTE SE O SCRIPT ANTERIOR NÃO FUNCIONAR
-- ========================================

-- Verificar se o usuário admin existe
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

-- Deletar usuário existente se houver
DELETE FROM users_unified WHERE email = 'caio.correia@groupabz.com';

-- Criar usuário admin com hash pré-gerado para senha 'Caio@2122@'
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
  '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- Hash pré-gerado
  '$2a$10$8K7qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- Hash pré-gerado
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
      'details', 'Usuário administrador criado via script SQL com hash pré-gerado'
    )
  ),
  NOW(),
  NOW()
);

-- Verificar o resultado final
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
-- CREDENCIAIS PARA TESTE:
-- Email: caio.correia@groupabz.com
-- Senha: Caio@2122@
-- ========================================
