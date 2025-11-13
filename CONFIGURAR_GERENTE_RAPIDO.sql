-- ============================================
-- CONFIGURAÇÃO RÁPIDA DE GERENTE PARA TESTES
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- para configurar rapidamente um gerente e poder testar o sistema

-- 1️⃣ VERIFICAR USUÁRIOS DISPONÍVEIS
-- Rode primeiro para ver quais usuários você tem:
SELECT 
  id, 
  first_name, 
  last_name, 
  email, 
  role,
  position
FROM users_unified 
WHERE active = true 
  AND is_authorized = true
ORDER BY role DESC, first_name ASC;

-- 2️⃣ VERIFICAR MAPEAMENTOS ATUAIS
-- Veja quem já está configurado:
SELECT 
  acg.id,
  c.first_name || ' ' || c.last_name as colaborador_nome,
  c.email as colaborador_email,
  g.first_name || ' ' || g.last_name as gerente_nome,
  g.email as gerente_email,
  acg.ativo,
  acg.periodo_id
FROM avaliacao_colaborador_gerente acg
LEFT JOIN users_unified c ON c.id = acg.colaborador_id
LEFT JOIN users_unified g ON g.id = acg.gerente_id
WHERE acg.ativo = true;

-- 3️⃣ CRIAR MAPEAMENTO TEMPORÁRIO PARA TESTE
-- ⚠️ SUBSTITUA OS UUIDs ABAIXO COM OS IDs REAIS DOS USUÁRIOS
-- 
-- COLABORADOR: 75abe69b-15ac-4ac2-b973-1075c37252c5 (Você)
-- GERENTE: SUBSTITUA_PELO_UUID_DO_GERENTE (escolha um usuário da query #1)

INSERT INTO avaliacao_colaborador_gerente (
  colaborador_id,
  gerente_id,
  ativo,
  periodo_id
) VALUES (
  '75abe69b-15ac-4ac2-b973-1075c37252c5',  -- ← SEU ID (colaborador)
  'UUID_DO_GERENTE_AQUI',                   -- ← SUBSTITUA pelo UUID de outro usuário
  true,
  NULL  -- NULL = mapeamento global (vale para todos os períodos)
)
ON CONFLICT (colaborador_id, periodo_id) 
WHERE periodo_id IS NULL
DO UPDATE SET 
  gerente_id = EXCLUDED.gerente_id,
  ativo = true,
  updated_at = NOW();

-- 4️⃣ VERIFICAR SE DEU CERTO
SELECT 
  c.first_name || ' ' || c.last_name as colaborador,
  g.first_name || ' ' || g.last_name as gerente,
  acg.ativo,
  acg.created_at
FROM avaliacao_colaborador_gerente acg
JOIN users_unified c ON c.id = acg.colaborador_id
JOIN users_unified g ON g.id = acg.gerente_id
WHERE acg.colaborador_id = '75abe69b-15ac-4ac2-b973-1075c37252c5'
  AND acg.ativo = true;

-- ============================================
-- INSTRUÇÕES PASSO A PASSO:
-- ============================================
-- 
-- 1. Abra o Supabase Dashboard
-- 2. Vá em SQL Editor
-- 3. Execute a Query #1 para ver todos os usuários
-- 4. Copie o UUID de um usuário que será o gerente
-- 5. Cole o UUID no lugar de 'UUID_DO_GERENTE_AQUI' na Query #3
-- 6. Execute a Query #3 para criar o mapeamento
-- 7. Execute a Query #4 para confirmar
-- 
-- Depois disso, volte ao sistema e tente:
-- - Acessar /avaliacao
-- - Clicar em "Iniciar Minha Avaliação"
-- - Você NÃO deve mais ver o erro "Gerente não configurado"
-- 
-- ============================================
-- OPÇÃO ALTERNATIVA: CONFIGURAR PELA UI
-- ============================================
-- 
-- Agora que a página foi corrigida, você também pode:
-- 1. Ir em /admin/avaliacao/gerentes
-- 2. Procurar seu nome na lista
-- 3. Selecionar um gerente no dropdown
-- 4. Clicar em "Salvar Todas Alterações"
-- 
-- ============================================
