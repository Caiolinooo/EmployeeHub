'use client';

import React, { useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import { IconType } from 'react-icons';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente que transforma tags de ícones do Material Design em componentes React
 * Este componente é usado para resolver problemas com tags de ícones não reconhecidas
 */
const IconTransformer: React.FC = () => {
  useEffect(() => {
    // Verificar se o documento está disponível (client-side)
    if (typeof document === 'undefined') {
      return;
    }

    // Mapeamento de nomes de ícones do Material Design para ícones do react-icons/fi
    const iconMap: Record<string, IconType> = {
      // Ícones mencionados nos erros
      book: FiIcons.FiBookOpen,
      description: FiIcons.FiFileText,
      policy: FiIcons.FiShield,
      calendar_today: FiIcons.FiCalendar,
      newspaper: FiIcons.FiRss,
      receipt: FiIcons.FiFileText,
      payments: FiIcons.FiDollarSign,
      schedule: FiIcons.FiClock,
      assessment: FiIcons.FiBarChart2,
      admin_panel_settings: FiIcons.FiSettings,

      // Outros ícones comuns que podem ser usados
      dashboard: FiIcons.FiGrid,
      people: FiIcons.FiUsers,
      person: FiIcons.FiUser,
      settings: FiIcons.FiSettings,
      menu: FiIcons.FiMenu,
      close: FiIcons.FiX,
      logout: FiIcons.FiLogOut,
      layers: FiIcons.FiLayers,
      list: FiIcons.FiList,
      edit: FiIcons.FiEdit,
      image: FiIcons.FiImage,
      check: FiIcons.FiCheck,
      alert: FiIcons.FiAlertCircle,
      info: FiIcons.FiInfo,
      warning: FiIcons.FiAlertCircle,
      error: FiIcons.FiAlertCircle,
      success: FiIcons.FiCheck,
    };

    // Lista de nomes de ícones do Material Design que precisam ser substituídos
    const materialIconNames = Object.keys(iconMap);

    // Função para criar um elemento de ícone
    const createIconElement = (iconName: string) => {
      const span = document.createElement('span');
      span.className = 'material-icon-replacement';

      // Usar a classe material-icons para renderizar o ícone
      const iconElement = document.createElement('span');
      iconElement.className = 'material-icons';
      iconElement.textContent = iconName;

      span.appendChild(iconElement);
      return span;
    };

    // Função para substituir tags de ícones por componentes React
    // Usando uma abordagem mais segura que não manipula o DOM diretamente
    const replaceIconTags = () => {
      // Em vez de manipular o DOM diretamente, vamos apenas registrar os ícones que precisam ser substituídos
      // e deixar que o React cuide da renderização
      console.log({t('components.registrandoIconesParaSubstituicao')}, materialIconNames);
      
      // Essa abordagem é mais segura e evita conflitos com o React
      // Não vamos mais tentar substituir tags HTML diretamente
    };

    // Função para verificar se um elemento é uma tag de ícone
    const isIconTag = (element: Element): boolean => {
      return materialIconNames.includes(element.tagName.toLowerCase());
    };

    // Função para verificar se um nó contém tags de ícones
    const containsIconTags = (node: Node): boolean => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;

      const element = node as Element;
      if (isIconTag(element)) return true;

      // Verificar filhos recursivamente
      for (let i = 0; i < element.children.length; i++) {
        if (containsIconTags(element.children[i])) return true;
      }

      return false;
    };

    // Função para executar a substituição com retry
    const executeReplaceWithRetry = () => {
      try {
        replaceIconTags();

        // Programar outra verificação após um curto período para garantir que todos os ícones sejam substituídos
        setTimeout(() => {
          // Verificar se ainda existem tags de ícones não substituídas
          let needsAnotherReplace = false;
          materialIconNames.forEach(iconName => {
            if (document.getElementsByTagName(iconName).length > 0) {
              needsAnotherReplace = true;
            }
          });

          if (needsAnotherReplace) {
            replaceIconTags();
          }
        }, 500);
      } catch (error) {
        console.error({t('components.erroAoSubstituirIcones')}, error);
      }
    };

    // Executar a substituição após o carregamento da página
    // Usar um timeout maior para garantir que o DOM esteja completamente carregado
    setTimeout(executeReplaceWithRetry, 100);

    // Executar a substituição novamente quando o DOM for modificado
    const observer = new MutationObserver(mutations => {
      let shouldReplace = false;

      // Verificar se alguma mutação adicionou tags de ícones
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (containsIconTags(node)) {
              shouldReplace = true;
            }
          });
        }
      });

      // Se alguma tag de ícone foi adicionada, executar a substituição
      if (shouldReplace) {
        setTimeout(executeReplaceWithRetry, 0);
      }
    });

    // Observar mudanças no DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Limpar o observer quando o componente for desmontado
    return () => {
      observer.disconnect();
    };
  }, []);

  // Este componente não renderiza nada visualmente
  return null;
};

export default IconTransformer;
