'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import {
  FiLoader,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiMoreHorizontal,
  FiX,
  FiArrowUp,
  FiUser
} from 'react-icons/fi';
import { HiHeart, HiShoppingBag } from 'react-icons/hi';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

// --- Subcomponents ---

function TopGradientCard({ user, profile, t }: { user: any; profile: any; t: any }) {
  const firstName =
    profile?.first_name?.split(' ')[0] ||
    user?.first_name?.split(' ')[0] ||
    user?.email?.split('@')[0]?.split('.')[0] ||
    'Fulanito';

  return (
    <div className="relative w-full bg-gradient-to-r from-white via-blue-50 to-blue-100 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 md:p-12 mb-6 sm:mb-8 flex flex-col md:flex-row items-start justify-between min-h-[200px] sm:min-h-[280px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">

      {/* Left Content */}
      <div className="flex-1 z-10 max-w-2xl mt-2 sm:mt-4">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-4 tracking-tight">
          {t('dashboard.hello', { name: firstName })}
        </h1>
        <p className="text-gray-500 text-sm sm:text-lg md:text-xl font-normal mb-4 sm:mb-8">
          {t('dashboard.welcomeMessage')}
        </p>

        <div className="w-full mt-2">
          <UserShortcutsBar />
        </div>
      </div>

      {/* Right Content - Gray Placeholder Widget Removed */}
    </div>

  );
}

// --- Main Page Component ---
import DashboardNewsWidget from '@/components/dashboard/DashboardNewsWidget';
import QuickLinksWidget from '@/components/dashboard/QuickLinksWidget';
import EventsWidget from '@/components/dashboard/EventsWidget';
import UserShortcutsBar from '@/components/dashboard/UserShortcutsBar';
import PendenciesWidget from '@/components/dashboard/PendenciesWidget';
import PurchaseOrderWidget from '@/components/dashboard/widgets/PurchaseOrderWidget';

export default function Dashboard() {
  const { user, profile, isAuthenticated, isLoading } = useSupabaseAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <FiLoader className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="min-h-full pb-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Top Section contains the gradient */}
          <TopGradientCard user={user} profile={profile} t={t} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-stretch">

            {/* Banner - Spans 5 (News) */}
            <div className="lg:col-span-5 min-h-[400px]">
              <DashboardNewsWidget />
            </div>

            {/* Center Column - Quick Links - Spans 4 */}
            <div className="lg:col-span-4 flex flex-col gap-8">
              <QuickLinksWidget />
              <PurchaseOrderWidget />
            </div>

            {/* Right Column - Events + Pendencies - Spans 3 */}
            <div className="lg:col-span-3 h-full flex flex-col gap-8">
              <EventsWidget />
              <PendenciesWidget />
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
