import { NextRequest, NextResponse } from 'next/server';
import { registerCode, getActiveCodes, getLatestCode } from '@/lib/code-service';
import { sendVerificationEmail } from '@/lib/email-service';

/**
 * API para testar o envio de códigos de verificação (apenas em ambiente de desenvolvimento)
 */
export async function GET(request: NextRequest) {
  // Verificar se estamos em ambiente de desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Esta API só está disponível em ambiente de desenvolvimento' },
      { status: 403 }
    );
  }

  // Obter parâmetros da URL
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email') || 'test@example.com';

  try {
    // Gerar um código para o email
    console.log(`Gerando código para ${email}...`);
    const { code, expires } = registerCode(email, 'email');

    // Verificar se o código foi registrado corretamente
    const activeCodes = getActiveCodes();
    const latestCode = getLatestCode(email);

    // Enviar o código por email
    console.log(`Enviando código ${code} por email para ${email}...`);
    const emailResult = await sendVerificationEmail(email, code);

    return NextResponse.json({
      success: true,
      email,
      code,
      expires,
      latestCode,
      emailSent: emailResult.success,
      previewUrl: (emailResult as any).previewUrl,
      activeCodes,
      debugUrl: 'http://localhost:3000/debug/codes'
    });
  } catch (error) {
    console.error('Erro ao testar verificação:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
