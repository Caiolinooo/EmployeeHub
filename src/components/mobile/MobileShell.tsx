'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FiCalendar, FiFileText, FiHome, FiMenu, FiMessageCircle } from 'react-icons/fi';
import BottomSheet from './BottomSheet';
import MobileCompanion from './MobileCompanion';
import TouchButton from './TouchButton';
import { PRIMARY_MOBILE_NAV, visibleMobileShortcuts } from './mobile-shortcuts';

type MobileShellProps = {
  title: string;
  children: React.ReactNode;
  showCompanion?: boolean;
};

function NavIcon({ icon }: { icon: (typeof PRIMARY_MOBILE_NAV)[number]['icon'] }) {
  switch (icon) {
    case 'home':
      return <FiHome aria-hidden className="h-5 w-5" />;
    case 'news':
      return <FiFileText aria-hidden className="h-5 w-5" />;
    case 'leave':
      return <FiCalendar aria-hidden className="h-5 w-5" />;
    default: {
      const _never: never = icon;
      return _never;
    }
  }
}

export default function MobileShell({ title, children, showCompanion = true }: MobileShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [maisOpen, setMaisOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(searchParams?.get('sheet') === 'companion');
  const modules = visibleMobileShortcuts();

  useEffect(() => {
    if (searchParams?.get('sheet') === 'mais') setMaisOpen(true);
    if (searchParams?.get('sheet') === 'companion') setCompanionOpen(true);
  }, [searchParams]);

  const maisActive = maisOpen;
  const homeActive = pathname === '/m' || pathname === '/m/';

  return (
    <div className="flex min-h-dvh flex-col abz-m-bg" data-abz-mobile-shell="">
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-[#005B96]">{title}</h1>
      </header>
      <main className="abz-m-main min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</main>
      <nav
        className="abz-m-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-gray-200 bg-white"
        data-abz-mobile-nav=""
        aria-label="Navegação mobile"
      >
        {PRIMARY_MOBILE_NAV.map((item) => {
          const active =
            item.href === '/m'
              ? homeActive
              : pathname === item.href || Boolean(pathname?.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`abz-m-nav-item ${active ? 'abz-m-nav-item-active' : ''}`}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <TouchButton
          variant="ghost"
          className={`abz-m-nav-item h-full rounded-none border-0 ${maisActive ? 'abz-m-nav-item-active' : ''}`}
          onClick={() => setMaisOpen(true)}
          data-abz-mobile-mais=""
          aria-expanded={maisOpen}
        >
          <FiMenu aria-hidden className="h-5 w-5" />
          <span>Mais</span>
        </TouchButton>
      </nav>
      <BottomSheet open={maisOpen} onClose={() => setMaisOpen(false)} title="Mais">
        <div className="flex flex-col gap-2" data-abz-mobile-mais-sheet="">
          {showCompanion ? (
            <TouchButton
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                setMaisOpen(false);
                setCompanionOpen(true);
              }}
              data-abz-mobile-mais-companion=""
            >
              <FiMessageCircle aria-hidden className="h-5 w-5" />
              Companion
            </TouchButton>
          ) : null}
          {modules.map((mod) => (
            <Link
              key={mod.key}
              href={mod.href}
              className="abz-m-card flex min-h-[64px] flex-col justify-center rounded-2xl bg-white px-4 py-3"
            >
              <span className="text-base font-semibold text-[#005B96]">{mod.name}</span>
              {mod.description ? <span className="text-sm text-gray-500">{mod.description}</span> : null}
            </Link>
          ))}
        </div>
      </BottomSheet>
      {showCompanion ? (
        <MobileCompanion open={companionOpen} onOpenChange={setCompanionOpen} />
      ) : null}
    </div>
  );
}
