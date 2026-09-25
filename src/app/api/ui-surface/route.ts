import { NextRequest, NextResponse } from 'next/server';
import { UI_COOKIE, parseUiCookie } from '@/lib/mobile-ui/device-surface';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/login';
  return value;
}

function applyCookie(request: NextRequest, to: string | undefined) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const dest = new URL(next, request.url);
  const response = NextResponse.redirect(dest);
  if (to === 'desktop' || to === 'mobile') {
    response.cookies.set(UI_COOKIE, to, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 180,
      secure: request.url.startsWith('https:'),
    });
  } else {
    response.cookies.set(UI_COOKIE, '', { path: '/', maxAge: 0 });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const to = parseUiCookie(request.nextUrl.searchParams.get('to'));
  return applyCookie(request, to);
}

export async function POST(request: NextRequest) {
  let to = parseUiCookie(request.nextUrl.searchParams.get('to'));
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as { to?: string } | null;
    to = parseUiCookie(body?.to) ?? to;
  }
  return applyCookie(request, to);
}
