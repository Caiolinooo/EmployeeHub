'use client';

import React, { useEffect } from 'react';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente que garante a aplicação consistente das cores e logos em todo o site
 * Este componente é mais agressivo na aplicação das configurações, sobrescrevendo
 * qualquer estilo que possa ter sido definido por outros componentes
 */
export default function ThemeEnforcer() {
  const { t } = useI18n();

  const { config } = useSiteConfig();

  useEffect(() => {
    if (!config) return;

    // Função para aplicar as configurações
    const applyConfig = () => {
      console.log({t('components.themeenforcerAplicandoConfiguracoesDeTemaComPriori')});
      
      // Atualizar título da página
      if (document.title !== config.title) {
        document.title = config.title;
      }

      // Atualizar favicon - verificar todos os links de favicon
      const faviconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
      
      // Se não encontrou nenhum link de favicon, criar novos
      if (faviconLinks.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/x-icon';
        link.href = config.favicon;
        document.head.appendChild(link);

        const shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.type = 'image/x-icon';
        shortcutLink.href = config.favicon;
        document.head.appendChild(shortcutLink);

        const appleTouchIcon = document.createElement('link');
        appleTouchIcon.rel = 'apple-touch-icon';
        appleTouchIcon.href = config.favicon;
        document.head.appendChild(appleTouchIcon);
      } else {
        // Atualizar todos os links de favicon existentes
        faviconLinks.forEach(link => {
          if (link.getAttribute('href') !== config.favicon) {
            link.setAttribute('href', config.favicon);
          }
        });
      }

      // Verificar se o estilo já existe
      let styleElement = document.getElementById('theme-enforcer');
      
      // Se não existir, criar um novo
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'theme-enforcer';
        document.head.appendChild(styleElement);
      }

      // Definir as variáveis CSS com !important para garantir que elas sobrescrevam qualquer outro estilo
      styleElement.textContent = `
        :root {
          --primary-color: ${config.primaryColor} !important;
          --secondary-color: ${config.secondaryColor} !important;
        }

        /* Cores primárias */
        .bg-abz-blue, .bg-primary, [class*="bg-primary"] {
          background-color: ${config.primaryColor} !important;
        }

        .text-abz-blue, .text-primary, [class*="text-primary"] {
          color: ${config.primaryColor} !important;
        }

        .border-abz-blue, .border-primary, [class*="border-primary"] {
          border-color: ${config.primaryColor} !important;
        }

        .hover\\:bg-abz-blue:hover, .hover\\:bg-primary:hover, [class*="hover:bg-primary"]:hover {
          background-color: ${config.primaryColor} !important;
        }

        .focus\\:ring-abz-blue:focus, .focus\\:ring-primary:focus, [class*="focus:ring-primary"]:focus {
          --tw-ring-color: ${config.primaryColor} !important;
        }

        .focus\\:border-abz-blue:focus, .focus\\:border-primary:focus, [class*="focus:border-primary"]:focus {
          border-color: ${config.primaryColor} !important;
        }

        /* Cores secundárias */
        .bg-abz-purple, .bg-secondary, [class*="bg-secondary"] {
          background-color: ${config.secondaryColor} !important;
        }

        .text-abz-purple, .text-secondary, [class*="text-secondary"] {
          color: ${config.secondaryColor} !important;
        }

        .border-abz-purple, .border-secondary, [class*="border-secondary"] {
          border-color: ${config.secondaryColor} !important;
        }

        .hover\\:bg-abz-purple:hover, .hover\\:bg-secondary:hover, [class*="hover:bg-secondary"]:hover {
          background-color: ${config.secondaryColor} !important;
        }

        /* Botões com cores primárias */
        button.bg-blue-600, button.bg-blue-500, button.bg-blue-700, 
        .button.bg-blue-600, .button.bg-blue-500, .button.bg-blue-700,
        a.bg-blue-600, a.bg-blue-500, a.bg-blue-700 {
          background-color: ${config.primaryColor} !important;
        }

        button.hover\\:bg-blue-700:hover, button.hover\\:bg-blue-600:hover, button.hover\\:bg-blue-800:hover,
        .button.hover\\:bg-blue-700:hover, .button.hover\\:bg-blue-600:hover, .button.hover\\:bg-blue-800:hover,
        a.hover\\:bg-blue-700:hover, a.hover\\:bg-blue-600:hover, a.hover\\:bg-blue-800:hover {
          background-color: ${adjustColor(config.primaryColor, -20)} !important;
        }

        /* Logos */
        img[alt*="logo"], img[src*="logo"], .logo img, .navbar-logo img, header img {
          content: url(${config.logo}) !important;
        }

        /* Meta tags para cores do tema */
        meta[name="theme-color"] {
          content: ${config.primaryColor} !important;
        }
      `;

      // Forçar a atualização de todos os elementos com classes Tailwind
      document.body.classList.add('theme-enforced');
      setTimeout(() => {
        document.body.classList.remove('theme-enforced');
      }, 100);

      // Atualizar meta tags para cores do tema
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', config.primaryColor);
    };

    // Aplicar as configurações imediatamente
    applyConfig();

    // Configurar um intervalo para verificar e reaplicar as configurações periodicamente
    const interval = setInterval(applyConfig, 5000);

    // Configurar um observador de mutações para detectar mudanças no DOM
    const observer = new MutationObserver((mutations) => {
      // Verificar se alguma mutação afetou elementos relevantes
      const shouldReapply = mutations.some(mutation => {
        // Verificar se algum nó adicionado ou removido é relevante
        if (mutation.type === 'childList') {
          // Verificar nós adicionados
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Verificar se é um elemento relevante (link, style, meta, etc.)
              if (element.tagName === 'LINK' || element.tagName === 'STYLE' || 
                  element.tagName === 'META' || element.tagName === 'IMG') {
                return true;
              }
            }
          }
        }
        // Verificar se algum atributo relevante foi modificado
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          if (target.tagName === 'LINK' && 
              (target.getAttribute('rel') === 'icon' || 
               target.getAttribute('rel') === 'shortcut icon')) {
            return true;
          }
          if (target.tagName === 'IMG' && 
              (target.getAttribute('alt')?.includes('logo') || 
               target.getAttribute('src')?.includes('logo'))) {
            return true;
          }
        }
        return false;
      });

      if (shouldReapply) {
        applyConfig();
      }
    });

    // Iniciar a observação do documento
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'src', 'alt', 'class', 'style']
    });

    // Limpar o intervalo e o observador quando o componente for desmontado
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [config]);

  return null; // Este componente não renderiza nada visível
}

// Função auxiliar para ajustar a cor (escurecer ou clarear)
function adjustColor(color: string, amount: number): string {
  // Remover o # se existir
  color = color.replace('#', '');
  
  // Converter para RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Ajustar cada componente
  const adjustR = Math.max(0, Math.min(255, r + amount));
  const adjustG = Math.max(0, Math.min(255, g + amount));
  const adjustB = Math.max(0, Math.min(255, b + amount));
  
  // Converter de volta para hex
  const rHex = adjustR.toString(16).padStart(2, '0');
  const gHex = adjustG.toString(16).padStart(2, '0');
  const bHex = adjustB.toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}
