import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

/**
 * Integração contra o banco real (somente leitura). Rodar com:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config --test src/app/api/leave/leave-access.test.ts
 */
const live = Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface Fixture {
  requestId: string;
  ownerId: string;
  ownerRole: string;
  leaderId: string;
  strangerId: string;
  adminId: string;
}

function token(userId: string, role: string): string {
  return jwt.sign({ userId, role, phoneNumber: '' }, process.env.JWT_SECRET as string, { expiresIn: '10m' });
}

function req(path: string, auth?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} });
}

describe('férias: USER só vê as próprias', { skip: !live && 'sem DATABASE_URL/JWT_SECRET' }, () => {
  let fx: Fixture;
  let listGet: Handler;
  let pdfGet: (req: NextRequest, props: { params: Promise<{ id: string }> }) => Promise<Response>;

  before(async () => {
    const { supabaseAdmin } = await import('../../../lib/db');
    listGet = (await import('./requests/route')).GET as unknown as Handler;
    pdfGet = (await import('./[id]/pdf/route')).GET;

    const { data: perms } = await supabaseAdmin.from('acl_permissions').select('id').eq('resource', 'ferias');
    const { data: direct } = await supabaseAdmin
      .from('user_acl_permissions')
      .select('user_id')
      .in('permission_id', (perms || []).map((p: { id: string }) => p.id));
    const directIds = new Set((direct || []).map((d: { user_id: string }) => d.user_id));

    const { data: configs } = await supabaseAdmin.from('leave_sector_configs').select('sector_id, leader_id, manager_id');
    const approverIds = new Set((configs || []).flatMap((c: { leader_id: string; manager_id: string }) => [c.leader_id, c.manager_id]));

    const { data: users } = await supabaseAdmin.from('users_unified').select('id, role, sector_id, active').eq('active', true);
    const byId = new Map((users || []).map((u: { id: string; role: string; sector_id: string | null }) => [u.id, u]));

    const { data: requests } = await supabaseAdmin.from('leave_requests').select('id, user_id');
    let picked: Fixture | null = null;
    for (const r of requests || []) {
      const owner = byId.get(r.user_id);
      const cfg = (configs || []).find((c: { sector_id: string }) => c.sector_id === owner?.sector_id);
      const leader = cfg ? byId.get(cfg.leader_id) : undefined;
      if (!owner || !leader || leader.role !== 'USER' || directIds.has(leader.id) || leader.id === owner.id) continue;
      const stranger = (users || []).find(
        (u: { id: string; role: string }) => u.role === 'USER' && u.id !== owner.id && !approverIds.has(u.id) && !directIds.has(u.id),
      );
      const admin = (users || []).find((u: { role: string }) => u.role === 'ADMIN');
      if (!stranger || !admin) continue;
      picked = { requestId: r.id, ownerId: owner.id, ownerRole: owner.role, leaderId: leader.id, strangerId: stranger.id, adminId: admin.id };
      break;
    }
    assert.ok(picked, 'fixture: pedido de férias com líder USER no setor');
    fx = picked;
  });

  const pdf = (id: string, auth?: string) => pdfGet(req(`/api/leave/${id}/pdf`, auth), { params: Promise.resolve({ id }) });

  it('sem token → 401', async () => {
    assert.equal((await listGet(req(`/api/leave/requests?userId=${fx.ownerId}`))).status, 401);
    assert.equal((await pdf(fx.requestId)).status, 401);
  });

  it('USER vê e baixa as próprias férias', async () => {
    const own = await listGet(req(`/api/leave/requests?userId=${fx.ownerId}`, token(fx.ownerId, fx.ownerRole)));
    assert.equal(own.status, 200);
    const rows = (await own.json()) as Array<{ id: string }>;
    assert.equal(rows.some((row) => row.id === fx.requestId), true);
    const file = await pdf(fx.requestId, token(fx.ownerId, fx.ownerRole));
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
  });

  it('USER sem grant não vê férias nem PDF de outro', async () => {
    const auth = token(fx.strangerId, 'USER');
    assert.equal((await listGet(req(`/api/leave/requests?userId=${fx.ownerId}`, auth))).status, 403);
    assert.equal((await pdf(fx.requestId, auth)).status, 403);
  });

  it('ADMIN lista e líder de setor (USER) baixa o PDF do liderado', async () => {
    assert.equal((await listGet(req(`/api/leave/requests?userId=${fx.ownerId}`, token(fx.adminId, 'ADMIN')))).status, 200);
    assert.equal((await pdf(fx.requestId, token(fx.leaderId, 'USER'))).status, 200);
  });
});
