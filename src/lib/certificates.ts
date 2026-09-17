import { supabaseAdmin } from '@/lib/supabase';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

export type CertificateConfig = {
  page?: number;
  fields: Record<string, { x: number; y: number; size: number; color?: string; font?: string; align?: 'left' | 'center' | 'right'; maxWidth?: number; lineHeight?: number }>;
};

export async function ensureCertificatesBucket() {
  try {
    // Try to list to see if exists
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw error;
    const exists = (data || []).some(b => b.name === 'certificates');
    if (!exists) {
      // create (private)
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
    .select('id, user_id, completed_at, enrolled_at, course:academy_courses(id,title,duration,difficulty_level,instructor_id,instructor:users_unified(first_name,last_name,signature_url)) , user:users_unified(first_name,last_name,email)')
    .eq('id', enrollmentId)
    .single();
  if (enrErr || !enr) { console.error('enrollment not found', enrErr); return null; }

  const course = Array.isArray(enr.course) ? enr.course[0] : enr.course;
  const user = Array.isArray(enr.user) ? enr.user[0] : enr.user;
  const instructor = Array.isArray(course?.instructor) ? course.instructor[0] : course?.instructor;

  // Fetch modules for "Conteúdo Programático"
  const { data: modulesData } = await supabaseAdmin
    .from('academy_modules')
    .select('title, sort_order')
    .eq('course_id', course?.id || '')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  let content_programmatic = (modulesData || []).map(m => m.title).join('; ') + ((modulesData || []).length > 0 ? '.' : '');
  // Prevent super long text from overflowing the bottom of the page
  if (content_programmatic.length > 250) {
    content_programmatic = content_programmatic.substring(0, 247) + '...';
  }

  const tpl = await getActiveTemplate(course?.id);
  if (!tpl) { console.warn('No active certificate template found'); return null; }

  // Download template file from storage
  const { data: tplFile, error: dlErr } = await supabaseAdmin.storage.from('certificates').download(tpl.storage_path);
  if (dlErr || !tplFile) { console.error('Template download error', dlErr); return null; }
  const tplBytes = new Uint8Array(await tplFile.arrayBuffer());

  // Prepare data
  const student_name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  const course_title = course?.title || '';
  const durationHours = Math.max(1, Math.round((course?.duration || 0) / 3600));
  const course_duration = `${String(durationHours).padStart(2, '0')} horas`;
  const course_difficulty = (course?.difficulty_level || '').toString();
  const completion_date = enr.completed_at ? new Date(enr.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const enrollment_date = enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const certificate_id = `ABZ-${enrollmentId.toUpperCase().slice(0, 8)}`;
  const issue_date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const instructor_name = `${instructor?.first_name || ''} ${instructor?.last_name || ''}`.trim();

  const cfg: CertificateConfig = tpl.config_json as any;

  // Generate PDF by overlaying text
  const pdfDoc = await PDFDocument.load(tplBytes);
  const pageIndex = Math.max(0, (cfg.page || 1) - 1);
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  let customFontBlack;
  let customFontRegular;
  let customFontBlackItalic;
  let customFontPjsRegular;

  try {
    customFontRegular = await pdfDoc.embedFont(fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Merriweather-Regular.ttf')));
    customFontBlack = await pdfDoc.embedFont(fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Merriweather-Black.ttf')));
    customFontBlackItalic = await pdfDoc.embedFont(fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Merriweather-BlackItalic.ttf')));
    customFontPjsRegular = await pdfDoc.embedFont(fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'PlusJakartaSans-Regular.ttf')));
  } catch (e) {
    console.warn('Failed to load fonts from public/fonts, falling back to Helvetica', e);
    customFontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    customFontBlack = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    customFontBlackItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    customFontPjsRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const startX = 110;

  // 1. student_name
  page.drawText(student_name, {
    x: startX, y: 320, size: 30, font: customFontBlackItalic, color: parseColor('#000000')
  });

  // 2. course_title
  page.drawText(course_title, {
    x: startX, y: 280, size: 24, font: customFontRegular, color: parseColor('#000000') // Merriweather Regular, Esquerda
  });

  // 3. Texto abaixo
  const txtAbaixo = `Participou do treinamento realizado no dia ${completion_date}, com carga horária de ${course_duration}, através da modalidade presencial.`;
  page.drawText(txtAbaixo, {
    x: startX, y: 245, size: 14, font: customFontPjsRegular, color: parseColor('#333333'), maxWidth: 600, lineHeight: 22 // Plus Jakarta Sans 14px
  });

  // 4. Facilitador — Assinatura real + Nome
  // Render instructor handwritten signature above the name line
  const instructorSigUrl = (instructor as any)?.signature_url || null;
  if (instructorSigUrl && instructorSigUrl !== 'PASSKEY_SIGNED') {
    try {
      const sigResponse = await fetch(instructorSigUrl);
      const sigArrayBuf = await sigResponse.arrayBuffer();
      const sigUint8 = new Uint8Array(sigArrayBuf);
      const sigImage = await pdfDoc.embedPng(sigUint8);
      const sigWidth = 100;
      const sigHeight = 40;
      page.drawImage(sigImage, {
        x: 210 - (sigWidth / 2), // Centered above the name label
        y: 162,
        width: sigWidth,
        height: sigHeight,
      });
    } catch (sigErr) {
      console.warn('Failed to embed instructor signature on certificate:', sigErr);
    }
  }

  const textFacil = `${instructor_name} | Facilitador`;
  const wFacil = customFontRegular.widthOfTextAtSize(textFacil, 7);
  // Centered underneath the left-side signature line
  page.drawText(textFacil, {
    x: 210 - (wFacil / 2), y: 155, size: 7, font: customFontRegular, color: parseColor('#000000')
  });

  // 5. Conteúdo Programático
  page.drawText('Conteúdo Programático', {
    x: startX, y: 80, size: 10.5, font: customFontBlack, color: parseColor('#000000') // Merriweather Bold
  });

  if (content_programmatic) {
    page.drawText(content_programmatic, {
      x: startX, y: 65, size: 10.5, font: customFontPjsRegular, color: parseColor('#666666'), maxWidth: 600, lineHeight: 15 // Plus Jakarta Sans Normal
    });
  }

  // 6. ID do Certificado
  const wCert = customFontBlack.widthOfTextAtSize(certificate_id, 10);
  page.drawText(certificate_id, {
    x: page.getWidth() - startX - wCert, y: 30, size: 10, font: customFontBlack, color: parseColor('#999999')
  });

  // 7. QR Code de Validação
  try {
    const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.abz.com.br'}/academy/certificates/validate/${enrollmentId}`;
    const qrImageBuffer = await QRCode.toBuffer(qrUrl, { margin: 0, width: 200 });
    const qrImage = await pdfDoc.embedPng(qrImageBuffer);
    
    // Tamanho do QR Code no PDF
    const qrSize = 75; 
    page.drawImage(qrImage, {
      x: page.getWidth() - startX - qrSize,
      y: 45, // Acima do ID do certificado
      width: qrSize,
      height: qrSize,
    });
  } catch (err) {
    console.error('Failed to generate QR Code', err);
  }

  const pdfBytes = await pdfDoc.save();
  const outPath = `generated/${enrollmentId}.pdf`;
  await supabaseAdmin.storage.from('certificates').upload(outPath, pdfBytes, { contentType: 'application/pdf', upsert: true } as any);

  // Record issue
  const meta = { enrollment_id: enrollmentId, course_id: course?.id };
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
  } catch { }

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

    const defaultConfig: CertificateConfig = {
      page: 1,
      fields: {
        student_name: { x: 110, y: 320, size: 30, align: 'left', font: 'Merriweather-BlackItalic', color: '#000000' },
        course_title: { x: 110, y: 280, size: 24, align: 'left', font: 'Merriweather-Regular', color: '#000000' },
        full_text: { x: 110, y: 245, size: 14, align: 'left', font: 'PlusJakartaSans-Regular', color: '#333333', maxWidth: 600, lineHeight: 22 },
        instructor_name: { x: 420, y: 150, size: 7, align: 'center', font: 'Merriweather-Regular', color: '#000000' },
        content_programmatic_title: { x: 110, y: 80, size: 10.5, align: 'left', font: 'Merriweather-Black', color: '#666666' },
        content_programmatic: { x: 110, y: 65, size: 10.5, align: 'left', font: 'PlusJakartaSans-Regular', color: '#666666', maxWidth: 600, lineHeight: 15 },
        certificate_id: { x: 650, y: 30, size: 10, align: 'right', font: 'Merriweather-Black', color: '#999999' }
      }
    };

    // Upsert template row
    const { error } = await supabaseAdmin.from('certificate_templates').upsert({
      name: 'Padrão ABZ Esquerda (com full_text + PlusJakartaSans)',
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
