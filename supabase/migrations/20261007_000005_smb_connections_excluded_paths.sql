-- Fase 4 — Lista de exclusão de caminhos por conexão SMB
-- Caminhos relativos ao local_path da conexão (prefix match, case-insensitive),
-- usados pelo dp-import para podar ramos restritos (ex.: bases cujos documentos
-- não devem entrar no portal). Ex.: ["5. DP/ABZ Serviços/3 - Funcionários/ABZ - Base X"]

ALTER TABLE public.smb_connections
ADD COLUMN IF NOT EXISTS excluded_paths JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.smb_connections.excluded_paths IS
  'Caminhos relativos (prefix match) que os robôs SMB nunca devem varrer/importar';
