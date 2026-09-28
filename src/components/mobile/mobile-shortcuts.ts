import { SYSTEM_MODULES } from '@/config/modules';
import { isMobileImplemented } from '@/lib/mobile-ui/device-surface';

export type MobileShortcut = {
  key: string;
  name: string;
  href: string;
  description: string;
};

/** Atalhos apontam para `/m/*` quando a rota tem front mobile; senão desktop (fallback). */
export function visibleMobileShortcuts(): MobileShortcut[] {
  return SYSTEM_MODULES.filter((mod) => mod.visible !== false).map((mod) => {
    const publicHref = mod.href || `/${mod.key}`;
    return {
      key: mod.key,
      name: mod.name,
      href: isMobileImplemented(publicHref) ? `/m${publicHref}` : publicHref,
      description: mod.description || '',
    };
  });
}

export const PRIMARY_MOBILE_NAV = [
  { href: '/m', label: 'Home', icon: 'home' as const },
  { href: '/m/noticias', label: 'Notícias', icon: 'news' as const },
  { href: '/m/ferias', label: 'Férias', icon: 'leave' as const },
] as const;
