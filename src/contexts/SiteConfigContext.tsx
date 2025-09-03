'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '@/data/config';

interface SiteConfigContextType {
  config: SiteConfig;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

// Default configuration
const defaultConfig: SiteConfig = {
  title: "Painel ABZ Group",
  description: "Painel centralizado para colaboradores da ABZ Group",
  logo: "/images/LC1_Azul.png",
  favicon: "/favicon.ico",
  primaryColor: "#005dff", // abz-blue
  secondaryColor: "#6339F5", // abz-purple
  companyName: "ABZ Group",
  contactEmail: "contato@groupabz.com",
  footerText: "© 2024 ABZ Group. Todos os direitos reservados.",
  dashboardTitle: "Centro de Recursos ABZ Group",
  dashboardDescription: "Bem-vindo ao centro de recursos para colaboradores da logística.",
  googleClientId: "",
  googleClientSecret: "",
  googleRedirectUri: ""
};

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

interface SiteConfigProviderProps {
  children: ReactNode;
}

export function SiteConfigProvider({ children }: SiteConfigProviderProps) {
  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Function to fetch configuration from API
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching site configuration from API...');
      const response = await fetch('/api/config');

      if (response.ok) {
        const data = await response.json();
        console.log('Site configuration loaded successfully:', data);

        // Ensure paths are absolute
        const processedData = {
          ...data,
          logo: ensureAbsolutePath(data.logo),
          favicon: ensureAbsolutePath(data.favicon)
        };

        setConfig(processedData);
        setError(null);

        // Apply configuration to document
        applyConfigToDocument(processedData);
      } else {
        console.error('Failed to load site configuration:', response.status, response.statusText);
        setError('Failed to load site configuration');
      }
    } catch (error) {
      console.error('Error loading site configuration:', error);
      setError('Error loading site configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to ensure paths are absolute
  const ensureAbsolutePath = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // If path starts with /uploads, it's already absolute
    if (path.startsWith('/uploads/')) {
      return path;
    }
    // If path is relative, make it absolute
    if (!path.startsWith('/')) {
      return `/${path}`;
    }
    return path;
  };

  // Apply configuration to document elements
  const applyConfigToDocument = (config: SiteConfig) => {
    console.log('Applying configuration to document:', {
      title: config.title,
      favicon: config.favicon,
      logo: config.logo,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor
    });

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

    // Update title
    document.title = config.title;

    // Update CSS variables for colors
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', config.secondaryColor);

    // Adicionar estilos dinâmicos para cores
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
      .bg-primary {
        background-color: ${config.primaryColor} !important;
      }
      .text-primary {
        color: ${config.primaryColor} !important;
      }
      .border-primary {
        border-color: ${config.primaryColor} !important;
      }
      .bg-secondary {
        background-color: ${config.secondaryColor} !important;
      }
      .text-secondary {
        color: ${config.secondaryColor} !important;
      }
      .border-secondary {
        border-color: ${config.secondaryColor} !important;
      }
    `;

    // Add meta tags for theme color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', config.primaryColor);

    // Add preload for logo
    const logoPreload = document.querySelector(`link[rel="preload"][href="${config.logo}"]`);
    if (!logoPreload && config.logo) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.href = config.logo;
      preloadLink.as = 'image';
      document.head.appendChild(preloadLink);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    setMounted(true);
    fetchConfig();
  }, []);

  // Only render children when mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <SiteConfigContext.Provider
      value={{
        config,
        isLoading,
        error,
        refreshConfig: fetchConfig
      }}
    >
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const context = useContext(SiteConfigContext);
  if (context === undefined) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }
  return context;
}
