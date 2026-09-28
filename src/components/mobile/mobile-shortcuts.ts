import { SYSTEM_MODULES } from '@/config/modules';

export type MobileShortcut = {
  key: string;
  name: string;
  href: string;
  description: string;
};

export function visibleMobileShortcuts(): MobileShortcut[] {
  return SYSTEM_MODULES.filter((mod) => mod.visible !== false).map((mod) => ({
    key: mod.key,
    name: mod.name,
    href: mod.href || `/${mod.key}`,
    description: mod.description || '',
  }));
}

export const PRIMARY_MOBILE_NAV = [
  { href: '/m', label: 'Home', icon: 'home' as const },
  { href: '/noticias', label: 'Notícias', icon: 'news' as const },
  { href: '/ferias', label: 'Férias', icon: 'leave' as const },
] as const;
