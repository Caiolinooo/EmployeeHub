-- Fase 0 — Pausa imediata dos robôs SMB (dp-import + smb-sync)
-- Motivo: inclusão manual de documentos em andamento pelo DP; robô gravava
-- documentos em colaborador errado e puxava documentos restritos.
-- Reversão: UPDATE ... is_active = true; valor = 'true' nas chaves abaixo.

UPDATE public.smb_connections
SET is_active = false, updated_at = now()
WHERE id = 'b404e324-b9b3-452d-a6ac-9fbace6a00ea';

INSERT INTO public.gt_configuracoes (chave, valor, descricao) VALUES
  ('dp_import_enabled', 'false'::jsonb, 'Kill-switch do robô dp-import (reativar na Fase 4)'),
  ('smb_sync_enabled',  'false'::jsonb, 'Kill-switch do smb-sync (script CLI + rota /api/smb/sync)')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
