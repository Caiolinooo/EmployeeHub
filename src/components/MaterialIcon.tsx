'use client';

import React, { lazy, Suspense } from 'react';
import { useI18n } from '@/contexts/I18nContext';
// import { IconType } from 'react-icons';

// Import dinâmico de ícones específicos para reduzir bundle size
const iconComponents = {
  // Ícones essenciais para o sistema
  book: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiBookOpen }))),
  description: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiFileText }))),
  policy: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiShield }))),
  calendar_today: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiCalendar }))),
  newspaper: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiRss }))),
  receipt: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiFileText }))),
  payments: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiDollarSign }))),
  schedule: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiClock }))),
  assessment: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiBarChart2 }))),
  admin_panel_settings: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiSettings }))),
  
  // Outros ícones comuns
  dashboard: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiGrid }))),
  people: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiUsers }))),
  person: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiUser }))),
  settings: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiSettings }))),
  menu: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiMenu }))),
  close: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiX }))),
  logout: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiLogOut }))),
  layers: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiLayers }))),
  list: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiList }))),
  edit: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiEdit }))),
  image: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiImage }))),
  check: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiCheck }))),
  alert: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiAlertCircle }))),
  info: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiInfo }))),
  warning: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiAlertCircle }))),
  error: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiAlertCircle }))),
  success: lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiCheck }))),
};

// Componente de fallback
const IconFallback = () => (
  <div className="inline-block w-5 h-5 bg-gray-300 rounded animate-pulse" />
);

interface MaterialIconProps {
  name: string;
  className?: string;
  size?: number;
  color?: string;
}

const MaterialIcon: React.FC<MaterialIconProps> = ({ 
  name, 
  className = '', 
  size, 
  color 
}) => {
  // Verificar se o ícone existe no mapeamento
  const IconComponent = iconComponents[name as keyof typeof iconComponents];
  
  // Se o ícone não existir, usar um ícone padrão carregado dinamicamente
  if (!IconComponent) {
    console.warn(t('components.icone')${name}{t('components.naoEncontradoUsandoIconePadrao')});
    const DefaultIcon = lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiHelpCircle })));
    return (
      <Suspense fallback={<IconFallback />}>
        <DefaultIcon className={className} size={size} color={color} />
      </Suspense>
    );
  }
  
  // Renderizar o ícone com carregamento lazy
  return (
    <Suspense fallback={<IconFallback />}>
      <IconComponent className={className} size={size} color={color} />
    </Suspense>
  );
};

export default MaterialIcon;
