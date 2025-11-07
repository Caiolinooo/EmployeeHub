import { NextRequest, NextResponse } from 'next/server';
import { registerCode, getActiveCodes, getLatestCode } from '@/lib/code-service';

export const dynamic = 'force-dynamic';

/**
 * API para testar a geração de códigos de verificação (apenas em ambiente de desenvolvimento)
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

  // Gerar um código para o email
  console.log(`Gerando código para ${email}...`);
  const { code, expires } = registerCode(email, 'email');
  
  // Verificar se o código foi registrado corretamente
  const activeCodes = getActiveCodes();
  const latestCode = getLatestCode(email);
  
  return NextResponse.json({
    success: true,
    email,
    code,
    expires,
    latestCode,
    activeCodes,
    debugUrl: 'http://localhost:3000/debug/codes'
  });
}
