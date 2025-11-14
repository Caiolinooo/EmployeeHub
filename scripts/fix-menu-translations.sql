-- Script para corrigir traduções do menu
-- Execute este script no Supabase Dashboard (SQL Editor)

-- 1. Adicionar colunas de tradução se não existirem
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS title_pt TEXT,
ADD COLUMN IF NOT EXISTS title_en TEXT;

-- 2. Atualizar itens existentes com traduções
-- Dashboard
UPDATE menu_items 
SET title_pt = 'Painel', title_en = 'Dashboard'
WHERE id = 'dashboard';

-- Reembolso
UPDATE menu_items 
SET title_pt = 'Reembolso', title_en = 'Reimbursement'
WHERE id = 'reembolso';

-- Avaliação
UPDATE menu_items 
SET title_pt = 'Avaliação', title_en = 'Evaluation'
WHERE id = 'avaliacao';

-- Calendário
UPDATE menu_items 
SET title_pt = 'Calendário', title_en = 'Calendar'
WHERE id = 'calendario';

-- Contatos
UPDATE menu_items 
SET title_pt = 'Contatos', title_en = 'Contacts'
WHERE id = 'contatos';

-- Ponto
UPDATE menu_items 
SET title_pt = 'Ponto', title_en = 'Time Clock'
WHERE id = 'ponto';

-- Contracheque
UPDATE menu_items 
SET title_pt = 'Contracheque', title_en = 'Payslip'
WHERE id = 'contracheque';

-- Academy
UPDATE menu_items 
SET title_pt = 'Academy', title_en = 'Academy'
WHERE id = 'academy';

-- Notícias
UPDATE menu_items 
SET title_pt = 'Notícias', title_en = 'News'
WHERE id = 'noticias';

-- 3. Verificar resultado
SELECT id, label, title_pt, title_en, enabled, "order"
FROM menu_items
ORDER BY "order";

-- 4. Verificar e remover cards duplicados (se existirem)
-- Primeiro, verificar se há duplicados
SELECT id, title, COUNT(*) as count
FROM "Card"
GROUP BY id, title
HAVING COUNT(*) > 1;

-- Se houver duplicados, remover mantendo apenas o primeiro
DELETE FROM "Card" 
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM "Card"
  GROUP BY id
);

-- 5. Verificar cards finais
SELECT id, title, "titleEn", enabled, "order"
FROM "Card"
WHERE enabled = true
ORDER BY "order";

