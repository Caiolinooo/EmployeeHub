import { NextRequest, NextResponse } from 'next/server';

// Rotas que não precisam de autenticação
const publicRoutes = [
  '/',
  '/login',
  '/set-password',
  '/api/auth/login',
  '/api/auth/login-password',
  '/api/auth/register',
  '/api/auth/register-supabase',
  '/api/auth/resend-code',
  '/api/auth/verify-token',
  '/api/auth/token-refresh',
  '/api/auth/fix-token',
  '/api/auth/ensure-admin',
];

// Rotas de arquivos estáticos
const staticRoutes = [
  '/_next/',
  '/images/',
  '/favicon.ico',
  '/robots.txt',
  '/fonts/',
  '/documentos/',
  '/public/',
  '/api/_next/',
];

// Rotas que precisam de permissão de administrador
const adminRoutes = [
  '/admin',
  '/admin/cards',
  '/admin/menu',
  '/admin/documents',
  '/admin/news',
  '/admin/users',
  '/admin/settings',
  '/admin/reimbursement-settings',
  '/api/admin',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Comentando o redirecionamento que causa loop infinito
  // if (pathname === '/admin') {
  //   console.log('Middleware: Redirecionando /admin para /admin/');
  //   return NextResponse.redirect(new URL('/admin/', request.url));
  // }

  // Verificar se é uma rota pública
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Verificar se é uma rota de arquivo estático
  for (const route of staticRoutes) {
    if (pathname.startsWith(route)) {
      return NextResponse.next();
    }
  }

  // Verificar se é uma rota de API pública
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/')
  ) {
    return NextResponse.next();
  }

  // Verificar se há um token nos cookies
  const token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;

  // Verificar se a URL contém um parâmetro de timestamp (t=...)
  if (request.nextUrl.searchParams.has('t')) {
    // Remover o parâmetro de timestamp para evitar loops de redirecionamento
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete('t');
    console.log('Middleware: Removendo parâmetro t para evitar loop de redirecionamento');
    return NextResponse.redirect(cleanUrl);
  }

  // Redirecionar rotas específicas para evitar problemas
  if (pathname === '/avaliacao/avaliacoes' || pathname === '/avaliacao/avaliacoes/') {
    console.log('Middleware: Redirecionando /avaliacao/avaliacoes para /avaliacao');
    return NextResponse.redirect(new URL('/avaliacao', request.url));
  }

  if (pathname === '/avaliacao/lista-avaliacoes' || pathname === '/avaliacao/lista-avaliacoes/') {
    console.log('Middleware: Redirecionando /avaliacao/lista-avaliacoes para /avaliacao');
    return NextResponse.redirect(new URL('/avaliacao', request.url));
  }

  if (pathname === '/avaliacao/nova-avaliacao' || pathname === '/avaliacao/nova-avaliacao/') {
    console.log('Middleware: Redirecionando /avaliacao/nova-avaliacao para /avaliacao (criação manual desabilitada)');
    return NextResponse.redirect(new URL('/avaliacao', request.url));
  }

  if (pathname === '/avaliacao/avaliacoes/lixeira' || pathname === '/avaliacao/avaliacoes/lixeira/') {
    console.log('Middleware: Redirecionando /avaliacao/avaliacoes/lixeira para /avaliacao/lixeira');
    return NextResponse.redirect(new URL('/avaliacao/lixeira', request.url));
  }

  // Verificar se é uma rota de avaliação e se não há token
  if (pathname.startsWith('/avaliacao')) {
    if (!token) {
      console.log('Middleware: Redirecionando para login (rota de avaliação sem token)');

      // Adicionar um parâmetro de redirecionamento para que o login saiba para onde voltar
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);

      return NextResponse.redirect(loginUrl);
    } else {
      console.log('Root Middleware: Token encontrado nos cookies, permitindo acesso à rota de avaliação');

      // Adicionar o token ao cabeçalho de autorização para que as APIs possam acessá-lo
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('Authorization', `Bearer ${token}`);

      // Adicionar também como cookie para garantir que esteja disponível
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Definir o cookie no response também
      response.cookies.set('abzToken', token, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });

      response.cookies.set('token', token, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });

      return response;
    }
  }

  // Para simplificar e evitar problemas com o Twilio, vamos permitir outras requisições
  // A autenticação será verificada nas rotas de API e páginas
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     *
     * Adicionando mais exceções para evitar problemas com rotas estáticas
     */
    '/((?!_next/static|_next/image|_next/data|favicon.ico|public|images|fonts|documentos|api/_next).*)',
  ],
};
