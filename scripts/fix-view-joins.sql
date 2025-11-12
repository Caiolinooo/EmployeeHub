-- Fix critical view definition issue by adding proper JOINs with user tables
-- This script updates the vw_avaliacoes_desempenho view to include JOINs with
-- users_unified and periodos_avaliacao tables to provide all user information
-- fields that the API expects

-- Drop the existing view first
DROP VIEW IF EXISTS vw_avaliacoes_desempenho;

-- Create the view with proper JOINs
CREATE VIEW vw_avaliacoes_desempenho AS
SELECT 
  ad.id,
  ad.funcionario_id,
  ad.avaliador_id,
  ad.periodo,
  ad.periodo_id,
  ad.data_inicio,
  ad.data_fim,
  ad.status,
  ad.pontuacao_total,
  ad.observacoes,
  ad.comentario_avaliador,
  ad.status_aprovacao,
  ad.data_autoavaliacao,
  ad.data_aprovacao,
  ad.aprovado_por,
  ad.created_at,
  ad.updated_at,
  ad.deleted_at,
  ad.dados_colaborador,
  ad.dados_gerente,
  -- User information fields for employee
  uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
  uu_func.position AS funcionario_cargo,
  uu_func.department AS funcionario_departamento,
  -- User information fields for evaluator
  uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
  uu_aval.position AS avaliador_cargo,
  -- Period information
  pa.nome AS periodo_nome,
  pa.data_inicio AS periodo_data_inicio,
  pa.data_fim AS periodo_data_fim
FROM 
  avaliacoes_desempenho ad
LEFT JOIN 
  users_unified uu_func ON ad.funcionario_id = uu_func.id
LEFT JOIN 
  users_unified uu_aval ON ad.avaliador_id = uu_aval.id
LEFT JOIN 
  periodos_avaliacao pa ON ad.periodo_id = pa.id
WHERE 
  ad.deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON VIEW vw_avaliacoes_desempenho IS 'View de avaliações de desempenho com JOINs para tabelas de usuários e períodos';