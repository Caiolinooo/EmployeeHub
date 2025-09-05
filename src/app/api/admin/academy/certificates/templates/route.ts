import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withPermission('manager', async () => {
  const { data, error } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Erro ao listar templates' }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
});

export const POST = withPermission('manager', async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, course_id, storage_path, config_json, active = true } = body || {};
    if (!name || !storage_path || !config_json) {
      return NextResponse.json({ error: 'name, storage_path e config_json s\u00e3o obrigat\u00f3rios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('certificate_templates')
      .insert({ name, course_id: course_id || null, storage_path, config_json, active })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar template:', error);
      return NextResponse.json({ error: 'Erro ao criar template' }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (e) {
    console.error('Erro em POST templates:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

