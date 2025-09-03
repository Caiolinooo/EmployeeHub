'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import NewsFeed from '@/components/news/NewsFeed';
import NotificationHUD from '@/components/notifications/NotificationHUD';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

// Página unificada do ABZ News exibindo o feed estilo Instagram
export default function NoticiasPage() {
  const { user, profile } = useSupabaseAuth();
  const userId = user?.id || profile?.id || '';
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-abz-text-black">ABZ News</h1>
          {userId && <NotificationHUD userId={userId} />}
        </div>
        <NewsFeed userId={userId} limit={10} />
      </div>
    </MainLayout>
  );
}

