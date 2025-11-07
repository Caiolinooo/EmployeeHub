import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCode } from '@/lib/verification';

export const dynamic = 'force-dynamic';

/**
 * API para envio de códigos de verificação
 */
export async function POST(request: NextRequest) {
  try {
    const { identifier, userId, method } = await request.json();

    if (!identifier || !userId) {
      return NextResponse.json(
        { success: false, message: 'Identificador e ID do usuário são obrigatórios' },
        { status: 400 }
      );
    }

    // Método padrão é SMS
    const verificationMethod = method || 'sms';

    const result = await sendVerificationCode(identifier, userId, verificationMethod);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação de envio de código:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao enviar código: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
