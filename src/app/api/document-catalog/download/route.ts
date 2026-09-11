import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateFichaEPIBytes } from '@/lib/pdf/generateEPIChecklist';
import { getUserEPIRegistrations } from '@/services/epiService';
import {
  canDownloadCatalogSource,
  isDocumentCatalogSourceId,
  resolveCollaboratorIdentity,
} from '@/lib/document-catalog';
import type { CatalogViewer } from '@/lib/document-catalog/permissions';
import type { DocumentCatalogSourceId } from '@/lib/document-catalog/types';
import { isQhseRelatedText } from '@/lib/document-catalog/qhse';

export const dynamic = 'force-dynamic';

function fileResponse(bytes: Uint8Array, filename: string, contentType: string): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function redirectIfHttp(url: string | null | undefined): Promise<NextResponse | null> {
  if (url && /^https?:\/\//i.test(url)) {
    return NextResponse.redirect(url, { status: 302 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sourceRaw = searchParams.get('source') || '';
    const recordId = searchParams.get('recordId') || '';
    if (!isDocumentCatalogSourceId(sourceRaw) || !recordId) {
      return NextResponse.json({ error: 'source e recordId são obrigatórios' }, { status: 400 });
    }
    const source: DocumentCatalogSourceId = sourceRaw;

    const viewer: CatalogViewer = {
      id: user.id,
      role: user.role,
      access_permissions: user.access_permissions,
    };

    switch (source) {
      case 'epi': {
        const isFicha = recordId.startsWith('ficha:');
        const subjectUserId = isFicha ? recordId.slice('ficha:'.length) : null;
        let ownerId = subjectUserId;
        if (!ownerId) {
          const { data: reg } = await supabaseAdmin
            .from('epi_registrations')
            .select('user_id, signature_url')
            .eq('id', recordId)
            .maybeSingle();
          ownerId = reg?.user_id || null;
          if (!canDownloadCatalogSource(viewer, source, true, ownerId)) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
          }
          const redirected = await redirectIfHttp(reg?.signature_url);
          if (redirected) return redirected;
          return NextResponse.json({ error: 'Arquivo não disponível' }, { status: 404 });
        }
        if (!canDownloadCatalogSource(viewer, source, true, ownerId)) {
          return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }
        const identity = await resolveCollaboratorIdentity({ userId: ownerId });
        const regs = await getUserEPIRegistrations(ownerId);
        const signed = regs.find((r) => r.signature_url);
        const { bytes, filename } = await generateFichaEPIBytes({
          employeeName: identity?.fullName || 'Colaborador',
          employeePosition: identity?.position || '',
          employeeProject: identity?.department || '',
          registrations: regs,
          signatureUrl: signed?.signature_url,
          signatureDate: signed?.signed_at || undefined,
        });
        return fileResponse(bytes, filename, 'application/pdf');
      }
      case 'gt': {
        const { data: doc } = await supabaseAdmin
          .from('gt_documentos')
          .select('id, colaborador_id, arquivo_url, arquivo_path, titulo')
          .eq('id', recordId)
          .is('deleted_at', null)
          .maybeSingle();
        if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
        const identity = await resolveCollaboratorIdentity({ colaboradorId: doc.colaborador_id });
        if (!canDownloadCatalogSource(viewer, source, false, identity?.userId || null)) {
          return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }
        if (doc.arquivo_path) {
          const { data: fileData, error: storageErr } = await supabaseAdmin.storage
            .from('gestao-tripulantes-documentos')
            .download(doc.arquivo_path);
          if (!storageErr && fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            return fileResponse(new Uint8Array(buffer), `${doc.titulo || 'documento'}.pdf`, 'application/pdf');
          }
        }
        const redirected = await redirectIfHttp(doc.arquivo_url);
        if (redirected) return redirected;
        return NextResponse.json({ error: 'Arquivo não disponível' }, { status: 404 });
      }
      case 'lista_presenca': {
        const { data: row } = await supabaseAdmin
          .from('registros_presenca')
          .select('id, user_id, assinatura_url, lista_id')
          .eq('id', recordId)
          .maybeSingle();
        if (!row) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
        let qhse = false;
        if (row.lista_id) {
          const { data: lista } = await supabaseAdmin
            .from('lista_presenca')
            .select('titulo, pauta, local')
            .eq('id', row.lista_id)
            .maybeSingle();
          qhse = isQhseRelatedText(lista?.titulo, lista?.pauta, lista?.local);
        }
        if (!canDownloadCatalogSource(viewer, source, qhse, row.user_id)) {
          return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }
        const redirected = await redirectIfHttp(row.assinatura_url);
        if (redirected) return redirected;
        return NextResponse.json({ error: 'Assinatura não disponível' }, { status: 404 });
      }
      case 'assinatura': {
        if (!canDownloadCatalogSource(viewer, source, false, recordId)) {
          return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }
        const { data } = await supabaseAdmin
          .from('users_unified')
          .select('signature_url')
          .eq('id', recordId)
          .maybeSingle();
        const redirected = await redirectIfHttp(data?.signature_url);
        if (redirected) return redirected;
        return NextResponse.json({ error: 'Assinatura não cadastrada' }, { status: 404 });
      }
      case 'contratos': {
        const { data: row } = await supabaseAdmin
          .from('solicitacoes_assinatura')
          .select('id, colaborador_id, documento:documentos_trabalhistas!documento_id(arquivo_url)')
          .eq('id', recordId)
          .maybeSingle();
        if (!row) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 });
        if (!canDownloadCatalogSource(viewer, source, false, row.colaborador_id)) {
          return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }
        const docRaw = row.documento as { arquivo_url?: string } | { arquivo_url?: string }[] | null;
        const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;
        const redirected = await redirectIfHttp(doc?.arquivo_url);
        if (redirected) return redirected;
        return NextResponse.json({ error: 'Arquivo não disponível' }, { status: 404 });
      }
      case 'academy':
      case 'ferias':
      case 'reembolso': {
        return NextResponse.json({
          error: 'Use o link do módulo original para este documento',
          open: source === 'academy'
            ? `/api/academy/certificates?generate=true&enrollment_id=${recordId}`
            : source === 'ferias'
              ? `/api/leave/${recordId}/pdf`
              : '/reembolso',
        }, { status: 409 });
      }
      default: {
        const _exhaustive: never = source;
        return NextResponse.json({ error: `Fonte não suportada: ${_exhaustive}` }, { status: 400 });
      }
    }
  } catch (err) {
    console.error('[document-catalog/download] error:', err);
    return NextResponse.json({ error: 'Erro ao baixar documento' }, { status: 500 });
  }
}
