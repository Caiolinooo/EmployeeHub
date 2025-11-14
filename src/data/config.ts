/**
 * Configurações globais do sistema
 * Este arquivo contém configurações que podem ser editadas pelo painel de administração
 */

export interface SiteConfig {
  title: string;
  description: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  contactEmail: string;
  footerText: string;
  dashboardTitle: string;
  dashboardDescription: string;
  sidebarTitle?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

// Configuração padrão do site
const siteConfig: SiteConfig = {
  title: "Painel ABZ Group",
  description: "Painel centralizado para colaboradores da ABZ Group",
  logo: "/images/LC1_Azul.png",
  favicon: "/favicon.ico",
  primaryColor: "#005dff", // abz-blue
  secondaryColor: "#6339F5", // abz-purple
  companyName: "ABZ Group",
  contactEmail: "contato@groupabz.com",
  footerText: "© 2024 ABZ Group. Todos os direitos reservados.",
  dashboardTitle: "Painel de Logística ABZ Group",
  sidebarTitle: "Painel ABZ"
};

export default siteConfig;
