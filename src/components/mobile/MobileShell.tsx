'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { SYSTEM_MODULES } from '@/config/modules';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileCompanion from './MobileCompanion';
import TouchButton from './TouchButton';

const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/ferias', label: 'Férias' },
] as const;

type MobileShellProps = {
  title: string;
  children: React.ReactNode;
  showCompanion?: boolean;
};

export default function MobileShell({ title, children, showCompanion = true }: MobileShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [maisOpen, setMaisOpen] = useState(false);
  const companionDefault = searchParams?.get('sheet') === 'companion';

  useEffect(() => {
    if (searchParams?.get('sheet') === 'mais') setMaisOpen(true);
  }, [searchParams]);

  const modules = useMemo(
    () =>
      SYSTEM_MODULES.filter((mod) => mod.visible !== false).map((mod) => ({
        key: mod.key,
        name: mod.name,
        href: mod.href || `/${mod.key}`,
        description: mod.description,
      })),
    [],
  );

  return (
    <div className="flex min-h-dvh flex-col abz-m-bg" data-abz-mobile-shell="">
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-[#005B96]">{title}</h1>
      </header>
      <main className="abz-m-main min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
      </main>
      <nav
        className="abz-m-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-gray-200 bg-white pb-safe"
        data-abz-mobile-nav=""
        aria-label="Navegação mobile"
      >
        {PRIMARY_NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`touch-target flex flex-col items-center justify-center text-xs font-semibold ${
                active ? 'text-[#005B96]' : 'text-gray-500'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <TouchButton
          variant="ghost"
          className="h-full rounded-none border-0 text-xs font-semibold text-gray-700"
          onClick={() => setMaisOpen(true)}
          data-abz-mobile-mais=""
        >
          Mais
        </TouchButton>
      </nav>
      <BottomSheet open={maisOpen} onClose={() => setMaisOpen(false)} title="Mais">
        <div className="flex flex-col gap-2" data-abz-mobile-mais-sheet="">
          {modules.map((mod) => (
            <DataCard key={mod.key} title={mod.name} subtitle={mod.description} meta={mod.href}>
              <Link href={mod.href} className="mt-2 inline-flex touch-target items-center text-sm font-semibold text-[#005B96]">
                Abrir
              </Link>
            </DataCard>
          ))}
        </div>
      </BottomSheet>
      {showCompanion ? <MobileCompanion defaultOpen={companionDefault} /> : null}
    </div>
  );
}
