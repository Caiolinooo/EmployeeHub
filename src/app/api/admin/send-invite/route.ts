import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, handleApiError } from '@/lib/api-utils';
import { sendInviteWithRegisterLinkEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// POST /api/admin/send-invite
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação e autorização
    const authResult = await verifyAuth(request, true); // true = requer admin

    if (authResult.error) {
      return authResult.error;
    }

    const { user } = authResult;

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { email, inviteCode, expiresAt, maxUses } = body;

    // Validar dados
    if (!email || !inviteCode) {
      return NextResponse.json(
        { error: 'Email e código de convite são obrigatórios' },
        { status: 400 }
      );
    }

    // Converter expiresAt para Date se for string
    const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;

    // Enviar email com código de convite
    const result = await sendInviteWithRegisterLinkEmail(
      email,
      inviteCode,
      expiryDate,
      maxUses || 1
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Convite enviado com sucesso para ${email}`,
      previewUrl: result.previewUrl
    });
  } catch (error) {
    console.error('Erro ao enviar convite:', error);
    return handleApiError(error);
  }
}
