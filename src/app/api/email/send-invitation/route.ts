import { NextRequest, NextResponse } from 'next/server';
import { sendInvitationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, inviteCode, name } = await request.json();

    if (!email || !inviteCode) {
      return NextResponse.json(
        { success: false, message: 'Email e código de convite são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await sendInvitationEmail(email, inviteCode, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação de envio de convite:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao enviar convite: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
