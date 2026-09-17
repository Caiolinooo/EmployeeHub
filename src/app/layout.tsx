import type { Metadata, Viewport } from "next";
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
// GlobalFeedbackWidget removido - agora integrado no HelpWidget

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

// Metadata estático (o SiteHead component atualiza dinamicamente em runtime)
export const metadata: Metadata = {
  title: "Portal ABZ",
  description: "Portal centralizado para colaboradores da ABZ Group",
};

// Viewport via export do Next 15 (App Router) — substitui a <meta> crua no <head>.
// viewportFit: 'cover' respeita safe-areas (notch/barra do iPhone) para .pb-safe/.pt-safe.
// maximum-scale=5.0 mantém o zoom acessível (não desabilitar).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

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
        {/* Viewport agora vem de `export const viewport` (Next 15) — ver acima */}
        {/* PWA Manifest & Meta */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0B72E7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/images/LC1_Azul.png" />
        <link rel="apple-touch-icon" href="/images/LC1_Azul.png" />
        {/* Meta tag para garantir o tipo MIME correto */}
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </head>
      <body className="bg-gray-50 overflow-x-hidden max-w-[100vw]" suppressHydrationWarning>
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
