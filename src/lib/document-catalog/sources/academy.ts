import { supabaseAdmin } from '@/lib/supabase';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'academy',
  label: 'Academia',
  qhseRestricted: false,
  collect: collectAcademyCertificates,
});

async function collectAcademyCertificates(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const userId = ctx.identity.userId;
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('academy_enrollments')
    .select(`
      id,
      user_id,
      course_id,
      completed_at,
      enrolled_at,
      course:academy_courses(id, title)
    `)
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(80);

  if (error || !data) return [];

  return data.map((row) => {
    const courseRaw = row.course as { id?: string; title?: string } | { id?: string; title?: string }[] | null;
    const course = Array.isArray(courseRaw) ? courseRaw[0] : courseRaw;
    return {
      id: `academy:${row.id}`,
      source: 'academy' as const,
      sourceLabel: 'Academia',
      title: `Certificado — ${course?.title || 'Curso'}`,
      subtitle: 'Gerado a partir da matrícula concluída',
      category: 'academy' as const,
      issuedAt: row.completed_at || row.enrolled_at,
      validUntil: null,
      status: 'concluido',
      signed: true,
      qhseRelated: false,
      recordId: row.id,
      moduleHref: '/academy/certificates',
      downloadKind: 'api' as const,
      downloadUrl: null,
      downloadApi: `/api/academy/certificates?generate=true&enrollment_id=${row.id}`,
      matchBy: ['user_id' as const],
    } satisfies CatalogDocument;
  });
}
