-- Script SQL para verificar e corrigir o usuário administrador
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se a tabela users_unified existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'users_unified'
);

-- 2. Verificar se o usuário admin existe
SELECT 
  id,
  email,
  phone_number,
  first_name,
  last_name,
  role,
  active,
  password IS NOT NULL as has_password,
  password_last_changed,
  created_at
FROM users_unified 
WHERE email = 'caio.correia@groupabz.com' 
   OR phone_number = '+5522997847289';

-- 3. Se o usuário não existir, criar o usuário admin
-- IMPORTANTE: Substitua 'HASH_DA_SENHA_AQUI' pelo hash bcrypt real da senha 'Caio@2122@'
-- Use: const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Caio@2122@', 10));

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
  '$2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- SUBSTITUA PELO HASH REAL
  '$2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- SUBSTITUA PELO HASH REAL
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
     OR phone_number = '+5522997847289'
);

-- 4. Se o usuário existir mas não tiver senha, atualizar a senha
UPDATE users_unified 
SET 
  password = '$2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- SUBSTITUA PELO HASH REAL
  password_hash = '$2a$10$rQJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP7QJ5qP', -- SUBSTITUA PELO HASH REAL
  password_last_changed = NOW(),
  updated_at = NOW()
WHERE (email = 'caio.correia@groupabz.com' OR phone_number = '+5522997847289')
  AND password IS NULL;

-- 5. Garantir que o usuário admin tenha role ADMIN e esteja ativo
UPDATE users_unified 
SET 
  role = 'ADMIN',
  active = true,
  is_authorized = true,
  authorization_status = 'active',
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
WHERE (email = 'caio.correia@groupabz.com' OR phone_number = '+5522997847289');

-- 6. Verificar o resultado final
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
  access_permissions,
  created_at,
  updated_at
FROM users_unified 
WHERE email = 'caio.correia@groupabz.com' 
   OR phone_number = '+5522997847289';

-- 7. Verificar se há outros usuários admin
SELECT 
  id,
  email,
  phone_number,
  first_name,
  last_name,
  role,
  active
FROM users_unified 
WHERE role = 'ADMIN';

-- INSTRUÇÕES PARA GERAR O HASH DA SENHA:
-- 
-- 1. Abra um terminal Node.js ou crie um arquivo .js temporário
-- 2. Execute o seguinte código:
--
-- const bcrypt = require('bcryptjs');
-- const password = 'Caio@2122@';
-- const hash = bcrypt.hashSync(password, 10);
-- console.log('Hash da senha:', hash);
--
-- 3. Copie o hash gerado e substitua nos campos password e password_hash acima
-- 4. Execute este script SQL no Supabase
--
-- EXEMPLO DE HASH (NÃO USE ESTE, GERE O SEU PRÓPRIO):
-- $2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUV
