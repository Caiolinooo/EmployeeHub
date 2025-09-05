import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_secrets')
      .select('value')
      .eq('key', 'VAPID_PUBLIC_KEY')
      .maybeSingle();
    if (error) {
      console.error('Erro ao buscar VAPID_PUBLIC_KEY:', error);
      return NextResponse.json({ publicKey: null }, { status: 500 });
    }
    return NextResponse.json({ publicKey: (data?.value as any) || null });
  } catch (e) {
    console.error('Erro em GET /notifications/push/public-key:', e);
    return NextResponse.json({ publicKey: null }, { status: 500 });
  }
}

