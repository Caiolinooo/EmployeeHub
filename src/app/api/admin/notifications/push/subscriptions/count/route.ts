import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let query = supabaseAdmin
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (userId) query = query.eq('user_id', userId);

    const { count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ total: count || 0 });
  } catch (e: any) {
    console.error('Erro ao contar push_subscriptions:', e?.message || e);
    return NextResponse.json({ error: 'Falha ao obter contagem' }, { status: 500 });
  }
}

