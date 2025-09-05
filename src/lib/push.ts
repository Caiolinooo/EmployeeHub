import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptValue } from '@/lib/secure-credentials';

async function getVapid(): Promise<{ publicKey: string; privateKey: string; subject: string } | null> {
  try {
    const { data: pub } = await supabaseAdmin.from('app_secrets').select('value, is_encrypted').eq('key', 'VAPID_PUBLIC_KEY').maybeSingle();
    const { data: prv } = await supabaseAdmin.from('app_secrets').select('value, is_encrypted').eq('key', 'VAPID_PRIVATE_KEY').maybeSingle();
    const { data: subj } = await supabaseAdmin.from('app_secrets').select('value, is_encrypted').eq('key', 'VAPID_SUBJECT').maybeSingle();
    const publicKey = pub?.value || '';
    let privateKey = prv?.value || '';
    if (prv?.is_encrypted) privateKey = decryptValue(privateKey);
    const subject = subj?.value || 'mailto:apiabzgroup@gmail.com';
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey, subject };
  } catch (e) {
    console.error('Erro ao obter VAPID keys:', e);
    return null;
  }
}

export async function sendPushToUserIds(userIds: string[], payload: { title: string; body?: string; url?: string }) {
  if (!userIds || userIds.length === 0) return { sent: 0 };
  const vapid = await getVapid();
  if (!vapid) { console.warn('VAPID ausente, pulando push'); return { sent: 0 }; }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  // Buscar assinaturas
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', Array.from(new Set(userIds)) as string[]);
  if (error) { console.error('Erro ao buscar assinaturas push:', error); return { sent: 0 }; }
  if (!subs || subs.length === 0) return { sent: 0 };

  const data = JSON.stringify({ title: payload.title, body: payload.body || '', url: payload.url || '/' });
  const results = await Promise.allSettled(subs.map((s: any) => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any;
    return webpush.sendNotification(sub, data);
  }));

  // Limpar inválidas
  const toDelete: string[] = [];
  results.forEach((r, idx) => {
    if (r.status === 'rejected') {
      const code = (r.reason && r.reason.statusCode) || 0;
      if (code === 404 || code === 410) {
        toDelete.push(subs[idx].endpoint);
      }
    }
  });
  if (toDelete.length) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', toDelete as any);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return { sent };
}

