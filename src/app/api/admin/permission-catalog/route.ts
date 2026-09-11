import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getCatalogFeatureDefaultsForRole,
  getPermissionCatalogPayload,
  type UserRole,
} from '@/config/modules';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const catalog = getPermissionCatalogPayload();
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, description, enabled')
      .order('order', { ascending: true });

    const known = new Set(catalog.modules.map((mod) => mod.id));
    const extraCards: Array<{
      id: string;
      key: string;
      label: string;
      description: string;
      enabled: boolean;
      source: 'cards';
    }> = [];

    if (!error && cards) {
      for (const card of cards) {
        if (known.has(card.id)) continue;
        extraCards.push({
          id: card.id,
          key: card.id,
          label: card.title,
          description: card.description || '',
          enabled: card.enabled !== false,
          source: 'cards',
        });
      }
    }

    const roles: UserRole[] = ['ADMIN', 'MANAGER', 'USER'];
    const featureDefaults = Object.fromEntries(
      roles.map((role) => [role, getCatalogFeatureDefaultsForRole(role)])
    );

    return NextResponse.json({
      ...catalog,
      extraCards,
      featureDefaults,
    });
  } catch (error) {
    console.error('[permission-catalog] GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar catálogo de permissões' }, { status: 500 });
  }
}
