import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/api-auth';

// Chave usada na tabela 'settings'
const SETTINGS_KEY = 'notifications';

const defaultSettings = {
  autoNotifyNewsPosts: true,
  newsPostTitle: 'Nova publicação no ABZ News',
  newsPostMessage: '{{author}} publicou: {{title}}',
  defaultPriority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  defaultExpiresDays: 30
};

export const GET = withPermission('manager', async (_req: NextRequest) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao buscar notification settings, usando padrão:', error);
      return NextResponse.json(defaultSettings);
    }

    const value = (data?.value as any) || {};
    return NextResponse.json({ ...defaultSettings, ...value });
  } catch (err) {
    console.error('Erro em GET notification-settings:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

export const PUT = withPermission('manager', async (req: NextRequest) => {
  try {
    const body = await req.json();
    const value = { ...defaultSettings, ...body };

    // Upsert
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert(
        { key: SETTINGS_KEY, value, description: 'Configurações globais de notificações' },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Erro ao salvar notification settings:', error);
      return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
    }

    return NextResponse.json(value);
  } catch (err) {
    console.error('Erro em PUT notification-settings:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

