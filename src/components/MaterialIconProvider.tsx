'use client';

import React, { createContext, useContext, ReactNode, Children, isValidElement, cloneElement } from 'react';
import MaterialIcon from './MaterialIcon';

// Criar contexto para os ícones do Material Design
const MaterialIconContext = createContext<{
  getIcon: (name: string) => JSX.Element;
}>({
  getIcon: () => <></>,
});

// Hook para usar o contexto
export const useMaterialIcon = () => useContext(MaterialIconContext);

interface MaterialIconProviderProps {
  children: ReactNode;
}

// Lista de nomes de ícones do Material Design que precisam ser substituídos
// const materialIconNames = [
  // 'book', 'description', 'policy', 'calendar_today', 'newspaper',
  // 'receipt', 'payments', 'schedule', 'assessment', 'admin_panel_settings',
  // 'dashboard', 'people', 'person', 'settings', 'menu', 'close', 'logout',
  // 'layers', 'list', 'edit', 'image', 'check', 'alert', 'info', 'warning',
  // 'error', 'success'
// ];

/**
 * Função recursiva para processar os filhos e substituir tags de ícones
 */
const processChildren = (children: ReactNode): ReactNode => {
  return Children.map(children, child => {
    // Se for uma string, não tentar processá-la como um ícone
    if (typeof child === 'string') {
      return child;
    }

    // Se for um elemento React válido
    if (isValidElement(child)) {
      // Não tentamos mais substituir tags HTML diretamente
      // Em vez disso, apenas processamos os filhos recursivamente

      // Se tiver filhos, processar recursivamente
      if (child.props.children) {
        // Clone o elemento com os filhos processados
        return cloneElement(
          child,
          { ...child.props },
          processChildren(child.props.children)
        );
      }
    }

    // Caso contrário, retornar o filho sem modificações
    return child;
  });
};

/**
 * Provedor de ícones do Material Design
 * Este componente fornece uma função para obter ícones do Material Design
 * e substitui tags de ícones do Material Design por componentes React apropriados.
 */
export const MaterialIconProvider: React.FC<MaterialIconProviderProps> = ({ children }) => {
  // Função para obter um ícone do Material Design
  const getIcon = (name: string) => {
    return <MaterialIcon name={name} />;
  };

  // Processar os filhos para substituir tags de ícones
  const processedChildren = processChildren(children);

  return (
    <MaterialIconContext.Provider value={{ getIcon }}>
      {processedChildren}
    </MaterialIconContext.Provider>
  );
};

export default MaterialIconProvider;
