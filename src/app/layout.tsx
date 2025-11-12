import type { Metadata } from "next";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorFallback from "@/components/ErrorFallback";
import localFont from "next/font/local";
import "./globals.css";

// Import the ClientProviders component
import ClientProviders from "@/components/ClientProviders";
// Import the ThemeEnforcerWrapper component
import ThemeEnforcerWrapper from "@/components/ThemeEnforcerWrapper";
// Import SiteHead for dynamic title updates
import SiteHead from "@/components/SiteHead";

// Global error handling is now moved to the GlobalErrorHandler component

// Define plusJakartaSans
const plusJakartaSans = localFont({
  src: [
    {
      path: '../../public/fonts/PlusJakartaSans-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/PlusJakartaSans-Italic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/fonts/PlusJakartaSans-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/PlusJakartaSans-SemiBoldItalic.ttf',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../../public/fonts/PlusJakartaSans-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
     {
      path: '../../public/fonts/PlusJakartaSans-ExtraBoldItalic.ttf',
      weight: '800',
      style: 'italic',
    },
  ],
  variable: '--font-plus-jakarta',
});

// Função para gerar metadata dinamicamente
export async function generateMetadata(): Promise<Metadata> {
  try {
    // Tentar buscar a configuração do servidor
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/config`, {
      cache: 'no-store'
    });

    if (response.ok) {
      const config = await response.json();
      return {
        title: config.title || "Painel ABZ Group",
        description: config.description || "Painel centralizado para colaboradores da ABZ Group",
      };
    }
  } catch (error) {
    console.error('Erro ao buscar configuração para metadata:', error);
  }

  // Fallback para valores padrão
  return {
    title: "Painel ABZ Group",
    description: "Painel centralizado para colaboradores da ABZ Group",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        {/* Adicionar link para os ícones do Material Design */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          type="text/css"
        />
        {/* Adicionar link para o CSS do Material Icons */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          type="text/css"
        />
        {/* PWA Manifest & Meta */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0B72E7" />
        <link rel="icon" href="/images/LC1_Azul.png" />
        {/* Meta tag para garantir o tipo MIME correto */}
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </head>
      <body className="bg-gray-50" suppressHydrationWarning>
        <ClientProviders>
          <ErrorBoundary fallback={<ErrorFallback />}>
            <SiteHead />
            {children}
          </ErrorBoundary>
          <ThemeEnforcerWrapper />
        </ClientProviders>
      </body>
    </html>
  );
}
