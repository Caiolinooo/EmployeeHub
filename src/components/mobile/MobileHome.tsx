'use client';

import Link from 'next/link';
import { FiCalendar, FiClock, FiDollarSign, FiFileText } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MobileShell from './MobileShell';
import { visibleMobileShortcuts } from './mobile-shortcuts';

/** Ações do dia a dia do colaborador — grid 2×2 acima do carrossel. */
const QUICK_ACTIONS = [
  { href: '/noticias', label: 'Notícias', Icon: FiFileText },
  { href: '/ferias', label: 'Férias', Icon: FiCalendar },
  { href: '/reembolso', label: 'Reembolso', Icon: FiDollarSign },
  { href: '/ponto', label: 'Ponto', Icon: FiClock },
] as const;

function moduleInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '•';
}

export default function MobileHome() {
  const { profile, isAuthenticated } = useSupabaseAuth();
  const first = profile?.first_name || '';
  const greeting = isAuthenticated
    ? first
      ? `Olá, ${first}`
      : 'Olá'
    : 'Portal ABZ';
  const shortcuts = visibleMobileShortcuts();

  return (
    <MobileShell title={greeting}>
      <div className="flex flex-col gap-5" data-abz-mobile-home="">
        {!isAuthenticated ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Entre para usar o portal. Os atalhos abaixo abrem os módulos existentes.
            </p>
            <Link
              href="/login"
              className="touch-target inline-flex items-center justify-center rounded-xl bg-[#005B96] px-4 text-base font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        ) : null}

        <section aria-label="Acesso rápido" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Acesso rápido
          </h2>
          <div className="grid grid-cols-2 gap-3" data-abz-mobile-quick="">
            {QUICK_ACTIONS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="touch-target flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f1f8] text-[#005B96]">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-gray-800">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-label="Todos os módulos" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Módulos
          </h2>
          <div className="abz-m-carousel" data-abz-mobile-carousel="" role="list">
            {shortcuts.map((mod) => (
              <Link
                key={mod.key}
                href={mod.href}
                role="listitem"
                className="abz-m-carousel-card flex min-h-[76px] items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#005B96] text-sm font-bold text-white"
                >
                  {moduleInitial(mod.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#005B96]">
                    {mod.name}
                  </span>
                  {mod.description ? (
                    <span className="block truncate text-xs text-gray-500">
                      {mod.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Deslize para o lado. Telas sem versão mobile abrem no layout completo.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}
