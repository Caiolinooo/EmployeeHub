'use client';

import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MobileShell from './MobileShell';
import { visibleMobileShortcuts } from './mobile-shortcuts';

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
      <div className="flex flex-col gap-3" data-abz-mobile-home="">
        <p className="text-sm text-gray-600">
          {isAuthenticated
            ? 'Atalhos dos módulos. Telas ainda sem versão mobile abrem no layout completo.'
            : 'Entre para usar o portal. Os atalhos abaixo abrem os módulos existentes.'}
        </p>
        {!isAuthenticated ? (
          <Link
            href="/login"
            className="touch-target inline-flex items-center justify-center rounded-xl bg-[#005B96] px-4 text-base font-semibold text-white"
          >
            Entrar
          </Link>
        ) : null}
        <ul className="flex flex-col gap-2">
          {shortcuts.map((mod) => (
            <li key={mod.key}>
              <Link
                href={mod.href}
                className="abz-m-card flex min-h-[64px] flex-col justify-center rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-base font-semibold text-[#005B96]">{mod.name}</span>
                {mod.description ? (
                  <span className="text-sm text-gray-500">{mod.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MobileShell>
  );
}
