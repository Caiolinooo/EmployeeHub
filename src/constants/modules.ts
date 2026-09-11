import {
  SYSTEM_MODULES as CATALOG_MODULES,
  type ModuleCategory,
  type ModuleDefinition,
} from '@/config/modules';

export interface SystemModule {
  id: string;
  label: string;
  description: string;
  category?: 'core' | 'hr' | 'content' | 'department';
  href: string;
  visible?: boolean;
}

function toSidebarCategory(category?: ModuleCategory): SystemModule['category'] {
  switch (category) {
    case 'system':
    case 'core':
      return 'core';
    case 'hr':
      return 'hr';
    case 'content':
      return 'content';
    case 'department':
    case 'business':
    case undefined:
      return 'department';
    default: {
      const _never: never = category;
      return _never;
    }
  }
}

export function toSidebarModule(mod: ModuleDefinition): SystemModule {
  return {
    id: mod.key,
    label: mod.name,
    description: mod.description || '',
    category: toSidebarCategory(mod.category),
    href: mod.href || `/${mod.key}`,
    visible: mod.visible,
  };
}

/** Sidebar / menu view of the live permission catalog (`src/config/modules.ts`). */
export const SYSTEM_MODULES: SystemModule[] = CATALOG_MODULES.map(toSidebarModule);

export const MODULE_CATEGORIES = {
  core: 'Geral',
  hr: 'Meu RH',
  content: 'Conteúdo e Conhecimento',
  department: 'Departamento',
};
