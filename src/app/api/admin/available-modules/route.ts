import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPermissionCatalogModules } from '@/config/modules';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, description, enabled')
      .order('order', { ascending: true });

    const modules = getPermissionCatalogModules().map((mod) => ({
      id: mod.id,
      label: mod.label,
      description: mod.description,
      enabled: true,
      category: mod.category,
      defaultRoles: mod.defaultRoles,
      features: mod.features,
      acl: mod.acl,
    }));

    if (!error && cards) {
      for (const card of cards) {
        const exists = modules.find((item) => item.id === card.id);
        if (!exists) {
          modules.push({
            id: card.id,
            label: card.title,
            description: card.description || '',
            enabled: card.enabled !== false,
            category: 'system',
            defaultRoles: ['ADMIN', 'MANAGER', 'USER'],
            features: [],
            acl: [],
          });
        }
      }
    }

    modules.sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json(modules);
  } catch (error) {
    console.error('Erro ao buscar módulos disponíveis:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
