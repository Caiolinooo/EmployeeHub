/**
 * Backfill idempotente: liga gt_colaboradores.user_id ao cadastro único (users_unified).
 * Regra: src/lib/gestao-tripulantes/vinculo-usuario.ts (CPF -> e-mail, corroborado; nunca duplica).
 * Dry-run por padrão (só mede). Run:
 *   npx tsx scripts/backfill-gt-vinculo-usuario.ts            # dry-run
 *   npx tsx scripts/backfill-gt-vinculo-usuario.ts --apply    # liga existentes
 *   npx tsx scripts/backfill-gt-vinculo-usuario.ts --apply --criar   # + cria usuário pendente/inativo (ativos)
 */
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const apply = process.argv.includes('--apply');
  const criar = apply && process.argv.includes('--criar');
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { vincularUsuarioUnico } = await import('../src/lib/gestao-tripulantes/vinculo-usuario');
  const { resolvePortalUser } = await import('../src/lib/employee-hub/portal-user');
  const { normalizeCpf } = await import('../src/lib/utils/identity');
  const { normalizeEmail } = await import('../src/lib/employee-hub/portal-user-match');

  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, email, ativo, user_id')
    .is('deleted_at', null)
    .is('user_id', null)
    .order('nome_completo');
  if (error) throw new Error(error.message);

  const total: Record<string, number> = {};
  for (const c of data || []) {
    let acao: string;
    if (apply) {
      acao = (await vincularUsuarioUnico(c, { criar })).acao;
    } else {
      const r = await resolvePortalUser({
        colaboradorId: c.id, userId: null, cpf: normalizeCpf(c.cpf || ''), email: normalizeEmail(c.email), nome: c.nome_completo,
      });
      acao = r.user ? 'vincularia' : 'sem_match';
    }
    total[acao] = (total[acao] || 0) + 1;
  }
  console.log(JSON.stringify({ modo: apply ? (criar ? 'apply+criar' : 'apply') : 'dry-run', semUserId: data?.length ?? 0, ...total }));
}

main().catch(err => { console.error(err); process.exit(1); });
