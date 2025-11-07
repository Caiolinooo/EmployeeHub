import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureCertificatesBucket } from '@/lib/certificates';

export const dynamic = 'force-dynamic';

export const POST = withPermission('manager', async (req: NextRequest) => {
  try {
    await ensureCertificatesBucket();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const name = (form.get('name') as string) || 'Template';
    const course_id = (form.get('course_id') as string) || null;
    const cfgStr = (form.get('config_json') as string) || '';

    if (!file) return NextResponse.json({ error: 'Arquivo \'file\' 9 obrigat3rio' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const key = `templates/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;

    const { error: upErr } = await supabaseAdmin.storage.from('certificates').upload(key, bytes, { contentType: file.type || 'application/pdf', upsert: true } as any);
    if (upErr) {
      console.error('Falha ao enviar template ao storage:', upErr);
      return NextResponse.json({ error: 'Falha ao enviar arquivo' }, { status: 500 });
    }

    let config_json: any = {};
    if (cfgStr) {
      try { config_json = JSON.parse(cfgStr); } catch {}
    }
    if (!config_json.fields) config_json.fields = {};

    const { data, error } = await supabaseAdmin
      .from('certificate_templates')
      .insert({ name, course_id, storage_path: key, config_json, active: true })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao salvar template no banco:', error);
      return NextResponse.json({ error: 'Erro ao salvar template' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template: data });
  } catch (e) {
    console.error('Erro em upload template:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

