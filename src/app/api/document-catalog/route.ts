import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-auth';
import {
  canRequestCollaboratorCatalog,
  canViewCollaboratorCatalog,
  isAdminOrManager,
  resolveCollaboratorDocuments,
} from '@/lib/document-catalog';
import { hasFeaturePermission } from '@/lib/permissions';
import type { CatalogViewer } from '@/lib/document-catalog/permissions';

export const dynamic = 'force-dynamic';

function isQhseOnlyParam(value: string | null): boolean {
  return value === '1' || value === 'true';
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const colaboradorId = searchParams.get('colaboradorId');
    const qhseOnly = isQhseOnlyParam(searchParams.get('qhse'));

    if (!userId && !colaboradorId) {
      return NextResponse.json({ error: 'Informe userId ou colaboradorId' }, { status: 400 });
    }

    const viewer: CatalogViewer = {
      id: user.id,
      role: user.role,
      access_permissions: user.access_permissions,
    };

    if (!canRequestCollaboratorCatalog(viewer, { userId, colaboradorId, qhseOnly })) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const result = await resolveCollaboratorDocuments({
      userId,
      colaboradorId,
      viewer,
      qhseOnly,
    });

    if (!result) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const allowedFullSubject =
      !result.identity.userId ||
      canViewCollaboratorCatalog(viewer, result.identity.userId) ||
      isAdminOrManager(viewer) ||
      hasFeaturePermission(viewer, 'gestao-tripulantes.view');
    if (!qhseOnly && !allowedFullSubject) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      identity: {
        userId: result.identity.userId,
        colaboradorId: result.identity.colaboradorId,
        fullName: result.identity.fullName,
        matchedByCpf: !!result.identity.cpfDigits,
        matchedByEmail: !!result.identity.email,
      },
      documents: result.documents,
      sources: result.sources,
      total: result.documents.length,
    });
  } catch (err) {
    console.error('[document-catalog] GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar documentos' }, { status: 500 });
  }
}
