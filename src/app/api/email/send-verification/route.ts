import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'Email e código são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await sendVerificationEmail(email, code);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação de envio de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao enviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
