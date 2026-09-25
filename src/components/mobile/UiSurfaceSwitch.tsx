'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isPhoneUserAgent, isTabletUserAgent } from '@/lib/mobile-ui/device-surface';

function readUiCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === 'ui') return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (isTabletUserAgent(ua)) return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  return isPhoneUserAgent(ua);
}

/**
 * Desktop: "Voltar para o mobile" só com cookie `ui=desktop` em aparelho móvel.
 * Sem cookie o desktop não ganha pixel.
 */
export default function UiSurfaceSwitch() {
  const pathname = usePathname();
  const [mode, setMode] = useState<'hidden' | 'back-to-mobile'>('hidden');

  useEffect(() => {
    const ui = readUiCookie();
    if (ui === 'desktop' && isMobileDevice()) {
      setMode('back-to-mobile');
      return;
    }
    setMode('hidden');
  }, [pathname]);

  if (mode === 'hidden') return null;

  const next = pathname && pathname.startsWith('/') ? pathname : '/login';
  return (
    <a
      href={`/api/ui-surface?to=mobile&next=${encodeURIComponent(next)}`}
      className="fixed abz-m-switch right-3 z-[70] rounded-full bg-[#005B96] px-3 py-2 text-sm font-semibold text-white shadow-lg"
      data-abz-ui-switch="back-to-mobile"
    >
      Voltar para o mobile
    </a>
  );
}
