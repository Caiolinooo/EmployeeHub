'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { IconType } from 'react-icons';
import { useI18n } from '@/contexts/I18nContext';

// Import dinâmico para otimizar bundle size
const loadIcon = async (iconName: string): Promise<IconType | null> => {
  try {
    const iconModule = await import('react-icons/fi');
    const IconComponent = iconModule[iconName as keyof typeof iconModule] as IconType;
    return IconComponent || null;
  } catch (error) {
    console.warn(t('components.erroAoCarregarIconeIconname'), error);
    return null;
  }
};

// Componente de fallback
const IconFallback = () => (
  <div className="inline-block w-5 h-5 bg-gray-300 rounded animate-pulse" />
);

interface MaterialDesignIconProps {
  iconName: string;
  className?: string;
  size?: number;
  color?: string;
}

/**
 * A component that safely renders Material Design icons using Feather icons
 * This is the recommended way to use Material Design icons in your React components
 * 
 * Example usage:
 * <MaterialDesignIcon name="book" />
 * <MaterialDesignIcon name="description" size={24} color="blue" />
 */
const MaterialDesignIcon: React.FC<MaterialDesignIconProps> = ({
  iconName,
  className = '',
  size = 24,
  color
}) => {
  const [IconComponent, setIconComponent] = useState<IconType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIcon(iconName).then(component => {
      setIconComponent(component);
      setLoading(false);
    });
  }, [iconName]);

  if (loading) {
    return <IconFallback />;
  }

  if (!IconComponent) {
    // Fallback para ícone não encontrado
    const FallbackIcon = lazy(() => import('react-icons/fi').then(mod => ({ default: mod.FiHelpCircle })));
    return (
      <Suspense fallback={<IconFallback />}>
        <FallbackIcon className={className} size={size} color={color} />
      </Suspense>
    );
  }

  return <IconComponent className={className} size={size} color={color} />;
};

export default MaterialDesignIcon;
