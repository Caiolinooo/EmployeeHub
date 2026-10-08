import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://abc.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJyb2xlIjoiYW5vbiJ9',
  'placeholder',
].join('.');
process.env.SUPABASE_SERVICE_ROLE_KEY ||= `eyJ${'A'.repeat(120)}`;
process.env.JWT_SECRET ||= 'test-jwt-secret-placeholder-not-for-production';

type Handler = (req: NextRequest) => Promise<Response>;

async function load(path: string, method: 'GET' | 'POST'): Promise<Handler> {
  const mod = (await import(path)) as Record<string, unknown> & { default?: Record<string, unknown> };
  const handler = (mod[method] ?? mod.default?.[method]) as Handler | undefined;
  if (typeof handler !== 'function') throw new Error(`${method} not exported by ${path}`);
  return handler;
}

const forgedAdmin = jwt.sign(
  { userId: '00000000-0000-0000-0000-000000000000', role: 'ADMIN' },
  'attacker-secret',
  { expiresIn: '1h' },
);
const unsignedAdmin = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
  '{"userId":"x","role":"ADMIN"}',
).toString('base64url')}.`;

function request(url: string, method: string, token?: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'POST' ? JSON.stringify({ fileName: 'x.pdf', enableDomainRule: true, recipients: [] }) : undefined,
  });
}

describe('rotas com JWT verificado (token forjado = 401)', () => {
  const cases: Array<[string, string, 'GET' | 'POST']> = [
    ['./route', 'http://localhost/api/library/upload-auth', 'POST'],
    ['../../reimbursement-settings/route', 'http://localhost/api/reimbursement-settings', 'POST'],
    ['../../reimbursement-settings/route', 'http://localhost/api/reimbursement-settings', 'GET'],
    ['../../reimbursement-settings-fallback/route', 'http://localhost/api/reimbursement-settings-fallback', 'POST'],
  ];

  for (const [path, url, method] of cases) {
    it(`${method} ${url}: sem token, assinatura forjada e alg none -> 401`, async () => {
      const handler = await load(path, method);
      for (const token of [undefined, forgedAdmin, unsignedAdmin]) {
        const res = await handler(request(url, method, token));
        assert.equal(res.status, 401, `token=${token ? token.slice(0, 12) : 'none'}`);
      }
    });
  }
});
