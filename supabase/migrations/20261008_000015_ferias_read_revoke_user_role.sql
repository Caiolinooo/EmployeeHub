-- ferias.read abre leitura de solicitações/PDFs de qualquer colaborador (rotas leave/* e admin/leave-requests).
-- O papel USER não pode tê-la: o próprio pedido passa pelo caminho do dono, líder/gerente pelo de aprovador.
-- Grants diretos em user_acl_permissions ficam intactos.
DELETE FROM public.role_acl_permissions rap
USING public.acl_permissions ap
WHERE rap.permission_id = ap.id
  AND ap.resource = 'ferias'
  AND ap.action = 'read'
  AND rap.role = 'USER';

-- Rollback:
-- INSERT INTO public.role_acl_permissions (role, permission_id)
-- SELECT 'USER', ap.id FROM public.acl_permissions ap
-- WHERE ap.resource = 'ferias' AND ap.action = 'read'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.role_acl_permissions r WHERE r.role = 'USER' AND r.permission_id = ap.id
--   );
