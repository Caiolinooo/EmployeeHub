import { NextRequest, NextResponse } from 'next/server';
import { stripMobilePrefix } from '@/lib/mobile-ui/device-surface';

export const dynamic = 'force-dynamic';

/** `/m/rota-inexistente` → equivalente desktop. Não cobre `/m`, `/m/login`, `/m/preview`. */
function toDesktop(request: NextRequest) {
  const dest = stripMobilePrefix(request.nextUrl.pathname);
  const url = request.nextUrl.clone();
  url.pathname = dest;
  return NextResponse.redirect(url, 307);
}

export function GET(request: NextRequest) {
  return toDesktop(request);
}

export function HEAD(request: NextRequest) {
  return toDesktop(request);
}
