'use client';

import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobalErrorHandler from './GlobalErrorHandler';

// Import providers directly in the client component
import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';
import { SiteConfigProvider } from '@/contexts/SiteConfigContext';
// Using our new safer approach for Material Design icons
import MaterialDesignIcon from '@/components/MaterialDesignIcon';
import LanguageDialog from '@/components/LanguageDialog';
import SiteHead from '@/components/SiteHead';

// Client-side only component to wrap all providers
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Use state to track client-side mounting to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Set mounted state after hydration
    setIsMounted(true);
  }, []);

  return (
    <>
      <GlobalErrorHandler />
      <SupabaseAuthProvider>
        <I18nProvider>
          <SiteConfigProvider>
            <SiteHead />
            {/* Only render components that might cause hydration issues when mounted on client */}
            {isMounted && <LanguageDialog />}
            {isMounted && <ToastContainer position="top-right" theme="colored" />}
            {/* Render the children directly without the problematic icon wrappers */}
            {children}
          </SiteConfigProvider>
        </I18nProvider>
      </SupabaseAuthProvider>
    </>
  );
}
