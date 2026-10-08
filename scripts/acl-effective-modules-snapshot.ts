/**
 * Read-only. Mede o impacto de mudanças na composição de módulos efetivos.
 *
 *   npx tsx --env-file=.env.local scripts/acl-effective-modules-snapshot.ts snapshot before.json
 *   npx tsx --env-file=.env.local scripts/acl-effective-modules-snapshot.ts snapshot after.json
 *   npx tsx scripts/acl-effective-modules-snapshot.ts diff before.json after.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Row = { id: string; role: string; sector: string | null; modules: string[] };

async function snapshot(out: string) {
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { loadEffectivePermissions } = await import('../src/lib/effective-permissions-server');
  const { data: users, error } = await supabaseAdmin
    .from('users_unified')
    .select('id, role, sector:sectors(name)')
    .eq('active', true);
  if (error) throw error;
  const rows: Row[] = [];
  for (const user of users || []) {
    const snap = await loadEffectivePermissions(user.id);
    if (!snap) continue;
    const sector = (user.sector as { name?: string } | null)?.name ?? null;
    rows.push({
      id: user.id,
      role: snap.role.toUpperCase(),
      sector,
      modules: Object.keys(snap.modules).filter((key) => snap.modules[key]).sort(),
    });
  }
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`snapshot: ${rows.length} usuários ativos -> ${out}`);
}

function diff(beforePath: string, afterPath: string) {
  const before = new Map((JSON.parse(readFileSync(beforePath, 'utf8')) as Row[]).map((r) => [r.id, r]));
  const after = JSON.parse(readFileSync(afterPath, 'utf8')) as Row[];
  const perModule = new Map<string, { lost: string[]; gained: string[] }>();
  const bucket = (key: string) => {
    if (!perModule.has(key)) perModule.set(key, { lost: [], gained: [] });
    return perModule.get(key)!;
  };
  for (const row of after) {
    const prev = new Set(before.get(row.id)?.modules || []);
    const next = new Set(row.modules);
    const who = `${row.role}/${row.sector ?? 'sem setor'}`;
    for (const key of prev) if (!next.has(key)) bucket(key).lost.push(who);
    for (const key of next) if (!prev.has(key)) bucket(key).gained.push(who);
  }
  const keys = [...perModule.keys()].sort();
  if (keys.length === 0) console.log('sem mudança');
  for (const key of keys) {
    const { lost, gained } = perModule.get(key)!;
    console.log(`${key}: -${lost.length} +${gained.length}`);
    if (lost.length) console.log(`  perde: ${lost.join(', ')}`);
    if (gained.length) console.log(`  ganha: ${gained.join(', ')}`);
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'snapshot' && a) {
  snapshot(a).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (cmd === 'diff' && a && b) {
  diff(a, b);
} else {
  console.error('uso: snapshot <out.json> | diff <before.json> <after.json>');
  process.exit(1);
}
