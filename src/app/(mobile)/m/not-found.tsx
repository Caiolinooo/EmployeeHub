'use client';

import { usePathname } from 'next/navigation';
import { stripMobilePrefix } from '@/lib/mobile-ui/device-surface';

/** Só o segmento `/m`. `notFound()` daqui não altera `src/app/not-found.tsx`. */
export default function MobileSegmentNotFound() {
  const pathname = usePathname() || '/m';
  const dest = stripMobilePrefix(pathname);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
      <p className="text-center text-sm text-gray-600">Esta tela ainda não tem versão mobile.</p>
      <a
        href={dest}
        className="touch-target inline-flex items-center justify-center font-semibold text-[#005B96]"
        data-abz-ui-switch="full-desktop"
      >
        Ver versão completa
      </a>
    </div>
  );
}
