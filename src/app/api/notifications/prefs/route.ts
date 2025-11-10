import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const defaultPrefs = {
  channels: { in_app: true, email: true, push: false },
  types: {
    news_post: { in_app: true, email: true, push: false },
    system: { in_app: true, email: true, push: false },
    reminder: { in_app: true, email: true, push: false },
    comment: { in_app: true, email: false, push: false }
  }
};

function deepMerge(target: any, source: any) {
  const out: any = Array.isArray(target) ? [...target] : { ...target };
  for (const [k, v] of Object.entries(source || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] || {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { user, error } = await authenticateUser(request);
  if (error || !user) return error as NextResponse;

  try {
    const { data, error: uerr } = await supabaseAdmin
      .from('users_unified')
      .select('id, profile_data')
      .eq('id', user.id)
      .single();

    if (uerr || !data) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const pd = (data.profile_data as any) || {};
    const prefs = pd.notification_prefs || {};
    return NextResponse.json(deepMerge(defaultPrefs, prefs));
  } catch (e) {
    console.error('GET /api/notifications/prefs error', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = await authenticateUser(request);
  if (error || !user) return error as NextResponse;

  try {
    const body = await request.json();
    const incoming = body?.prefs || {};

    const { data: current } = await supabaseAdmin
      .from('users_unified')
      .select('profile_data')
      .eq('id', user.id)
      .single();

    const pd = (current?.profile_data as any) || {};
    const nextPrefs = deepMerge(defaultPrefs, deepMerge(pd.notification_prefs || {}, incoming));

    const { error: upErr } = await supabaseAdmin
      .from('users_unified')
      .update({ profile_data: { ...pd, notification_prefs: nextPrefs } })
      .eq('id', user.id);

    if (upErr) {
      console.error('Erro ao salvar prefs', upErr);
      return NextResponse.json({ error: 'Erro ao salvar preferências' }, { status: 500 });
    }

    return NextResponse.json(nextPrefs);
  } catch (e) {
    console.error('PUT /api/notifications/prefs error', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

