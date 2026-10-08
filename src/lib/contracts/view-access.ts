import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { AuthenticatedUser } from '@/lib/api-auth';
import { loadEffectivePermissions } from '@/lib/effective-permissions-server';
import { roleBypassesFeature } from '@/lib/effective-feature';
import { buildContractAccess, type ContractAccess, type ContractAction } from './action-gate';
import { CONTRACT_VIEW_ALL } from './view-scope';

/** Escopo + ações do usuário numa só leitura (mesma composição do sidebar: JSONB + ACL + módulo efetivo). */
export async function loadContractAccess(user: AuthenticatedUser): Promise<ContractAccess> {
  const bypass = roleBypassesFeature(user.role, CONTRACT_VIEW_ALL);
  const snapshot = bypass ? null : await loadEffectivePermissions(user.id);
  return buildContractAccess({
    role: user.role,
    features: user.access_permissions?.features,
    aclNames: snapshot?.aclNames ?? [],
    moduleEnabled: bypass ? undefined : snapshot?.modules.contratos === true,
  });
}

/** 403 se nenhuma das ações for permitida. */
export function denyUnlessCan(access: ContractAccess, ...actions: ContractAction[]): NextResponse | null {
  if (actions.some((action) => access.can[action])) return null;
  return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
}

/** Mutação em envelope: escopo `all` ou remetente do envelope (quem criou). */
export async function canMutateEnvelope(
  user: Pick<AuthenticatedUser, 'id'>,
  access: ContractAccess,
  envelopeId: string,
): Promise<boolean> {
  if (access.scope === 'all') return true;
  if (access.scope === 'none') return false;
  const { data } = await supabaseAdmin.from('envelopes').select('remetente_id').eq('id', envelopeId).maybeSingle();
  return data?.remetente_id === user.id;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function isOwnSolicitacao(
  user: Pick<AuthenticatedUser, 'id' | 'email'>,
  row: { colaborador_id?: string | null; external_signer_email?: string | null },
): boolean {
  if (row.colaborador_id === user.id) return true;
  const email = user.email?.trim().toLowerCase();
  return !!email && row.external_signer_email?.trim().toLowerCase() === email;
}

/** Envelopes em que o usuário é signatário/cópia (por id de portal ou e-mail de signatário externo). */
export async function getOwnEnvelopeIds(user: Pick<AuthenticatedUser, 'id' | 'email'>): Promise<string[]> {
  const email = user.email?.trim();
  const [byId, byEmail] = await Promise.all([
    supabaseAdmin.from('solicitacoes_assinatura').select('envelope_id').eq('colaborador_id', user.id),
    email
      ? supabaseAdmin
          .from('solicitacoes_assinatura')
          .select('envelope_id')
          .ilike('external_signer_email', escapeLike(email))
      : Promise.resolve({ data: [] as { envelope_id: string | null }[] }),
  ]);
  const ids = [...(byId.data || []), ...(byEmail.data || [])]
    .map((r) => r.envelope_id)
    .filter((id): id is string => !!id);
  return [...new Set(ids)];
}
