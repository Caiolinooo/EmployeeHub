import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-auth';
import { initTemplateFromRepoDefault } from '@/lib/certificates';

export const POST = withPermission('manager', async () => {
  const res = await initTemplateFromRepoDefault();
  if (!res.ok) return NextResponse.json({ error: res.reason || 'Falha ao inicializar template' }, { status: 500 });
  return NextResponse.json({ ok: true });
});

