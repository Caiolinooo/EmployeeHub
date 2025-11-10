import { NextRequest, NextResponse } from 'next/server';
import { getActiveCodes, getLatestCode } from '@/lib/code-service';

export const dynamic = 'force-dynamic';

/**
 * API para visualizar códigos de verificação (apenas em ambiente de desenvolvimento)
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
  const identifier = searchParams.get('identifier');

  // Se tiver um identificador, retornar apenas o código mais recente para esse identificador
  if (identifier) {
    const code = getLatestCode(identifier);

    if (code) {
      return NextResponse.json({
        success: true,
        identifier,
        code
      });
    } else {
      return NextResponse.json(
        { error: 'Nenhum código ativo encontrado para este identificador' },
        { status: 404 }
      );
    }
  }

  // Caso contrário, retornar todos os códigos ativos
  const codes = getActiveCodes();

  // Verificar se há códigos expirados mas ainda ativos
  const now = new Date();
  const expiredCodes = codes.filter(c => now > c.expires && !c.used);

  // Verificar se há códigos que expiram em breve
  const expiringCodes = codes.filter(c => {
    const expiresIn = (c.expires.getTime() - now.getTime()) / 1000 / 60; // em minutos
    return expiresIn > 0 && expiresIn < 5 && !c.used; // expira em menos de 5 minutos
  });

  return NextResponse.json({
    success: true,
    count: codes.length,
    expiredCount: expiredCodes.length,
    expiringCount: expiringCodes.length,
    now: now.toISOString(),
    codes: codes.map(c => {
      const expiresIn = (c.expires.getTime() - now.getTime()) / 1000 / 60; // em minutos
      return {
        identifier: c.identifier,
        code: c.code,
        method: c.method,
        timestamp: c.timestamp,
        expires: c.expires,
        expiresIn: expiresIn > 0 ? `${Math.round(expiresIn)} minutos` : 'Expirado',
        isExpired: now > c.expires,
        used: c.used
      };
    })
  });
}
