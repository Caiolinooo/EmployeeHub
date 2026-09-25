import { NextRequest, NextResponse } from 'next/server';

export function unauthorizedDebugResponse(): NextResponse {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

export function hasCronOrSetupSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }

  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const cronHeader = request.headers.get('x-cron-secret') || '';

  return bearer === expected || cronHeader === expected;
}
