import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readApi(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('debug and token mint routes stay gated', () => {
  it('test-token requires admin JWT', () => {
    const src = readApi('src/app/api/test-token/route.ts');
    assert.ok(src.includes("requirePermission(request, 'admin')"));
  });

  it('admin generate-token requires CRON_SECRET', () => {
    const src = readApi('src/app/api/admin/generate-token/route.ts');
    assert.ok(src.includes('hasCronOrSetupSecret'));
  });

  it('test-supabase-users and debug-supabase-auth require admin JWT', () => {
    assert.ok(readApi('src/app/api/test-supabase-users/route.ts').includes("requirePermission(request, 'admin')"));
    assert.ok(readApi('src/app/api/debug-supabase-auth/route.ts').includes("requirePermission(request, 'admin')"));
  });

  it('test-users GET does not insert or promote a hardcoded admin', () => {
    const src = readApi('src/app/api/test-users/route.ts');
    assert.equal(src.includes('c9b1e9a2-3c80-4b3d-9f75-fc7a00d7cdbb'), false);
    assert.equal(src.includes(".insert("), false);
    assert.ok(src.includes("requirePermission(request, 'admin')"));
  });

  it('fix-token does not mint ADMIN on missing or invalid token', () => {
    const src = readApi('src/app/api/auth/fix-token/route.ts');
    assert.equal(src.includes('Novo token gerado para o administrador'), false);
    assert.equal(src.includes('tentando gerar token para administrador'), false);
    assert.ok(src.includes("error: 'Token não fornecido'"));
    assert.ok(src.includes("error: 'Token inválido ou expirado'"));
  });

  it('fix-auth verifies JWT signature before using userId', () => {
    const src = readApi('src/app/api/auth/fix-auth/route.ts');
    assert.ok(src.includes('verifyToken(token)'));
    assert.equal(src.includes('jwt.decode(token)'), false);
  });

  it('execute-sql does not auto-create SECURITY DEFINER execute_sql', () => {
    const src = readApi('src/app/api/execute-sql/route.ts');
    assert.equal(src.includes('SECURITY DEFINER'), false);
    assert.equal(src.includes('CREATE OR REPLACE FUNCTION execute_sql'), false);
  });
});
