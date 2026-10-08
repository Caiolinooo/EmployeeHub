import { supabaseAdmin } from '@/lib/supabase';
import { resolvePortalUser } from '@/lib/employee-hub/portal-user';
import { normalizeEmail } from '@/lib/employee-hub/portal-user-match';
import { formatCpf, isValidCpf, normalizeCpf } from '@/lib/utils/identity';

export type VinculoUsuarioAcao = 'ja_vinculado' | 'vinculado' | 'criado' | 'sem_match' | 'ambiguo';

export interface ColaboradorVinculoInput {
  id: string;
  user_id?: string | null;
  nome_completo?: string | null;
  cpf?: string | null;
  email?: string | null;
  ativo?: boolean | null;
}

/**
 * Liga `gt_colaboradores.user_id` ao cadastro único (`users_unified`), sem tabela paralela.
 * 1) `resolvePortalUser` (CPF → e-mail → nome+CPF, com corroboração) faz o backfill de `user_id`.
 * 2) Sem nenhum usuário com o mesmo `tax_id`/e-mail e `criar`, cria registro **pendente e inativo**
 *    (sem conta Auth/senha — o acesso só existe após aprovação do admin).
 * Hit sem corroboração vira `ambiguo`: nunca cria, para não duplicar CPF/e-mail.
 */
export async function vincularUsuarioUnico(
  colab: ColaboradorVinculoInput,
  opts: { criar: boolean },
): Promise<{ acao: VinculoUsuarioAcao; userId: string | null }> {
  if (colab.user_id) return { acao: 'ja_vinculado', userId: colab.user_id };

  const cpf = normalizeCpf(colab.cpf || '');
  if (!isValidCpf(cpf)) return { acao: 'sem_match', userId: null };
  const email = normalizeEmail(colab.email);
  const nome = (colab.nome_completo || '').trim();

  const resolved = await resolvePortalUser({ colaboradorId: colab.id, userId: null, cpf, email, nome });
  if (resolved.user) return { acao: 'vinculado', userId: resolved.user.id };

  const filtros = [`tax_id.eq.${cpf}`, `tax_id.eq.${formatCpf(cpf)}`];
  if (email.includes('@')) filtros.push(`email.ilike.${email}`);
  const { data: existentes } = await supabaseAdmin.from('users_unified').select('id').or(filtros.join(',')).limit(1);
  if (existentes?.length) return { acao: 'ambiguo', userId: null };

  if (!opts.criar || colab.ativo === false || !nome) return { acao: 'sem_match', userId: null };

  const [first, ...rest] = nome.split(/\s+/);
  const { data: criado, error } = await supabaseAdmin
    .from('users_unified')
    .insert({
      first_name: first,
      last_name: rest.join(' '),
      email: email.includes('@') ? email : null,
      tax_id: cpf,
      role: 'USER',
      active: false,
      is_authorized: false,
      authorization_status: 'pending',
      email_verified: false,
    })
    .select('id')
    .single();
  if (error || !criado) {
    console.error('[vinculo-usuario] falha ao criar usuário pendente:', error?.message);
    return { acao: 'sem_match', userId: null };
  }

  await supabaseAdmin
    .from('gt_colaboradores')
    .update({ user_id: criado.id })
    .eq('id', colab.id)
    .is('user_id', null);
  return { acao: 'criado', userId: criado.id };
}
