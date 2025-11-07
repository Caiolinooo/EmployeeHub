import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para envio de email de redefinição de senha
 */
export async function POST(request: NextRequest) {
  try {
    const { email, resetUrl } = await request.json();

    if (!email || !resetUrl) {
      return NextResponse.json(
        { success: false, message: 'Email e URL de redefinição são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await sendPasswordResetEmail(email, resetUrl);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação de redefinição de senha:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao enviar email de redefinição: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
