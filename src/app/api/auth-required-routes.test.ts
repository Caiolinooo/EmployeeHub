import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

/**
 * Bloco "dono vs outro" roda contra o banco real (somente leitura):
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config --test src/app/api/auth-required-routes.test.ts
 */
const live = Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJyb2xlIjoiYW5vbiJ9', 'placeholder'].join('.');
process.env.SUPABASE_SERVICE_ROLE_KEY ||= `eyJ${'A'.repeat(120)}`;
process.env.JWT_SECRET ||= 'test-jwt-secret-placeholder-not-for-production';

type AnyHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const ROUTES: Array<[label: string, load: () => Promise<Record<string, unknown>>, method: string, path: string, params?: Record<string, string>]> = [
  ['calendar/events GET', () => import('./calendar/events/route'), 'GET', '/api/calendar/events?userId=u2'],
  ['calendar/events POST', () => import('./calendar/events/route'), 'POST', '/api/calendar/events'],
  ['calendar/events PUT', () => import('./calendar/events/route'), 'PUT', '/api/calendar/events'],
  ['calendar/events DELETE', () => import('./calendar/events/route'), 'DELETE', '/api/calendar/events?eventId=e1'],
  ['calendar/company/notify POST', () => import('./calendar/company/notify/route'), 'POST', '/api/calendar/company/notify'],
  ['news/categories POST', () => import('./news/categories/route'), 'POST', '/api/news/categories'],
  ['news/upload POST', () => import('./news/upload/route'), 'POST', '/api/news/upload'],
  ['news/posts comment PUT', () => import('./news/posts/[postId]/comments/[commentId]/route'), 'PUT', '/api/news/posts/p1/comments/c1', { postId: 'p1', commentId: 'c1' }],
  ['news/posts comment DELETE', () => import('./news/posts/[postId]/comments/[commentId]/route'), 'DELETE', '/api/news/posts/p1/comments/c1', { postId: 'p1', commentId: 'c1' }],
  ['news/[id] comment PUT', () => import('./news/[id]/comments/[commentId]/route'), 'PUT', '/api/news/n1/comments/c1', { id: 'n1', commentId: 'c1' }],
  ['news/[id] comment DELETE', () => import('./news/[id]/comments/[commentId]/route'), 'DELETE', '/api/news/n1/comments/c1', { id: 'n1', commentId: 'c1' }],
  ['news/posts comments POST', () => import('./news/posts/[postId]/comments/route'), 'POST', '/api/news/posts/p1/comments', { postId: 'p1' }],
  ['news/[id] comments POST', () => import('./news/[id]/comments/route'), 'POST', '/api/news/n1/comments', { id: 'n1' }],
  ['notifications GET', () => import('./notifications/route'), 'GET', '/api/notifications?user_id=u2'],
  ['notifications POST', () => import('./notifications/route'), 'POST', '/api/notifications'],
  ['notifications DELETE', () => import('./notifications/route'), 'DELETE', '/api/notifications?user_id=u2&delete_all=true'],
  ['notifications/purge POST', () => import('./notifications/purge/route'), 'POST', '/api/notifications/purge'],
  ['push subscriptions/count GET', () => import('./admin/notifications/push/subscriptions/count/route'), 'GET', '/api/admin/notifications/push/subscriptions/count'],
];

function handlerOf(mod: Record<string, unknown>, method: string): AnyHandler {
  const interop = mod as Record<string, unknown> & { default?: Record<string, unknown> };
  const fn = interop[method] ?? interop.default?.[method];
  assert.equal(typeof fn, 'function', `${method} não exportado`);
  return fn as AnyHandler;
}

function request(method: string, path: string, headers: Record<string, string> = {}): NextRequest {
  const hasBody = method === 'POST' || method === 'PUT';
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: hasBody ? { 'content-type': 'application/json', ...headers } : headers,
    body: hasBody ? JSON.stringify({ user_id: 'u2', userId: 'u2', eventId: 'e1', name: 'x', content: 'x', type: 't', title: 't', summary: 's', start: 'a', end: 'b' }) : undefined,
  });
}

describe('notificações e comentários: dono = token', { skip: !live && 'sem DATABASE_URL/JWT_SECRET' }, () => {
  let owner: { id: string; role: string };
  let stranger: { id: string; role: string };
  let admin: { id: string; role: string };

  const bearer = (u: { id: string; role: string }) => ({
    authorization: `Bearer ${jwt.sign({ userId: u.id, role: u.role, phoneNumber: '' }, process.env.JWT_SECRET as string, { expiresIn: '10m' })}`,
  });
  const call = async (load: () => Promise<Record<string, unknown>>, method: string, path: string, headers: Record<string, string>, body?: unknown, params: Record<string, string> = {}) => {
    const handler = handlerOf(await load(), method);
    const init = body === undefined ? { method, headers } : { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) };
    return handler(new NextRequest(`http://localhost${path}`, init), { params: Promise.resolve(params) });
  };
  const notifications = () => import('./notifications/route');
  const postComments = () => import('./news/posts/[postId]/comments/route');
  const newsComments = () => import('./news/[id]/comments/route');

  before(async () => {
    const { supabaseAdmin } = await import('../../lib/db');
    const { data } = await supabaseAdmin.from('users_unified').select('id, role, access_permissions').eq('active', true);
    const plain = (data || []).filter((u: { role: string; access_permissions: unknown }) =>
      u.role === 'USER' && !JSON.stringify(u.access_permissions || {}).includes('notifications'));
    [owner, stranger] = plain;
    admin = (data || []).find((u: { role: string }) => u.role === 'ADMIN') as { id: string; role: string };
    assert.ok(owner && stranger && admin, 'fixture: 2 USER ativos + 1 ADMIN');
  });

  it('GET notificações de outro user_id → 403; ADMIN → 200', async () => {
    assert.equal((await call(notifications, 'GET', `/api/notifications?user_id=${owner.id}`, bearer(stranger))).status, 403);
    assert.equal((await call(notifications, 'GET', `/api/notifications?user_id=${owner.id}`, bearer(admin))).status, 200);
  });

  it('GET sem user_id lista só as do usuário do token', async () => {
    const res = await call(notifications, 'GET', '/api/notifications?limit=50', bearer(owner));
    assert.equal(res.status, 200);
    const { notifications: rows } = (await res.json()) as { notifications: Array<{ user_id: string }> };
    assert.deepEqual([...new Set(rows.map((r) => r.user_id))].filter((id) => id !== owner.id), []);
  });

  it('POST comentário com user_id de outro → 403', async () => {
    const postId = randomUUID();
    assert.equal((await call(postComments, 'POST', `/api/news/posts/${postId}/comments`, bearer(owner), { user_id: stranger.id, content: 'x' }, { postId })).status, 403);
    assert.equal((await call(newsComments, 'POST', `/api/news/${postId}/comments`, bearer(owner), { userId: stranger.id, content: 'x' }, { id: postId })).status, 403);
  });

  it('POST comentário sem user_id passa do gate com o id do token (post inexistente → 404)', async () => {
    const postId = randomUUID();
    const a = await call(postComments, 'POST', `/api/news/posts/${postId}/comments`, bearer(owner), { content: 'x' }, { postId });
    assert.deepEqual([a.status, (await a.json()).error], [404, 'Post não encontrado']);
    const b = await call(newsComments, 'POST', `/api/news/${postId}/comments`, bearer(owner), { userId: owner.id, content: 'x' }, { id: postId });
    assert.deepEqual([b.status, (await b.json()).error], [404, 'Notícia não encontrada']);
  });
});

describe('rotas antes anônimas exigem login', () => {
  const originalFetch = globalThis.fetch;
  let outbound = 0;

  beforeEach(() => {
    outbound = 0;
    globalThis.fetch = (async () => {
      outbound += 1;
      return new Response('', { status: 503 });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const [label, load, method, path, params] of ROUTES) {
    it(`${label} sem token → 401, sem tocar banco/storage`, async () => {
      const handler = handlerOf(await load(), method);
      const res = await handler(request(method, path), { params: Promise.resolve(params || {}) });
      assert.equal(res.status, 401);
      assert.equal(outbound, 0);
    });
  }

  it('calendar/company/notify com CRON_SECRET errado → 401; certo passa do gate', async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'cron-secret-for-test';
    try {
      const handler = handlerOf(await import('./calendar/company/notify/route'), 'POST');
      const wrong = await handler(request('POST', '/api/calendar/company/notify', { authorization: 'Bearer nope' }), { params: Promise.resolve({}) });
      assert.equal(wrong.status, 401);
      const right = await handler(request('POST', '/api/calendar/company/notify', { authorization: 'Bearer cron-secret-for-test' }), { params: Promise.resolve({}) });
      assert.equal(right.status, 502);
      assert.equal((await right.json()).error, 'Falha ao baixar ICS (503)');
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
});
