import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-auth';
import {
  canRequestCollaboratorCatalog,
  resolveCollaboratorDocuments,
} from '@/lib/document-catalog';
import type { CatalogViewer } from '@/lib/document-catalog/permissions';

export const dynamic = 'force-dynamic';

function isQhseOnlyParam(value: string | null): boolean {
  return value === '1' || value === 'true';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { id } = await context.params;
    const qhseOnly = isQhseOnlyParam(new URL(request.url).searchParams.get('qhse'));
    const viewer: CatalogViewer = {
      id: user.id,
      role: user.role,
      access_permissions: user.access_permissions,
    };

    if (!canRequestCollaboratorCatalog(viewer, { userId: id, qhseOnly })) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const result = await resolveCollaboratorDocuments({ userId: id, viewer, qhseOnly });
    if (!result) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
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
    console.error('[users/documents] GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar documentos' }, { status: 500 });
  }
}
