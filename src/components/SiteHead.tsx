'use client';

import React, { useEffect } from 'react';
import { useSiteConfig } from '@/contexts/SiteConfigContext';

export default function SiteHead() {
  const { config } = useSiteConfig();

  // Update document title and favicon when config changes
  useEffect(() => {
    if (!config) return;

    // Log for debugging
    console.log('🎨 SiteHead: Aplicando configuração do site:', {
      title: config.title,
      favicon: config.favicon,
      logo: config.logo,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor
    });

    // Update document title IMMEDIATELY
    if (typeof document !== 'undefined' && config.title) {
      document.title = config.title;
      console.log('✅ SiteHead: Título atualizado para:', config.title);
    }

    // Update favicon - try different approaches to ensure it works
    // 1. Update existing link
    const existingFaviconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    if (existingFaviconLinks.length > 0) {
      existingFaviconLinks.forEach(link => {
        link.setAttribute('href', config.favicon);
      });
    } else {
      // 2. Create new link if none exists
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      link.href = config.favicon;
      document.head.appendChild(link);

      // Also add shortcut icon for better compatibility
      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.type = 'image/x-icon';
      shortcutLink.href = config.favicon;
      document.head.appendChild(shortcutLink);
    }

    // Update CSS variables for colors
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', config.secondaryColor);

    // Adicionar um estilo inline para sobrescrever as classes Tailwind
    let styleElement = document.getElementById('dynamic-colors');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dynamic-colors';
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      :root {
        --primary-color: ${config.primaryColor};
        --secondary-color: ${config.secondaryColor};
      }

      .bg-abz-blue {
        background-color: ${config.primaryColor} !important;
      }

      .text-abz-blue {
        color: ${config.primaryColor} !important;
      }

      .border-abz-blue {
        border-color: ${config.primaryColor} !important;
      }

      .hover\\:bg-abz-blue:hover {
        background-color: ${config.primaryColor} !important;
      }

      .focus\\:ring-abz-blue:focus {
        --tw-ring-color: ${config.primaryColor} !important;
      }

      .focus\\:border-abz-blue:focus {
        border-color: ${config.primaryColor} !important;
      }

      .bg-abz-purple {
        background-color: ${config.secondaryColor} !important;
      }

      .text-abz-purple {
        color: ${config.secondaryColor} !important;
      }

      .border-abz-purple {
        border-color: ${config.secondaryColor} !important;
      }

      .hover\\:bg-abz-purple:hover {
        background-color: ${config.secondaryColor} !important;
      }
    `;

    // Force refresh of Tailwind classes by adding and removing a class
    document.body.classList.add('config-updated');
    setTimeout(() => {
      document.body.classList.remove('config-updated');
    }, 100);

    // Add meta tags for theme color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', config.primaryColor);

  }, [config]);

  return null; // This component doesn't render anything visible
}
