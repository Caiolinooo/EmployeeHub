-- Adicionar coluna para comentário final do funcionário após aprovação do gerente
-- Novo fluxo: Gerente aprova → Funcionário comenta → Gerente finaliza

ALTER TABLE avaliacoes_desempenho 
ADD COLUMN IF NOT EXISTS comentario_final_funcionario TEXT;

COMMENT ON COLUMN avaliacoes_desempenho.comentario_final_funcionario IS 
'Comentário final do funcionário após o gerente aprovar a avaliação, antes da finalização definitiva';
