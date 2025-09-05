import { supabaseAdmin } from '@/lib/supabase';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export type CertificateConfig = {
  page?: number;
  fields: Record<string, { x: number; y: number; size: number; color?: string; font?: 'Helvetica' | 'TimesRoman' | 'Courier'; align?: 'left' | 'center' | 'right' }>;
};

export async function ensureCertificatesBucket() {
  try {
    // Try to list to see if exists
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw error;
    const exists = (data || []).some(b => b.name === 'certificates');
    if (!exists) {
      // create (private)
      // @ts-ignore - createBucket exists on supabase-js v2
      const { error: createErr } = await (supabaseAdmin.storage as any).createBucket('certificates', { public: false });
      if (createErr) console.warn('createBucket certificates error:', createErr);
    }
  } catch (e) {
    console.warn('ensureCertificatesBucket failed:', e);
  }
}

export async function getActiveTemplate(courseId?: string | null) {
  const { data: byCourse } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('active', true)
    .eq('course_id', courseId || '')
    .order('created_at', { ascending: false })
    .limit(1);
  if (byCourse && byCourse.length) return byCourse[0];

  const { data: global } = await supabaseAdmin
    .from('certificate_templates')
    .select('*')
    .eq('active', true)
    .is('course_id', null)
    .order('created_at', { ascending: false })
    .limit(1);
  return (global && global[0]) || null;
}

function parseColor(c?: string) {
  if (!c) return rgb(0, 0, 0);
  // accepts "#RRGGBB"
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(c);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

export async function generateAndStoreCertificate(enrollmentId: string): Promise<{ issueId: string; pdfPath: string; pdfBytes: Uint8Array; signedUrl?: string } | null> {
  await ensureCertificatesBucket();

  // Load enrollment + course + user
  const { data: enr, error: enrErr } = await supabaseAdmin
    .from('academy_enrollments')
    .select('id, user_id, completed_at, enrolled_at, course:academy_courses(id,title,duration,difficulty_level,instructor:users_unified(first_name,last_name)) , user:users_unified(first_name,last_name,email)')
    .eq('id', enrollmentId)
    .single();
  if (enrErr || !enr) { console.error('enrollment not found', enrErr); return null; }

  const tpl = await getActiveTemplate(enr.course?.id);
  if (!tpl) { console.warn('No active certificate template found'); return null; }

  // Download template file from storage
  const { data: tplFile, error: dlErr } = await supabaseAdmin.storage.from('certificates').download(tpl.storage_path);
  if (dlErr || !tplFile) { console.error('Template download error', dlErr); return null; }
  const tplBytes = new Uint8Array(await tplFile.arrayBuffer());

  // Prepare data
  const student_name = `${enr.user?.first_name || ''} ${enr.user?.last_name || ''}`.trim();
  const course_title = enr.course?.title || '';
  const course_duration = `${enr.course?.duration || 0} horas`;
  const course_difficulty = (enr.course?.difficulty_level || '').toString();
  const completion_date = enr.completed_at ? new Date(enr.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const enrollment_date = enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const certificate_id = `ABZ-${enrollmentId.toUpperCase().slice(0,8)}`;
  const issue_date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const instructor_name = `${enr.course?.instructor?.first_name || ''} ${enr.course?.instructor?.last_name || ''}`.trim();

  const cfg: CertificateConfig = tpl.config_json as any;

  // Generate PDF by overlaying text
  const pdfDoc = await PDFDocument.load(tplBytes);
  const pageIndex = Math.max(0, (cfg.page || 1) - 1);
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  const pickFont = (name?: string) => name === 'TimesRoman' ? times : name === 'Courier' ? courier : helv;

  const entries: Record<string,string> = {
    student_name,
    course_title,
    course_duration,
    course_difficulty,
    completion_date,
    enrollment_date,
    certificate_id,
    issue_date,
    instructor_name
  };

  Object.entries(cfg.fields || {}).forEach(([key, pos]) => {
    const val = (entries as any)[key];
    if (!val) return;
    const font = pickFont(pos.font);
    let x = pos.x;
    try {
      const w = font.widthOfTextAtSize(String(val), pos.size);
      if (pos.align === 'center') x = pos.x - w / 2;
      else if (pos.align === 'right') x = pos.x - w;
    } catch {}
    page.drawText(String(val), { x, y: pos.y, size: pos.size, font, color: parseColor(pos.color) });
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = `generated/${enrollmentId}.pdf`;
  await supabaseAdmin.storage.from('certificates').upload(outPath, pdfBytes, { contentType: 'application/pdf', upsert: true } as any);

  // Record issue
  const meta = { enrollment_id: enrollmentId, course_id: enr.course?.id };
  const { data: issue, error: insErr } = await supabaseAdmin
    .from('certificate_issues')
    .insert({ enrollment_id: enrollmentId, template_id: tpl.id, pdf_path: outPath, metadata: meta })
    .select('*')
    .single();
  if (insErr) { console.error('Failed to record certificate issue:', insErr); }

  // Signed URL (7 dias)
  let signedUrl: string | undefined = undefined;
  try {
    const { data: signed } = await supabaseAdmin.storage.from('certificates').createSignedUrl(outPath, 60 * 60 * 24 * 7);
    signedUrl = signed?.signedUrl;
  } catch {}

  return { issueId: issue?.id || '', pdfPath: outPath, pdfBytes, signedUrl };
}

// Helper to initialize default template from repo docs (one-time convenience)
export async function initTemplateFromRepoDefault() {
  try {
    await ensureCertificatesBucket();
    const src = path.join(process.cwd(), 'docs', 'Template Certificados.pdf');
    if (!fs.existsSync(src)) {
      return { ok: false, reason: 'Template Certificados.pdf não encontrado em docs/' };
    }
    const buf = fs.readFileSync(src);
    const storagePath = `templates/template-certificados.pdf`;
    await supabaseAdmin.storage.from('certificates').upload(storagePath, buf, { contentType: 'application/pdf', upsert: true } as any);

    // Default config (ajustável no Admin). Coordenadas exemplo; ajustar conforme necessário.
    const defaultConfig: CertificateConfig = {
      page: 1,
      fields: {
        student_name: { x: 200, y: 360, size: 24, font: 'TimesRoman' },
        course_title: { x: 200, y: 320, size: 16 },
        completion_date: { x: 200, y: 280, size: 12 },
        enrollment_date: { x: 200, y: 260, size: 12 },
        certificate_id: { x: 60, y: 80, size: 10 },
        instructor_name: { x: 420, y: 120, size: 12 }
      }
    };

    // Upsert template row
    const { error } = await supabaseAdmin.from('certificate_templates').upsert({
      name: 'Padrão ABZ (docs/Template Certificados.pdf)',
      storage_path: storagePath,
      config_json: defaultConfig,
      active: true
    }, { onConflict: 'name' } as any);

    if (error) return { ok: false, reason: 'Erro ao salvar template no banco' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

