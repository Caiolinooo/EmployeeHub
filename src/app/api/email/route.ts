import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail, sendInvitationEmail, testEmailConnection } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * API centralizada para funcionalidades de email
 * Esta API substitui as APIs individuais para cada função
 */

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json();

    // Verificar a ação solicitada
    switch (action) {
      case 'send-verification':
        // Enviar email de verificação
        if (!params.email || !params.code) {
          return NextResponse.json(
            { success: false, message: 'Email e código são obrigatórios' },
            { status: 400 }
          );
        }
        
        const verificationResult = await sendVerificationEmail(params.email, params.code);
        return NextResponse.json(verificationResult);

      case 'send-invitation':
        // Enviar email de convite
        if (!params.email || !params.inviteCode) {
          return NextResponse.json(
            { success: false, message: 'Email e código de convite são obrigatórios' },
            { status: 400 }
          );
        }
        
        const invitationResult = await sendInvitationEmail(params.email, params.inviteCode, params.name);
        return NextResponse.json(invitationResult);

      case 'test-connection':
        // Testar conexão com servidor de email
        const connectionResult = await testEmailConnection();
        return NextResponse.json(connectionResult);

      default:
        // Ação desconhecida
        return NextResponse.json(
          { success: false, message: 'Ação desconhecida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Obter parâmetros da URL
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Verificar a ação solicitada
    switch (action) {
      case 'test-connection':
        // Testar conexão com servidor de email
        const connectionResult = await testEmailConnection();
        return NextResponse.json(connectionResult);

      default:
        // Ação desconhecida
        return NextResponse.json(
          { success: false, message: 'Ação desconhecida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
