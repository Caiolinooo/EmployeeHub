-- Adiciona coluna para controlar a exibição do dia de início (d.X) na célula da escala
ALTER TABLE gt_historico_embarques 
ADD COLUMN IF NOT EXISTS exibir_dia_inicio boolean DEFAULT false;
