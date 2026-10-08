-- Contratos: corrige RLS de envelopes e fecha acesso anon/authenticated às tabelas de assinatura.
-- Todas as rotas /api/contracts/** usam service_role (bypassa RLS); nenhum client usa estas tabelas.
-- Idempotente. Rollback: recriar as policies antigas (ver bloco ao final).

-- 1) envelopes_select_collaborator_policy: `s.envelope_id = s.id` nunca casava (comparava a própria linha).
DROP POLICY IF EXISTS envelopes_select_collaborator_policy ON public.envelopes;
CREATE POLICY envelopes_select_collaborator_policy ON public.envelopes
  FOR SELECT
  USING (
    auth.uid() = remetente_id
    OR EXISTS (
      SELECT 1
      FROM public.solicitacoes_assinatura s
      WHERE s.envelope_id = envelopes.id
        AND (
          s.colaborador_id = auth.uid()
          OR lower(s.external_signer_email) = (
            SELECT lower(u.email) FROM public.users_unified u WHERE u.id = auth.uid()
          )
        )
    )
  );

-- 2) service_full_* / template policies com roles {public} + USING true expunham token_acesso,
--    arquivo_url e auditoria a qualquer portador da anon key. Restringe a service_role.
DROP POLICY IF EXISTS service_full_solicitacoes ON public.solicitacoes_assinatura;
CREATE POLICY service_full_solicitacoes ON public.solicitacoes_assinatura
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_full_documentos ON public.documentos_trabalhistas;
CREATE POLICY service_full_documentos ON public.documentos_trabalhistas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_full_auditoria ON public.auditoria_assinaturas;
CREATE POLICY service_full_auditoria ON public.auditoria_assinaturas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS template_fields_policy ON public.contrato_template_campos;
CREATE POLICY template_fields_policy ON public.contrato_template_campos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS template_docs_policy ON public.contrato_template_documentos;
CREATE POLICY template_docs_policy ON public.contrato_template_documentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS templates_select_policy ON public.contrato_templates;
CREATE POLICY templates_select_policy ON public.contrato_templates
  FOR SELECT TO authenticated USING (true);

-- Rollback (estado anterior):
--   service_full_*, template_fields_policy, template_docs_policy: FOR ALL TO public USING (true) [WITH CHECK (true)]
--   templates_select_policy: FOR SELECT TO public USING (true)
--   envelopes_select_collaborator_policy: igual ao acima, com `s.envelope_id = s.id` (bug).
