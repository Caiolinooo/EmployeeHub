import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * Função principal para verificar token (compartilhada entre GET e POST)
 */
async function verifyTokenHandler(request: NextRequest) {
  try {
    // Verificar autenticação - tentar obter o token de várias fontes
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    // Log detalhado para depuração
    console.log('API verify-token: Cabeçalho de autorização:', authHeader ? 'Presente' : 'Ausente');
    console.log('API verify-token: Token extraído do cabeçalho:', token ? 'Presente' : 'Ausente');

    // Se não encontrou no cabeçalho, tentar nos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('API verify-token: Token encontrado nos cookies');
      }
    }

    // Se ainda não encontrou, verificar parâmetros de consulta (para compatibilidade)
    if (!token) {
      const url = new URL(request.url);
      token = url.searchParams.get('token');
      console.log('API verify-token: Token nos parâmetros de consulta:', token ? 'Presente' : 'Ausente');
    }

    if (!token) {
      console.error('API verify-token: Token não fornecido em nenhuma fonte');
      return NextResponse.json(
        { success: false, error: 'Não autorizado - Token não fornecido' },
        { status: 401 }
      );
    }

    console.log('API verify-token: Verificando token com comprimento:', token.length);

    try {
      // Verificar se o token é um JWT válido antes de tentar decodificá-lo
      let isValidJwt = false;
      try {
        const parts = token.split('.');
        isValidJwt = parts.length === 3;
        console.log('API verify-token: Token tem formato JWT válido:', isValidJwt);
      } catch (e) {
        console.error('API verify-token: Erro ao verificar formato do token:', e);
      }

      if (!isValidJwt) {
        console.error('API verify-token: Token não tem formato JWT válido');
        return NextResponse.json(
          { success: false, error: 'Token inválido - formato incorreto' },
          { status: 401 }
        );
      }

      // Verificar o token usando a função do lib/auth
      const payload = verifyToken(token);

      if (!payload) {
        console.error('API verify-token: Token inválido ou expirado (payload nulo)');

        // Tentar decodificar sem verificar para obter mais informações
        try {
          const decoded = jwt.decode(token);
          console.log('API verify-token: Token decodificado (sem verificação):', decoded);

          // Verificar se o token está expirado
          if (decoded && typeof decoded === 'object' && decoded.exp) {
            const expiryDate = new Date(decoded.exp * 1000);
            const now = new Date();
            if (expiryDate < now) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Token expirado em ${expiryDate.toISOString()}`,
                  expired: true
                },
                { status: 401 }
              );
            }
          }
        } catch (decodeError) {
          console.error('API verify-token: Erro ao decodificar token:', decodeError);
        }

        return NextResponse.json(
          { success: false, error: 'Token inválido ou expirado' },
          { status: 401 }
        );
      }

      console.log('API verify-token: Token válido para usuário:', payload.userId);
      console.log('API verify-token: Detalhes do payload:', {
        userId: payload.userId,
        role: payload.role,
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'não definido',
        iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'não definido'
      });

      return NextResponse.json({
        success: true,
        userId: payload.userId,
        role: payload.role,
        timestamp: new Date().toISOString()
      });
    } catch (verifyError) {
      console.error('Erro ao verificar payload do token:', verifyError);

      // Fornecer mensagem de erro mais detalhada
      let errorMessage = 'Erro ao verificar token';
      const errorDetails = '';

      if (verifyError instanceof Error) {
        errorMessage = verifyError.message;

        // Verificar se é um erro de expiração do JWT
        if (errorMessage.includes('expired')) {
          errorMessage = 'Token expirado';
        } else if (errorMessage.includes('invalid')) {
          errorMessage = 'Token inválido';
        }
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: errorDetails || (verifyError instanceof Error ? verifyError.message : String(verifyError)),
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Erro ao processar requisição de verificação de token:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota GET para verificar se um token é válido
 */
export async function GET(request: NextRequest) {
  return verifyTokenHandler(request);
}

/**
 * Rota POST para verificar se um token é válido
 */
export async function POST(request: NextRequest) {
  return verifyTokenHandler(request);
}
