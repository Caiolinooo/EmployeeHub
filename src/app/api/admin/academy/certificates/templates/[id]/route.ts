import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withPermission('manager', async (_req: NextRequest, { params }: any) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('certificate_templates').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
  return NextResponse.json({ template: data });
});

export const PATCH = withPermission('manager', async (req: NextRequest, { params }: any) => {
  try {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 });
    const body = await req.json();
    const allowed: any = {};
    if (typeof body?.name === 'string') allowed.name = body.name;
    if (typeof body?.active === 'boolean') allowed.active = body.active;
    if (body?.config_json) allowed.config_json = body.config_json; // object expected
    if (body?.course_id !== undefined) allowed.course_id = body.course_id || null;

    if (Object.keys(allowed).length === 0)
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('certificate_templates')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar template:', error);
      return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (e) {
    console.error('PATCH template error', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

