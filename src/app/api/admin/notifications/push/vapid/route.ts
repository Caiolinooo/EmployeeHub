import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import webpush from 'web-push';

function encryptValue(value: string, salt: string = 'abz-security-salt'): string {
  if (!value) return '';
  const key = crypto.createHash('md5').update(salt).digest('hex').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export const GET = withPermission('manager', async () => {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.from('app_secrets').select('key, value').eq('key','VAPID_PUBLIC_KEY').maybeSingle();
  if (error) {
    console.error('VAPID GET error:', error);
    return NextResponse.json({ publicKey: null, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ publicKey: data?.value || null });
});

export const POST = withPermission('manager', async (req: NextRequest) => {
  try {
    const { rotate } = await req.json().catch(() => ({ rotate: false }));

    // Checar existente e retornar se não precisa rotacionar
    const admin = await getSupabaseAdmin();
    const { data: existing, error: existingErr } = await admin.from('app_secrets').select('value').eq('key','VAPID_PUBLIC_KEY').maybeSingle();
    if (existingErr) {
      console.error('VAPID check existing error:', existingErr);
    }
    if (existing && !rotate) {
      return NextResponse.json({ ok: true, publicKey: existing.value, message: 'Já configurado' });
    }

    // Gerar
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();

    const updates = [
      { key: 'VAPID_PUBLIC_KEY', value: publicKey, description: 'Chave pública VAPID', is_encrypted: false },
      { key: 'VAPID_PRIVATE_KEY', value: encryptValue(privateKey), description: 'Chave privada VAPID (AES-256-CBC)', is_encrypted: true },
      { key: 'VAPID_SUBJECT', value: 'mailto:apiabzgroup@gmail.com', description: 'Assunto VAPID', is_encrypted: false }
    ];

    const { error } = await admin.from('app_secrets').upsert(updates, { onConflict: 'key' });
    if (error) {
      console.error('Erro ao salvar VAPID em app_secrets:', error);
      return NextResponse.json({ error: 'Falha ao salvar chaves VAPID', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, publicKey });
  } catch (e: any) {
    console.error('Erro ao gerar VAPID:', e);
    return NextResponse.json({ error: 'Erro interno', details: e?.message || String(e) }, { status: 500 });
  }
});

