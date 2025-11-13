-- Script para verificar e corrigir role do usuário
-- Execute este script no Supabase SQL Editor

-- 1. Verificar usuários atuais e suas roles
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  active
FROM users_unified
ORDER BY created_at DESC;

-- 2. Atualizar seu usuário para ADMIN (substitua o email pelo seu)
UPDATE users_unified
SET 
  role = 'ADMIN',
  updated_at = NOW()
WHERE email = 'seu-email@exemplo.com';  -- SUBSTITUA PELO SEU EMAIL

-- 3. Verificar se a atualização funcionou
SELECT 
  id,
  email,
  first_name,
  last_name,
  role
FROM users_unified
WHERE email = 'seu-email@exemplo.com';  -- SUBSTITUA PELO SEU EMAIL

-- 4. Listar todos os usuários que podem ser gerentes (ADMIN ou MANAGER)
SELECT 
  id,
  email,
  first_name || ' ' || last_name as nome_completo,
  role,
  position,
  department
FROM users_unified
WHERE role IN ('ADMIN', 'MANAGER')
  AND active = true
ORDER BY first_name;
