import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';

/**
 * Espera body: { subscription: PushSubscriptionJSON }
 * Salva/atualiza a assinatura para o usuário autenticado
 */
export async function POST(request: NextRequest) {
  const { user, error } = await authenticateUser(request);
  if (error || !user) return error as NextResponse;

  try {
    const body = await request.json();
    const subscription = body?.subscription;
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
    }

    // Verificar se a tabela existe tentando selecionar
    const { error: tableError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint')
      .limit(1);

    if (tableError && (tableError as any).code === '42P01') {
      return NextResponse.json({
        error: 'Tabela push_subscriptions inexistente. Posso criá-la automaticamente (gratuito). Autoriza?'
      }, { status: 500 });
    }

    const record = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || null,
      auth: subscription.keys?.auth || null,
      created_at: new Date().toISOString()
    };

    // Upsert por endpoint
    const { error: upsertError } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(record, { onConflict: 'endpoint' });

    if (upsertError) {
      console.error('Erro ao salvar assinatura push:', upsertError);
      return NextResponse.json({ error: 'Erro ao salvar assinatura' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Erro em subscribe push:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

