-- Close public REST access (advisor rls_disabled_in_public) on GT tables
-- created without RLS. Portal APIs use service_role, which bypasses RLS.
-- No anon/authenticated policies: same contract as gt_cargos,
-- gt_historico_embarques, gt_mio_entidades. Do not add USING (true)
-- policies — that would re-open the hole.

ALTER TABLE public.gt_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_acidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_relatorios_aprovacoes ENABLE ROW LEVEL SECURITY;
