import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { i18n } from '@/i18n/config';

export function middleware(request: NextRequest) {
  // Obter o locale do cookie ou usar o padrão pt-BR
  const locale = request.cookies.get('NEXT_LOCALE')?.value || i18n.defaultLocale;

  // Add locale to response headers for client-side access
  const response = NextResponse.next();
  response.headers.set('x-locale', locale);

  // Definir o locale como variável global para acesso no cliente
  response.cookies.set('NEXT_LOCALE', locale);

  // A verificação de token foi movida para getServerSideProps nas páginas de avaliação
  // para evitar conflitos de roteamento com o middleware.
  /*
  // Verificar se é uma rota de avaliação e se não há token
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/avaliacao')) {
    // Verificar token nos cookies
    const token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;

    if (!token) {
      console.log('Root Middleware: Redirecionando para login (rota de avaliação sem token)');

      // Adicionar um parâmetro de redirecionamento para que o login saiba para onde voltar
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);

      return NextResponse.redirect(loginUrl);
    } else {
      console.log('Root Middleware: Token encontrado nos cookies, permitindo acesso à rota de avaliação');
    }
  }
  */

  return response;
}

// Configurar quais caminhos devem ser processados pelo middleware
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
