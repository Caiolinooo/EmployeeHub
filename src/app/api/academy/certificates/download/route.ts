import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAcademyAuth } from '@/lib/middleware/academy-auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await withAcademyAuth(request, { requireAuth: true });
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const issueId = searchParams.get('issue_id');
    if (!issueId) return NextResponse.json({ error: 'issue_id \'\'e9 obrigat\'\'orio' }, { status: 400 });

    const { data: issue, error: issueErr } = await supabaseAdmin
      .from('certificate_issues')
      .select('id, pdf_path, enrollment:academy_enrollments(id, user_id)')
      .eq('id', issueId)
      .single();

    if (issueErr || !issue) return NextResponse.json({ error: 'Certificado n\u00e3o encontrado' }, { status: 404 });

    // permiss\u00e3o: dono do enrollment ou admin/editor
    const enrollment = issue.enrollment as any;
    if (enrollment?.user_id !== user?.id && !user?.canEditAcademy && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const path = issue.pdf_path as string;
    const { data: signed, error: signErr } = await supabaseAdmin.storage.from('certificates').createSignedUrl(path, 60 * 15);
    if (signErr || !signed?.signedUrl) return NextResponse.json({ error: 'Falha ao gerar link' }, { status: 500 });

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (e) {
    console.error('Erro em download de certificado:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

