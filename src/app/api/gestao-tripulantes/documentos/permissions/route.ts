import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-auth';
import { canDeleteGtDocuments, canEditGtDocuments } from '@/lib/gestao-tripulantes/documento-permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const [canEdit, canDelete] = await Promise.all([
      canEditGtDocuments(user),
      canDeleteGtDocuments(user),
    ]);

    return NextResponse.json(
      {
        success: true,
        canEdit,
        canDelete,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('Erro ao verificar permissões de documentos GT:', error);
    return NextResponse.json({ error: 'Erro interno ao verificar permissões' }, { status: 500 });
  }
}
