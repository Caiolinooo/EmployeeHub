'use client';

import React, { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GlobalErrorHandler from './GlobalErrorHandler';

// Import providers directly in the client component
import { I18nProvider } from '@/contexts/I18nContext';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';
import { SiteConfigProvider } from '@/contexts/SiteConfigContext';
// Using our new safer approach for Material Design icons
import MaterialDesignIcon from '@/components/MaterialDesignIcon';
import LanguageDialog from '@/components/LanguageDialog';
import SiteHead from '@/components/SiteHead';
import CompleteProfilePrompt from '@/components/Profile/CompleteProfilePrompt';
import { usePathname } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';


// Renders the profile completion prompt only when under SupabaseAuthProvider
function ProfilePromptGate({ isMounted, pathname }: { isMounted: boolean; pathname?: string | null }) {
  const { isAuthenticated, isLoading, profile, user } = useSupabaseAuth();
  const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/set-password') || pathname?.startsWith('/reset-password');

  const hasProfile = !!profile;
  const fullNameFromProfileData = ((): { first?: string; last?: string } => {
    const pd: any = (profile as any)?.profile_data || {};
    const name: string | undefined = pd?.full_name || pd?.name || (profile as any)?.name;
    if (name && typeof name === 'string') {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return { first: parts[0], last: parts[parts.length - 1] };
      if (parts.length === 1) return { first: parts[0] };
    }
    return { first: pd?.first_name || pd?.firstName, last: pd?.last_name || pd?.lastName };
  })();

  const firstCandidate = (
    (profile?.first_name ?? (profile as any)?.firstName ?? fullNameFromProfileData.first ?? (user as any)?.first_name ?? (user as any)?.firstName ?? '') as string
  ).trim();

  let lastCandidate = (
    (profile?.last_name ?? (profile as any)?.lastName ?? fullNameFromProfileData.last ?? (user as any)?.last_name ?? (user as any)?.lastName ?? '') as string
  ).trim();

  // As a last resort, try to infer last name from email pattern like john.doe@...
  if (!lastCandidate && (user?.email || profile?.email)) {
    const email = (user?.email || profile?.email) as string;
    const local = email.split('@')[0];
    const parts = local.split('.');
    if (parts.length >= 2) lastCandidate = parts[parts.length - 1];
  }

  const needsProfile = hasProfile && !(firstCandidate && lastCandidate);
  const showProfilePrompt = isMounted && !isLoading && isAuthenticated && !isAuthRoute && hasProfile && needsProfile;
  return showProfilePrompt ? <CompleteProfilePrompt reminderMinutes={2} /> : null;
}

// Client-side only component to wrap all providers
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Use state to track client-side mounting to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();


  useEffect(() => {
    setIsMounted(true);
  }, []);


  return (
    <>
      <GlobalErrorHandler />
      <SupabaseAuthProvider>
        <I18nProvider>
          <SiteConfigProvider>
            <SiteHead />
            {isMounted && <LanguageDialog />}
            {isMounted && <ToastContainer position="top-right" theme="colored" />}
            <ProfilePromptGate isMounted={isMounted} pathname={pathname} />
            {children}
          </SiteConfigProvider>
        </I18nProvider>
      </SupabaseAuthProvider>
    </>
  );
}
